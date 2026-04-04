import {
    type EventEnvelope,
    type ProgramEvent,
    type WebhookTransaction,
    type Env,
} from '../types';

const EVENT_IX_TAG_LE = new Uint8Array([0x1d, 0x9a, 0xcb, 0x51, 0x2e, 0xa5, 0x45, 0xe4]);

// Response helpers
function jsonResponse(data: unknown, status = 200, env?: Env): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'content-type': 'application/json',
            ...corsHeaders(env),
        },
    });
}

function errorResponse(status: number, error: string, env?: Env): Response {
    return jsonResponse({ error }, status, env);
}

function internalErrorResponse(context: string, error: unknown, env?: Env): Response {
    console.error(`[indexer-worker:${context}]`, toErrorMessage(error));
    return errorResponse(500, 'internal error', env);
}

function corsHeaders(env?: Env): Record<string, string> {
    const allowOrigin = env?.CORS_ALLOW_ORIGIN?.trim() || '*';
    return {
        'access-control-allow-origin': allowOrigin,
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'content-type,authorization,x-webhook-token',
    };
}

function toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

// Type guards
function asRecord(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] | null {
    return Array.isArray(value) ? value : null;
}

function asStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
        return null;
    }
    if (value.some(entry => typeof entry !== 'string')) {
        return null;
    }
    return value as string[];
}

// Parsing helpers
function parseInteger(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === 'string' && value.length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return Math.trunc(parsed);
        }
    }
    return fallback;
}

function parseString(value: unknown): string {
    if (typeof value !== 'string') {
        throw new Error('expected string field');
    }
    return value;
}

function parseByteArray(value: unknown, exactLength?: number): number[] {
    if (!Array.isArray(value)) {
        throw new Error('expected byte array field');
    }
    const out = value.map(entry => {
        if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0 || entry > 255) {
            throw new Error('byte array contains invalid value');
        }
        return entry;
    });
    if (exactLength !== undefined && out.length !== exactLength) {
        throw new Error(`byte array length mismatch: expected ${exactLength}`);
    }
    return out;
}

function decodeBase64(value: string): Uint8Array {
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// ByteCursor for reading binary data
class ByteCursor {
    private readonly view: DataView;
    private offset = 0;

    constructor(private readonly bytes: Uint8Array) {
        this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }

    readU8(): number {
        this.ensure(1);
        const value = this.view.getUint8(this.offset);
        this.offset += 1;
        return value;
    }

    readU32(): number {
        this.ensure(4);
        const value = this.view.getUint32(this.offset, true);
        this.offset += 4;
        return value;
    }

    readI64(): number {
        this.ensure(8);
        const value = this.view.getBigInt64(this.offset, true);
        this.offset += 8;
        return bigintToSafeNumber(value);
    }

    readU64(): number {
        this.ensure(8);
        const value = this.view.getBigUint64(this.offset, true);
        this.offset += 8;
        return bigintToSafeNumber(value);
    }

    readPubkey(): number[] {
        this.ensure(32);
        const out = Array.from(this.bytes.slice(this.offset, this.offset + 32));
        this.offset += 32;
        return out;
    }

    readString(): string {
        const len = this.readU32();
        this.ensure(len);
        const out = new TextDecoder().decode(this.bytes.slice(this.offset, this.offset + len));
        this.offset += len;
        return out;
    }

    readU8Vec(): number[] {
        const len = this.readU32();
        this.ensure(len);
        const out = Array.from(this.bytes.slice(this.offset, this.offset + len));
        this.offset += len;
        return out;
    }

    private ensure(length: number): void {
        if (this.offset + length > this.bytes.length) {
            throw new Error('event payload is truncated');
        }
    }
}

function bigintToSafeNumber(value: bigint): number {
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    const min = BigInt(Number.MIN_SAFE_INTEGER);
    if (value > max || value < min) {
        throw new Error('numeric field exceeds safe integer range');
    }
    return Number(value);
}

// Main webhook handler
export async function handleWebhook(
    request: Request,
    env: Env,
    applyEvent: (db: Env['DB'], envelope: EventEnvelope) => Promise<void>
): Promise<Response> {
    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return errorResponse(400, 'invalid json payload');
    }

    try {
        const envelopes = decodeWebhookPayload(payload);
        for (const envelope of envelopes) {
            await applyEvent(env.DB, envelope);
        }
        return jsonResponse({ processed_events: envelopes.length });
    } catch (error) {
        return internalErrorResponse('webhook', error, env);
    }
}

// Payload decoding
export function decodeWebhookPayload(payload: unknown): EventEnvelope[] {
    const payloadRecord = asRecord(payload);

    if (payloadRecord) {
        const mockEvents = asArray(payloadRecord.events);
        if (mockEvents) {
            return decodeMockEvents(mockEvents);
        }
    }

    const transactions = decodeTransactionsPayload(payload);
    const envelopes: EventEnvelope[] = [];
    for (const tx of transactions) {
        const events = parseEventsFromLogs(tx.logs);
        for (const event of events) {
            envelopes.push({
                slot: tx.slot,
                timestamp: tx.timestamp,
                event,
            });
        }
    }
    return envelopes;
}

export function decodeTransactionsPayload(payload: unknown): WebhookTransaction[] {
    if (Array.isArray(payload)) {
        return payload.map(toWebhookTransaction);
    }

    const record = asRecord(payload);
    if (!record) {
        throw new Error('webhook payload must be an object or array');
    }

    const wrapped = asArray(record.transactions) ?? asArray(record.data) ?? asArray(record.result);
    if (!wrapped) {
        throw new Error('webhook payload does not contain transactions/data/result');
    }

    return wrapped.map(toWebhookTransaction);
}

export function toWebhookTransaction(value: unknown): WebhookTransaction {
    const record = asRecord(value);
    if (!record) {
        throw new Error('transaction payload item is not an object');
    }

    const slot = parseInteger(record.slot, 0);
    const timestamp = parseInteger(record.timestamp ?? record.blockTime ?? record.block_time, 0);

    const logs =
        asStringArray(record.logs) ??
        extractLogsFromMeta(record.meta) ??
        extractLogsFromTransaction(record.transaction) ??
        [];

    return { slot, timestamp, logs };
}

export function extractLogsFromMeta(meta: unknown): string[] | null {
    const metaRecord = asRecord(meta);
    if (!metaRecord) {
        return null;
    }
    return asStringArray(metaRecord.logMessages) ?? asStringArray(metaRecord.log_messages);
}

export function extractLogsFromTransaction(tx: unknown): string[] | null {
    const txRecord = asRecord(tx);
    if (!txRecord) {
        return null;
    }
    const metaRecord = asRecord(txRecord.meta);
    if (!metaRecord) {
        return null;
    }
    return asStringArray(metaRecord.logMessages) ?? asStringArray(metaRecord.log_messages);
}

// Mock events decoding
export function decodeMockEvents(events: unknown[]): EventEnvelope[] {
    return events.map(item => {
        const record = asRecord(item);
        if (!record) {
            throw new Error('mock event envelope is not an object');
        }

        const event = asRecord(record.event);
        if (!event) {
            throw new Error('mock event envelope.event must be an object');
        }

        return {
            slot: parseInteger(record.slot, 0),
            timestamp: parseInteger(record.timestamp, 0),
            event: normalizeProgramEventFromObject(event),
        };
    });
}

export function normalizeProgramEventFromObject(event: Record<string, unknown>): ProgramEvent {
    const name = event.event;
    if (typeof name !== 'string') {
        throw new Error('mock event missing event discriminator string');
    }

    switch (name) {
        case 'task_created':
            return {
                event: 'task_created',
                task_id: parseInteger(event.task_id, 0),
                poster: parseByteArray(event.poster, 32),
                judge: parseByteArray(event.judge, 32),
                reward: parseInteger(event.reward, 0),
                category: parseInteger(event.category, 0),
                deadline: parseInteger(event.deadline, 0),
            };
        case 'submission_received':
            return {
                event: 'submission_received',
                task_id: parseInteger(event.task_id, 0),
                agent: parseByteArray(event.agent, 32),
                result_ref: parseString(event.result_ref),
                trace_ref: parseString(event.trace_ref),
                submission_slot: parseInteger(event.submission_slot, 0),
            };
        case 'task_judged':
            return {
                event: 'task_judged',
                task_id: parseInteger(event.task_id, 0),
                winner: parseByteArray(event.winner, 32),
                score: parseInteger(event.score, 0),
                agent_payout: parseInteger(event.agent_payout, 0),
                judge_fee: parseInteger(event.judge_fee, 0),
                protocol_fee: parseInteger(event.protocol_fee, 0),
            };
        case 'task_refunded':
            return {
                event: 'task_refunded',
                task_id: parseInteger(event.task_id, 0),
                reason: parseInteger(event.reason, 0),
                amount: parseInteger(event.amount, 0),
            };
        case 'judge_registered':
            return {
                event: 'judge_registered',
                judge: parseByteArray(event.judge, 32),
                stake: parseInteger(event.stake, 0),
                categories: parseByteArray(event.categories),
            };
        case 'task_applied':
            return {
                event: 'task_applied',
                task_id: parseInteger(event.task_id, 0),
                agent: parseByteArray(event.agent, 32),
                stake: parseInteger(event.stake, 0),
                slot: parseInteger(event.slot, 0),
            };
        case 'task_cancelled':
            return {
                event: 'task_cancelled',
                task_id: parseInteger(event.task_id, 0),
                poster: parseByteArray(event.poster, 32),
                refund_amount: parseInteger(event.refund_amount, 0),
                protocol_fee: parseInteger(event.protocol_fee, 0),
            };
        case 'judge_unstaked':
            return {
                event: 'judge_unstaked',
                judge: parseByteArray(event.judge, 32),
                returned_stake: parseInteger(event.returned_stake, 0),
                categories: parseByteArray(event.categories),
            };
        default:
            throw new Error(`unsupported mock event type: ${name}`);
    }
}

// Event parsing from logs
export function parseEventsFromLogs(logs: string[]): ProgramEvent[] {
    const events: ProgramEvent[] = [];
    for (const line of logs) {
        const index = line.indexOf('Program data: ');
        if (index < 0) {
            continue;
        }

        const encoded = line.slice(index + 'Program data: '.length).trim();
        const bytes = decodeBase64(encoded);
        if (bytes.length < EVENT_IX_TAG_LE.length + 1) {
            continue;
        }

        if (!hasEventPrefix(bytes)) {
            continue;
        }

        const discriminator = bytes[EVENT_IX_TAG_LE.length];
        if (discriminator === undefined) {
            continue;
        }
        const payload = bytes.subarray(EVENT_IX_TAG_LE.length + 1);
        events.push(decodeProgramEvent(discriminator, payload));
    }
    return events;
}

export function hasEventPrefix(bytes: Uint8Array): boolean {
    for (let i = 0; i < EVENT_IX_TAG_LE.length; i += 1) {
        if (bytes[i] !== EVENT_IX_TAG_LE[i]) {
            return false;
        }
    }
    return true;
}

export function decodeProgramEvent(discriminator: number, payload: Uint8Array): ProgramEvent {
    const cursor = new ByteCursor(payload);

    switch (discriminator) {
        case 0x01:
            return {
                event: 'task_created',
                task_id: cursor.readU64(),
                poster: cursor.readPubkey(),
                judge: cursor.readPubkey(),
                reward: cursor.readU64(),
                category: cursor.readU8(),
                deadline: cursor.readI64(),
            };
        case 0x02:
            return {
                event: 'submission_received',
                task_id: cursor.readU64(),
                agent: cursor.readPubkey(),
                result_ref: cursor.readString(),
                trace_ref: cursor.readString(),
                submission_slot: cursor.readU64(),
            };
        case 0x03:
            return {
                event: 'task_judged',
                task_id: cursor.readU64(),
                winner: cursor.readPubkey(),
                score: cursor.readU8(),
                agent_payout: cursor.readU64(),
                judge_fee: cursor.readU64(),
                protocol_fee: cursor.readU64(),
            };
        case 0x04:
            return {
                event: 'task_refunded',
                task_id: cursor.readU64(),
                reason: cursor.readU8(),
                amount: cursor.readU64(),
            };
        case 0x05:
            return {
                event: 'judge_registered',
                judge: cursor.readPubkey(),
                stake: cursor.readU64(),
                categories: cursor.readU8Vec(),
            };
        case 0x06:
            return {
                event: 'task_applied',
                task_id: cursor.readU64(),
                agent: cursor.readPubkey(),
                stake: cursor.readU64(),
                slot: cursor.readU64(),
            };
        case 0x07:
            return {
                event: 'task_cancelled',
                task_id: cursor.readU64(),
                poster: cursor.readPubkey(),
                refund_amount: cursor.readU64(),
                protocol_fee: cursor.readU64(),
            };
        case 0x08:
            return {
                event: 'judge_unstaked',
                judge: cursor.readPubkey(),
                returned_stake: cursor.readU64(),
                categories: cursor.readU8Vec(),
            };
        default:
            throw new Error(`unsupported event discriminator: ${discriminator}`);
    }
}
