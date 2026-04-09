import type { RelayRequest, RelayResponse, RelayStore, SignedEnvelope } from './types';
import { TransportCrypto } from './transport-crypto';

export class A2ARelayApi {
    private readonly authToken: string | null;
    private readonly maxPayloadBytes: number;
    private readonly maxPaymentMicrolamports: bigint;
    private readonly transportCrypto: TransportCrypto | null;

    constructor(
        private readonly store: RelayStore,
        options: {
            authToken?: string;
            maxPayloadBytes?: number;
            maxPaymentMicrolamports?: bigint;
            transportEncryptionKey?: string;
        } = {},
    ) {
        this.authToken = options.authToken?.trim() || null;
        this.maxPayloadBytes = options.maxPayloadBytes ?? 32 * 1024;
        this.maxPaymentMicrolamports = options.maxPaymentMicrolamports ?? 10_000_000n;
        this.transportCrypto = options.transportEncryptionKey
            ? new TransportCrypto(options.transportEncryptionKey)
            : null;
    }

    async handle(request: RelayRequest): Promise<RelayResponse> {
        if (!this.isAuthorized(request)) {
            return { status: 401, body: { error: 'unauthorized' } };
        }

        if (request.method === 'POST' && request.path === '/v1/discovery/announce') {
            const body = request.body as
                | {
                      agent: string;
                      capabilityMask: string | number;
                      transportFlags: number;
                      endpoint: string;
                  }
                | undefined;
            if (!body?.agent || !body.endpoint) {
                return { status: 400, body: { error: 'invalid_payload' } };
            }
            const descriptor = await this.store.upsertAgent({
                agent: body.agent,
                capabilityMask: BigInt(body.capabilityMask),
                transportFlags: body.transportFlags ?? 0,
                endpoint: body.endpoint,
            });
            return { status: 200, body: { ok: true, descriptor } };
        }

        if (request.method === 'GET' && request.path === '/v1/discovery/agents') {
            const capabilityMask = request.query?.capabilityMask;
            const limit = parseLimit(request.query?.limit, 100, 500);
            const cursor = request.query?.cursor;
            const all = await this.store.listAgents(capabilityMask !== undefined ? BigInt(capabilityMask) : undefined);
            const sorted = [...all].sort((a, b) => a.agent.localeCompare(b.agent));
            const start = cursor === undefined ? 0 : Math.max(0, sorted.findIndex((item) => item.agent === cursor) + 1);
            const items = sorted.slice(start, start + limit);
            const nextCursor = items.length === limit ? (items[items.length - 1]?.agent ?? null) : null;
            return { status: 200, body: { items, nextCursor } };
        }

        if (request.method === 'POST' && request.path === '/v1/envelopes/publish') {
            const body = request.body as { envelope: SignedEnvelope; payload: Record<string, unknown> } | undefined;
            if (!body?.envelope || !body.payload) {
                await this.store.markPayloadRejected();
                return { status: 400, body: { error: 'invalid_payload' } };
            }
            const payloadSize = jsonSize(body.payload);
            if (payloadSize > this.maxPayloadBytes) {
                await this.store.markPayloadRejected();
                return { status: 413, body: { error: 'payload_too_large' } };
            }
            if (!isValidEnvelope(body.envelope)) {
                await this.store.markPayloadRejected();
                return { status: 400, body: { error: 'invalid_envelope' } };
            }
            if (body.envelope.paymentMicrolamports > this.maxPaymentMicrolamports) {
                await this.store.markPayloadRejected();
                return { status: 400, body: { error: 'payment_limit_exceeded' } };
            }
            const payload = this.transportCrypto ? this.transportCrypto.encrypt(body.payload) : body.payload;
            const record = await this.store.publishEnvelope(body.envelope, payload);
            return {
                status: 202,
                body: {
                    accepted: true,
                    relayId: record.envelope.id,
                },
            };
        }

        if (request.method === 'GET' && request.path === '/v1/envelopes/pull') {
            const agent = request.query?.agent;
            if (!agent) {
                return { status: 400, body: { error: 'agent_required' } };
            }
            const after = request.query?.after;
            const limit = parseLimit(request.query?.limit, 100, 500);
            const result = await this.store.pullEnvelopes(agent, after, limit);
            return {
                status: 200,
                body: {
                    items: result.items.map((item) => ({
                        ...item,
                        body: this.transportCrypto ? this.transportCrypto.decrypt(item.body) : item.body,
                    })),
                    nextCursor: result.nextCursor,
                },
            };
        }

        if (request.method === 'GET' && request.path === '/v1/metrics') {
            return {
                status: 200,
                body: await this.store.getMetrics(),
            };
        }

        return { status: 404, body: { error: 'not_found' } };
    }

    private isAuthorized(request: RelayRequest): boolean {
        if (!this.authToken) {
            return true;
        }
        const token = parseBearerToken(request.headers?.authorization) ?? request.headers?.['x-relay-token'];
        return token === this.authToken;
    }
}

function parseLimit(value: string | undefined, fallback: number, max: number): number {
    if (!value) {
        return fallback;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.min(max, Math.floor(parsed));
}

function parseBearerToken(value: string | undefined): string | null {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed.toLowerCase().startsWith('bearer ')) {
        return null;
    }
    return trimmed.slice(7).trim();
}

function isValidEnvelope(envelope: SignedEnvelope): boolean {
    if (!envelope.id || envelope.id.length > 128) {
        return false;
    }
    if (envelope.threadId <= 0n || envelope.sequence <= 0 || envelope.nonce <= 0n) {
        return false;
    }
    if (!envelope.from || !envelope.to || !envelope.messageType) {
        return false;
    }
    if (!isHex64(envelope.bodyHash)) {
        return false;
    }
    if (!isHex64(envelope.signature.r) || !isHex64(envelope.signature.s)) {
        return false;
    }
    if (!Number.isFinite(envelope.createdAt) || envelope.createdAt <= 0) {
        return false;
    }
    return true;
}

function isHex64(value: string): boolean {
    return /^[0-9a-fA-F]{64}$/.test(value);
}

function jsonSize(value: unknown): number {
    return new TextEncoder().encode(JSON.stringify(value)).length;
}
