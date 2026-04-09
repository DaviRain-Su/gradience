import { randomBytes, randomUUID } from 'node:crypto';
import { BRIDGE_TIMEOUT_MS, PAIR_CODE_LEN, PAIR_CODE_TTL_MS } from './constants.ts';
import type { AgentPresence, BridgeSession, PairCodeRecord } from './types.ts';

const PAIR_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface WebEntryConfig {
    pairCodeTtlMs: number;
    bridgeTimeoutMs: number;
}

export interface WebEntryState {
    config: WebEntryConfig;
    pairCodes: Map<string, PairCodeRecord>;
    bridges: Map<string, BridgeSession>;
    bridgeTokens: Map<string, string>;
    agentPresenceByBridge: Map<string, Map<string, AgentPresence>>;
}

export class WebEntryError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string,
    ) {
        super(message);
    }
}

export function createWebEntryState(config: Partial<WebEntryConfig> = {}): WebEntryState {
    return {
        config: {
            pairCodeTtlMs: config.pairCodeTtlMs ?? PAIR_CODE_TTL_MS,
            bridgeTimeoutMs: config.bridgeTimeoutMs ?? BRIDGE_TIMEOUT_MS,
        },
        pairCodes: new Map(),
        bridges: new Map(),
        bridgeTokens: new Map(),
        agentPresenceByBridge: new Map(),
    };
}

export function issuePairCode(state: WebEntryState, input: { userId: string; sessionId: string; now: number }) {
    let pairCode = generatePairCode();
    while (state.pairCodes.has(pairCode)) {
        pairCode = generatePairCode();
    }

    const record: PairCodeRecord = {
        pairCode,
        userId: input.userId,
        sessionId: input.sessionId,
        expiresAt: input.now + state.config.pairCodeTtlMs,
        state: 'issued',
        consumedByBridgeId: null,
    };
    state.pairCodes.set(pairCode, record);

    return {
        pairCode: record.pairCode,
        expiresAt: record.expiresAt,
    };
}

export function consumePairCode(state: WebEntryState, input: { pairCode: string; machineName: string; now: number }) {
    const pairCode = input.pairCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(pairCode)) {
        throw new WebEntryError(400, 'WB-1002', 'Pair code invalid');
    }

    const record = state.pairCodes.get(pairCode);
    if (!record) {
        throw new WebEntryError(400, 'WB-1002', 'Pair code invalid');
    }
    if (record.state === 'consumed') {
        throw new WebEntryError(409, 'WB-1004', 'Pair code already consumed');
    }
    if (record.state === 'expired' || input.now > record.expiresAt) {
        record.state = 'expired';
        state.pairCodes.set(pairCode, record);
        throw new WebEntryError(410, 'WB-1003', 'Pair code expired');
    }

    const bridgeId = randomUUID();
    const bridgeToken = randomUUID();
    const bridge: BridgeSession = {
        bridgeId,
        userId: record.userId,
        sessionId: record.sessionId,
        machineName: input.machineName.trim() || 'unknown-machine',
        connectedAt: input.now,
        lastHeartbeatAt: input.now,
        status: 'offline',
    };
    state.bridges.set(bridgeId, bridge);
    state.bridgeTokens.set(bridgeToken, bridgeId);
    state.agentPresenceByBridge.set(bridgeId, new Map());

    record.state = 'consumed';
    record.consumedByBridgeId = bridgeId;
    state.pairCodes.set(pairCode, record);

    return {
        bridgeId,
        bridgeToken,
        sessionId: bridge.sessionId,
        userId: bridge.userId,
    };
}

export function setBridgeOnline(state: WebEntryState, input: { bridgeId: string; now: number }) {
    const bridge = state.bridges.get(input.bridgeId);
    if (!bridge) return;
    bridge.status = 'online';
    bridge.lastHeartbeatAt = input.now;
    state.bridges.set(input.bridgeId, bridge);
}

export function setBridgeOffline(state: WebEntryState, bridgeId: string, now: number) {
    const bridge = state.bridges.get(bridgeId);
    if (!bridge) return;
    bridge.status = 'offline';
    bridge.lastHeartbeatAt = now;
    state.bridges.set(bridgeId, bridge);
    state.agentPresenceByBridge.set(bridgeId, new Map());
}

export function recordHeartbeat(state: WebEntryState, input: { bridgeId: string; now: number }) {
    const bridge = state.bridges.get(input.bridgeId);
    if (!bridge) return;
    bridge.lastHeartbeatAt = input.now;
    bridge.status = 'online';
    state.bridges.set(input.bridgeId, bridge);
}

export function upsertAgentPresence(
    state: WebEntryState,
    input: {
        bridgeId: string;
        now: number;
        agents: Array<{
            agentId: string;
            displayName?: string | null;
            status?: 'idle' | 'busy' | 'offline';
            capabilities?: Array<'text' | 'voice'>;
        }>;
    },
) {
    const bridge = state.bridges.get(input.bridgeId);
    if (!bridge) return;
    const nextPresence = new Map<string, AgentPresence>();
    for (const agent of input.agents) {
        const agentId = agent.agentId.trim();
        if (!agentId) continue;
        nextPresence.set(agentId, {
            agentId,
            bridgeId: input.bridgeId,
            displayName: agent.displayName?.trim() || null,
            status: agent.status ?? 'idle',
            capabilities:
                agent.capabilities && agent.capabilities.length > 0
                    ? Array.from(new Set(agent.capabilities))
                    : ['text'],
            updatedAt: input.now,
        });
    }
    state.agentPresenceByBridge.set(input.bridgeId, nextPresence);
    bridge.lastHeartbeatAt = input.now;
    bridge.status = 'online';
    state.bridges.set(input.bridgeId, bridge);
}

export function listAgentsForSession(state: WebEntryState, input: { sessionId: string; now: number }) {
    sweepTimeouts(state, input.now);
    const items: AgentPresence[] = [];
    for (const [bridgeId, bridge] of state.bridges.entries()) {
        if (bridge.sessionId !== input.sessionId || bridge.status !== 'online') {
            continue;
        }
        const presence = state.agentPresenceByBridge.get(bridgeId);
        if (!presence) continue;
        items.push(...presence.values());
    }
    return items.sort((a, b) => b.updatedAt - a.updatedAt || a.agentId.localeCompare(b.agentId));
}

export function findBridgeForSessionAgent(
    state: WebEntryState,
    input: { sessionId: string; agentId: string; now: number },
) {
    sweepTimeouts(state, input.now);
    for (const [bridgeId, bridge] of state.bridges.entries()) {
        if (bridge.sessionId !== input.sessionId || bridge.status !== 'online') {
            continue;
        }
        const presence = state.agentPresenceByBridge.get(bridgeId);
        const agent = presence?.get(input.agentId);
        if (agent) {
            return { bridgeId, agent };
        }
    }
    return null;
}

export function hasOnlineBridgeForSession(state: WebEntryState, input: { sessionId: string; now: number }) {
    sweepTimeouts(state, input.now);
    for (const bridge of state.bridges.values()) {
        if (bridge.sessionId === input.sessionId && bridge.status === 'online') {
            return true;
        }
    }
    return false;
}

export function getBridgeIdByToken(state: WebEntryState, token: string): string | null {
    return state.bridgeTokens.get(token) ?? null;
}

export function getBridgeSession(state: WebEntryState, bridgeId: string) {
    return state.bridges.get(bridgeId) ?? null;
}

export function sweepTimeouts(state: WebEntryState, now: number) {
    for (const [bridgeId, bridge] of state.bridges.entries()) {
        if (bridge.status !== 'online') continue;
        if (now - bridge.lastHeartbeatAt > state.config.bridgeTimeoutMs) {
            setBridgeOffline(state, bridgeId, now);
        }
    }

    for (const [pairCode, record] of state.pairCodes.entries()) {
        if (record.state === 'issued' && now > record.expiresAt) {
            record.state = 'expired';
            state.pairCodes.set(pairCode, record);
        }
    }
}

function generatePairCode(): string {
    const buf = randomBytes(PAIR_CODE_LEN);
    let output = '';
    for (let i = 0; i < PAIR_CODE_LEN; i += 1) {
        output += PAIR_CODE_ALPHABET[buf[i] % PAIR_CODE_ALPHABET.length];
    }
    return output;
}
