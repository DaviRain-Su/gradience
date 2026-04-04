import type { Env, TaskRow } from '../types.js';

const TASK_STATE_OPEN = 0;
const TASK_STATE_COMPLETED = 1;
const TASK_STATE_REFUNDED = 2;
const JUDGE_MODE_DESIGNATED = 0;
const JUDGE_MODE_POOL = 1;
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function mapTask(task: TaskRow): Record<string, unknown> {
    return {
        task_id: task.task_id,
        poster: task.poster,
        judge: task.judge,
        judge_mode:
            task.judge_mode === JUDGE_MODE_DESIGNATED
                ? 'designated'
                : task.judge_mode === JUDGE_MODE_POOL
                  ? 'pool'
                  : 'unknown',
        reward: task.reward,
        mint: task.mint,
        min_stake: task.min_stake,
        state:
            task.state === TASK_STATE_OPEN
                ? 'open'
                : task.state === TASK_STATE_COMPLETED
                  ? 'completed'
                  : task.state === TASK_STATE_REFUNDED
                    ? 'refunded'
                    : 'unknown',
        category: task.category,
        eval_ref: task.eval_ref,
        deadline: task.deadline,
        judge_deadline: task.judge_deadline,
        submission_count: task.submission_count,
        winner: task.winner,
        created_at: task.created_at,
        slot: task.slot,
    };
}

export function parseState(value: string | null): number | null {
    if (value === null) {
        return null;
    }
    if (value === 'open') {
        return TASK_STATE_OPEN;
    }
    if (value === 'completed') {
        return TASK_STATE_COMPLETED;
    }
    if (value === 'refunded') {
        return TASK_STATE_REFUNDED;
    }
    return null;
}

export function parseUnsignedIntQueryParam(value: string | null): number | null {
    if (value === null) {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        return null;
    }
    return parsed;
}

export function parsePositiveInt(value: string): number | null {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        return null;
    }
    return parsed;
}

export function parseTaskId(value: string): number | string {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
        return 'invalid task_id';
    }
    if (parsed < 0) {
        return 'task_id must be >= 0';
    }
    return parsed;
}

export function parseTaskSort(value: string | null): 'task_id_desc' | 'task_id_asc' | null {
    if (value === null || value === 'task_id_desc' || value === 'desc') {
        return 'task_id_desc';
    }
    if (value === 'task_id_asc' || value === 'asc') {
        return 'task_id_asc';
    }
    return null;
}

export function parseSubmissionSort(value: string | null): 'score' | 'slot' | null {
    if (value === null || value === 'score' || value === 'score_desc') {
        return 'score';
    }
    if (value === 'slot' || value === 'slot_desc' || value === 'submission_slot_desc') {
        return 'slot';
    }
    return null;
}

export function resolveTaskOffset(offset: number | null, page: number | null, limit: number): number | null {
    if (offset !== null) {
        return offset;
    }
    if (page === null) {
        return 0;
    }
    if (page < 1) {
        return null;
    }
    return (page - 1) * limit;
}

export function parseInteger(value: unknown, fallback: number): number {
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

export function parseString(value: unknown): string {
    if (typeof value !== 'string') {
        throw new Error('expected string field');
    }
    return value;
}

export function parseByteArray(value: unknown, exactLength?: number): number[] {
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

export function asRecord(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

export function asArray(value: unknown): unknown[] | null {
    return Array.isArray(value) ? value : null;
}

export function asStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
        return null;
    }
    if (value.some(entry => typeof entry !== 'string')) {
        return null;
    }
    return value as string[];
}

export function decodeBase64(value: string): Uint8Array {
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export function pubkeyToString(bytes: number[]): string {
    if (bytes.length !== 32) {
        throw new Error('pubkey must be 32 bytes');
    }
    return base58Encode(new Uint8Array(bytes));
}

export function base58Encode(bytes: Uint8Array): string {
    if (bytes.length === 0) {
        return '';
    }

    const digits = [0];
    for (const value of bytes) {
        let carry = value;
        for (let i = 0; i < digits.length; i += 1) {
            const n = (digits[i] ?? 0) * 256 + carry;
            digits[i] = n % 58;
            carry = Math.floor(n / 58);
        }
        while (carry > 0) {
            digits.push(carry % 58);
            carry = Math.floor(carry / 58);
        }
    }

    let result = '';
    for (const value of bytes) {
        if (value === 0) {
            result += BASE58_ALPHABET[0];
        } else {
            break;
        }
    }

    for (let i = digits.length - 1; i >= 0; i -= 1) {
        const index = digits[i];
        if (index === undefined) {
            continue;
        }
        result += BASE58_ALPHABET[index] ?? '';
    }

    return result;
}

export function jsonResponse(data: unknown, status = 200, env?: Env): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'content-type': 'application/json',
            ...corsHeaders(env),
        },
    });
}

export function errorResponse(status: number, error: string, env?: Env): Response {
    return jsonResponse({ error }, status, env);
}

export function validateWebhookAuth(request: Request, env: Env): Response | null {
    const expectedToken = env.WEBHOOK_AUTH_TOKEN?.trim();
    if (!expectedToken) {
        return errorResponse(503, 'webhook auth not configured', env);
    }

    const providedToken = extractWebhookToken(request);
    if (!providedToken) {
        return errorResponse(401, 'missing webhook authorization', env);
    }

    if (!constantTimeEquals(providedToken, expectedToken)) {
        return errorResponse(401, 'invalid webhook authorization', env);
    }

    return null;
}

export function extractWebhookToken(request: Request): string | null {
    const authorization = request.headers.get('authorization');
    if (authorization && authorization.toLowerCase().startsWith('bearer ')) {
        return authorization.slice(7).trim();
    }

    const webhookToken = request.headers.get('x-webhook-token');
    return webhookToken ? webhookToken.trim() : null;
}

export function constantTimeEquals(left: string, right: string): boolean {
    if (left.length !== right.length) {
        return false;
    }
    let result = 0;
    for (let i = 0; i < left.length; i += 1) {
        result |= left.charCodeAt(i) ^ right.charCodeAt(i);
    }
    return result === 0;
}

export function internalErrorResponse(context: string, error: unknown, env?: Env): Response {
    console.error(`[indexer-worker:${context}]`, toErrorMessage(error));
    return errorResponse(500, 'internal error', env);
}

export function corsHeaders(env?: Env): Record<string, string> {
    const allowOrigin = env?.CORS_ALLOW_ORIGIN?.trim() || '*';
    return {
        'access-control-allow-origin': allowOrigin,
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'content-type,authorization,x-webhook-token',
    };
}

export function toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

export function bigintToSafeNumber(value: bigint): number {
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    const min = BigInt(Number.MIN_SAFE_INTEGER);
    if (value > max || value < min) {
        throw new Error('numeric field exceeds safe integer range');
    }
    return Number(value);
}
