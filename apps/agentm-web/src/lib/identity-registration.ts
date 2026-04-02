import type { IdentityRegistrationStatus } from '../types.ts';

const REGISTRATION_TYPE = 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';

export interface IdentityRegistrationRequest {
    agent: string;
    email?: string | null;
    endpoint?: string | null;
    authToken?: string | null;
    timeoutMs?: number;
    now?: () => number;
    fetchImpl?: typeof fetch;
}

export interface IdentityRegistrationPayload {
    type: string;
    agentPubkey: string;
    name: string;
    description: string;
    services: Array<{ name: string; endpoint: string; version: string }>;
    registrations: Array<{ agentId: string; agentRegistry: string }>;
    metadata: Array<{ metadataKey: string; metadataValue: string }>;
    timestamp: number;
}

export function buildIdentityRegistrationPayload(
    request: Pick<IdentityRegistrationRequest, 'agent' | 'email' | 'now'>,
): IdentityRegistrationPayload {
    const now = request.now ?? Date.now;
    return {
        type: REGISTRATION_TYPE,
        agentPubkey: request.agent,
        name: request.agent,
        description: 'Agent participating in Gradience Protocol',
        services: [
            {
                name: 'a2a',
                endpoint: 'a2a:gradience',
                version: '0.1',
            },
        ],
        registrations: [
            {
                agentId: request.agent,
                agentRegistry: 'solana:101:metaplex',
            },
        ],
        metadata: [
            {
                metadataKey: 'agent.email',
                metadataValue: request.email ?? '',
            },
        ],
        timestamp: Math.floor(now() / 1000),
    };
}

export async function registerIdentity(
    request: IdentityRegistrationRequest,
): Promise<IdentityRegistrationStatus> {
    const now = request.now ?? Date.now;
    const endpoint = request.endpoint ?? resolveIdentityRegistrationEndpoint();
    if (!endpoint) {
        return {
            agent: request.agent,
            state: 'disabled',
            agentId: null,
            txHash: null,
            error: null,
            updatedAt: now(),
        };
    }

    const payload = buildIdentityRegistrationPayload(request);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 8_000);
    try {
        const headers: Record<string, string> = {
            'content-type': 'application/json',
        };
        const authToken = request.authToken ?? resolveIdentityRegistrationAuthToken();
        if (authToken) {
            headers.authorization = `Bearer ${authToken}`;
        }

        const fetchImpl = request.fetchImpl ?? fetch;
        const response = await fetchImpl(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        if (!response.ok) {
            const message = await response.text();
            return {
                agent: request.agent,
                state: 'failed',
                agentId: null,
                txHash: null,
                error: `identity relay ${response.status}: ${message}`,
                updatedAt: now(),
            };
        }
        const body = (await response.json()) as {
            agentId?: string;
            txHash?: string;
            reused?: boolean;
        };
        return {
            agent: request.agent,
            state: 'registered',
            agentId: body.agentId ?? null,
            txHash: body.txHash ?? null,
            error: body.reused ? 'already registered' : null,
            updatedAt: now(),
        };
    } catch (error) {
        return {
            agent: request.agent,
            state: 'failed',
            agentId: null,
            txHash: null,
            error: error instanceof Error ? error.message : String(error),
            updatedAt: now(),
        };
    } finally {
        clearTimeout(timeout);
    }
}

export function resolveIdentityRegistrationEndpoint(): string | null {
    if (typeof import.meta === 'undefined') {
        return null;
    }
    const env = (import.meta as unknown as {
        env?: {
            VITE_ERC8004_IDENTITY_RELAY_ENDPOINT?: string;
            VITE_ERC8004_RELAY_BASE_URL?: string;
        };
    }).env;
    const direct = env?.VITE_ERC8004_IDENTITY_RELAY_ENDPOINT;
    if (direct) {
        return direct;
    }
    if (env?.VITE_ERC8004_RELAY_BASE_URL) {
        return `${trimTrailingSlash(env.VITE_ERC8004_RELAY_BASE_URL)}/relay/erc8004/register-identity`;
    }
    return null;
}

export function resolveIdentityRegistrationAuthToken(): string | null {
    if (typeof import.meta === 'undefined') {
        return null;
    }
    const env = (import.meta as unknown as {
        env?: { VITE_ERC8004_RELAY_AUTH_TOKEN?: string };
    }).env;
    return env?.VITE_ERC8004_RELAY_AUTH_TOKEN ?? null;
}

function trimTrailingSlash(value: string): string {
    return value.endsWith('/') ? value.slice(0, -1) : value;
}
