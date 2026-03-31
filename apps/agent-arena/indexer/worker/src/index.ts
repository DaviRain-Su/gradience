const EVENT_IX_TAG_LE = new Uint8Array([0x1d, 0x9a, 0xcb, 0x51, 0x2e, 0xa5, 0x45, 0xe4]);
const LAMPORTS_PER_SOL = 1_000_000_000;

const TASK_STATE_OPEN = 0;
const TASK_STATE_COMPLETED = 1;
const TASK_STATE_REFUNDED = 2;
const JUDGE_MODE_DESIGNATED = 0;
const JUDGE_MODE_POOL = 1;

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    run(): Promise<unknown>;
}

interface D1Database {
    prepare(query: string): D1PreparedStatement;
}

interface Env {
    DB: D1Database;
    WEBHOOK_AUTH_TOKEN?: string;
    CORS_ALLOW_ORIGIN?: string;
}

type ProgramEvent =
    | {
          event: 'task_created';
          task_id: number;
          poster: number[];
          judge: number[];
          reward: number;
          category: number;
          deadline: number;
      }
    | {
          event: 'submission_received';
          task_id: number;
          agent: number[];
          result_ref: string;
          trace_ref: string;
          submission_slot: number;
      }
    | {
          event: 'task_judged';
          task_id: number;
          winner: number[];
          score: number;
          agent_payout: number;
          judge_fee: number;
          protocol_fee: number;
      }
    | {
          event: 'task_refunded';
          task_id: number;
          reason: number;
          amount: number;
      }
    | {
          event: 'judge_registered';
          judge: number[];
          stake: number;
          categories: number[];
      }
    | {
          event: 'task_applied';
          task_id: number;
          agent: number[];
          stake: number;
          slot: number;
      }
    | {
          event: 'task_cancelled';
          task_id: number;
          poster: number[];
          refund_amount: number;
          protocol_fee: number;
      }
    | {
          event: 'judge_unstaked';
          judge: number[];
          returned_stake: number;
          categories: number[];
      };

interface EventEnvelope {
    slot: number;
    timestamp: number;
    event: ProgramEvent;
}

interface WebhookTransaction {
    slot: number;
    timestamp: number;
    logs: string[];
}

interface TaskRow {
    task_id: number;
    poster: string;
    judge: string;
    judge_mode: number;
    reward: number;
    mint: string;
    min_stake: number;
    state: number;
    category: number;
    eval_ref: string;
    deadline: number;
    judge_deadline: number;
    submission_count: number;
    winner: string | null;
    created_at: number;
    slot: number;
}

interface SubmissionRow {
    task_id: number;
    agent: string;
    result_ref: string;
    trace_ref: string;
    runtime_provider: string;
    runtime_model: string;
    runtime_runtime: string;
    runtime_version: string;
    submission_slot: number;
    submitted_at: number;
}

interface ReputationRow {
    agent: string;
    global_avg_score: number;
    global_win_rate: number;
    global_completed: number;
    global_total_applied: number;
    total_earned: number;
    updated_slot: number;
}

interface JudgePoolRow {
    judge: string;
    stake: number;
    weight: number;
}

interface WorkerHandler {
    fetch(request: Request, env: Env): Promise<Response>;
}

const worker: WorkerHandler = {
    async fetch(request, env) {
        const url = new URL(request.url);
        const pathname = url.pathname;
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(env) });
        }

        if (request.method === 'GET' && pathname === '/healthz') {
            return jsonResponse({ ok: true });
        }

        if (
            request.method === 'POST' &&
            (pathname === '/webhook/triton' ||
                pathname === '/webhook/helius' ||
                pathname === '/webhook/events')
        ) {
            const authFailure = validateWebhookAuth(request, env);
            if (authFailure) {
                return authFailure;
            }
            return handleWebhook(request, env);
        }

        if (request.method === 'GET' && pathname === '/api/tasks') {
            return handleGetTasks(url, env);
        }

        const taskDetailsMatch = pathname.match(/^\/api\/tasks\/(\d+)$/);
        if (request.method === 'GET' && taskDetailsMatch && taskDetailsMatch[1]) {
            return handleGetTaskById(taskDetailsMatch[1], env);
        }

        const taskSubmissionsMatch = pathname.match(/^\/api\/tasks\/(\d+)\/submissions$/);
        if (request.method === 'GET' && taskSubmissionsMatch && taskSubmissionsMatch[1]) {
            return handleGetTaskSubmissions(taskSubmissionsMatch[1], url, env);
        }

        const agentReputationMatch = pathname.match(/^\/api\/agents\/([^/]+)\/reputation$/);
        if (request.method === 'GET' && agentReputationMatch && agentReputationMatch[1]) {
            return handleGetReputation(agentReputationMatch[1], env);
        }

        const legacyReputationMatch = pathname.match(/^\/api\/reputation\/([^/]+)$/);
        if (request.method === 'GET' && legacyReputationMatch && legacyReputationMatch[1]) {
            return handleGetReputation(legacyReputationMatch[1], env);
        }

        const judgePoolMatch = pathname.match(/^\/api\/judge-pool\/(\d+)$/);
        if (request.method === 'GET' && judgePoolMatch && judgePoolMatch[1]) {
            return handleGetJudgePool(judgePoolMatch[1], env);
        }

        return errorResponse(404, 'not found');
    },
};

export default worker;

async function handleWebhook(request: Request, env: Env): Promise<Response> {
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

async function handleGetTasks(url: URL, env: Env): Promise<Response> {
    const statusValue = url.searchParams.get('status') ?? url.searchParams.get('state');
    const state = parseState(statusValue);
    if (statusValue !== null && state === null) {
        return errorResponse(400, 'invalid status value: expected open|completed|refunded');
    }

    const categoryParam = url.searchParams.get('category');
    const category = parseOptionalInt(categoryParam);
    if (categoryParam !== null && (category === null || category < 0 || category > 7)) {
        return errorResponse(400, 'category must be in range 0..=7');
    }

    const limit = parseOptionalInt(url.searchParams.get('limit')) ?? 20;
    if (limit < 1 || limit > 100) {
        return errorResponse(400, 'limit must be in range 1..=100');
    }

    const offset = parseOptionalInt(url.searchParams.get('offset')) ?? 0;
    if (offset < 0) {
        return errorResponse(400, 'offset must be >= 0');
    }

    try {
        const rows = await queryAll<TaskRow>(
            env.DB,
            `SELECT
                task_id, poster, judge, judge_mode, reward, mint, min_stake, state,
                category, eval_ref, deadline, judge_deadline, submission_count, winner,
                created_at, slot
             FROM tasks
             WHERE (?1 IS NULL OR state = ?1)
               AND (?2 IS NULL OR category = ?2)
               AND (?3 IS NULL OR mint = ?3)
               AND (?4 IS NULL OR poster = ?4)
             ORDER BY task_id DESC
             LIMIT ?5 OFFSET ?6`,
            [state, category, url.searchParams.get('mint'), url.searchParams.get('poster'), limit, offset],
        );
        return jsonResponse(rows.map(mapTask));
    } catch (error) {
        return internalErrorResponse('get_tasks', error, env);
    }
}

async function handleGetTaskById(taskIdRaw: string, env: Env): Promise<Response> {
    const taskId = parsePositiveInt(taskIdRaw);
    if (taskId === null) {
        return errorResponse(400, 'invalid task_id');
    }

    try {
        const row = await queryFirst<TaskRow>(
            env.DB,
            `SELECT
                task_id, poster, judge, judge_mode, reward, mint, min_stake, state,
                category, eval_ref, deadline, judge_deadline, submission_count, winner,
                created_at, slot
             FROM tasks
             WHERE task_id = ?1`,
            [taskId],
        );
        if (!row) {
            return errorResponse(404, `task ${taskId} not found`);
        }
        return jsonResponse(mapTask(row));
    } catch (error) {
        return internalErrorResponse('get_task_by_id', error, env);
    }
}

async function handleGetTaskSubmissions(taskIdRaw: string, url: URL, env: Env): Promise<Response> {
    const taskId = parsePositiveInt(taskIdRaw);
    if (taskId === null) {
        return errorResponse(400, 'invalid task_id');
    }

    const sort = url.searchParams.get('sort');
    if (sort !== null && sort !== 'score' && sort !== 'slot') {
        return errorResponse(400, 'invalid sort value: expected score|slot');
    }

    try {
        const taskExists = await queryFirst<{ task_id: number }>(
            env.DB,
            'SELECT task_id FROM tasks WHERE task_id = ?1',
            [taskId],
        );
        if (!taskExists) {
            return errorResponse(404, `task ${taskId} not found`);
        }

        const sql =
            sort === 'slot'
                ? `SELECT
                       task_id, agent, result_ref, trace_ref, runtime_provider, runtime_model,
                       runtime_runtime, runtime_version, submission_slot, submitted_at
                   FROM submissions
                   WHERE task_id = ?1
                   ORDER BY submission_slot DESC`
                : `SELECT
                       s.task_id, s.agent, s.result_ref, s.trace_ref, s.runtime_provider, s.runtime_model,
                       s.runtime_runtime, s.runtime_version, s.submission_slot, s.submitted_at
                   FROM submissions s
                   LEFT JOIN reputations r ON r.agent = s.agent
                   WHERE s.task_id = ?1
                   ORDER BY COALESCE(r.global_avg_score, 0) DESC, s.submission_slot DESC`;

        const rows = await queryAll<SubmissionRow>(env.DB, sql, [taskId]);
        return jsonResponse(rows);
    } catch (error) {
        return internalErrorResponse('get_submissions', error, env);
    }
}

async function handleGetReputation(agent: string, env: Env): Promise<Response> {
    try {
        const row = await queryFirst<ReputationRow>(
            env.DB,
            `SELECT
                agent, global_avg_score, global_win_rate, global_completed,
                global_total_applied, total_earned, updated_slot
             FROM reputations
             WHERE agent = ?1`,
            [agent],
        );
        if (!row) {
            return errorResponse(404, `reputation for ${agent} not found`);
        }
        return jsonResponse(row);
    } catch (error) {
        return internalErrorResponse('get_reputation', error, env);
    }
}

async function handleGetJudgePool(categoryRaw: string, env: Env): Promise<Response> {
    const category = parsePositiveInt(categoryRaw);
    if (category === null || category > 7) {
        return errorResponse(400, 'category must be in range 0..=7');
    }

    try {
        const rows = await queryAll<JudgePoolRow>(
            env.DB,
            `SELECT
                m.judge,
                m.stake,
                (
                    MIN(m.stake / ?2, 1000) +
                    MIN(COALESCE(r.global_avg_score, 0) / 100, 100)
                ) AS weight
             FROM judge_pool_members m
             LEFT JOIN reputations r ON r.agent = m.judge
             WHERE m.category = ?1 AND m.active = 1
             ORDER BY weight DESC, m.judge ASC`,
            [category, LAMPORTS_PER_SOL],
        );
        return jsonResponse(rows);
    } catch (error) {
        return internalErrorResponse('get_judge_pool', error, env);
    }
}

function decodeWebhookPayload(payload: unknown): EventEnvelope[] {
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

function decodeTransactionsPayload(payload: unknown): WebhookTransaction[] {
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

function toWebhookTransaction(value: unknown): WebhookTransaction {
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

function extractLogsFromMeta(meta: unknown): string[] | null {
    const metaRecord = asRecord(meta);
    if (!metaRecord) {
        return null;
    }
    return asStringArray(metaRecord.logMessages) ?? asStringArray(metaRecord.log_messages);
}

function extractLogsFromTransaction(tx: unknown): string[] | null {
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

function decodeMockEvents(events: unknown[]): EventEnvelope[] {
    return events.map((item) => {
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

function normalizeProgramEventFromObject(event: Record<string, unknown>): ProgramEvent {
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

function parseEventsFromLogs(logs: string[]): ProgramEvent[] {
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

function hasEventPrefix(bytes: Uint8Array): boolean {
    for (let i = 0; i < EVENT_IX_TAG_LE.length; i += 1) {
        if (bytes[i] !== EVENT_IX_TAG_LE[i]) {
            return false;
        }
    }
    return true;
}

function decodeProgramEvent(discriminator: number, payload: Uint8Array): ProgramEvent {
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

async function applyEvent(db: D1Database, envelope: EventEnvelope): Promise<void> {
    const event = envelope.event;

    switch (event.event) {
        case 'task_created': {
            await run(
                db,
                `INSERT INTO tasks (
                    task_id, poster, judge, judge_mode, reward, mint, min_stake, state,
                    category, eval_ref, deadline, judge_deadline, submission_count, winner,
                    created_at, slot
                 ) VALUES (?1, ?2, ?3, ?4, ?5, 'SOL', 0, ?6, ?7, '', ?8, ?8, 0, NULL, ?9, ?10)
                 ON CONFLICT(task_id) DO UPDATE SET
                    poster = excluded.poster,
                    judge = excluded.judge,
                    reward = excluded.reward,
                    category = excluded.category,
                    deadline = excluded.deadline,
                    created_at = excluded.created_at,
                    slot = MAX(tasks.slot, excluded.slot)`,
                [
                    event.task_id,
                    pubkeyToString(event.poster),
                    pubkeyToString(event.judge),
                    JUDGE_MODE_DESIGNATED,
                    event.reward,
                    TASK_STATE_OPEN,
                    event.category,
                    event.deadline,
                    envelope.timestamp,
                    envelope.slot,
                ],
            );
            break;
        }
        case 'submission_received': {
            await ensureTaskExists(db, event.task_id, envelope.slot, envelope.timestamp);
            await run(
                db,
                `INSERT INTO submissions (
                    task_id, agent, result_ref, trace_ref, runtime_provider, runtime_model,
                    runtime_runtime, runtime_version, submission_slot, submitted_at
                 ) VALUES (?1, ?2, ?3, ?4, '', '', '', '', ?5, ?6)
                 ON CONFLICT(task_id, agent) DO UPDATE SET
                    result_ref = excluded.result_ref,
                    trace_ref = excluded.trace_ref,
                    submission_slot = excluded.submission_slot,
                    submitted_at = excluded.submitted_at`,
                [
                    event.task_id,
                    pubkeyToString(event.agent),
                    event.result_ref,
                    event.trace_ref,
                    event.submission_slot,
                    envelope.timestamp,
                ],
            );
            await run(
                db,
                `UPDATE tasks
                 SET submission_count = (
                        SELECT COUNT(*)
                        FROM submissions
                        WHERE task_id = ?1
                     ),
                     slot = MAX(slot, ?2)
                 WHERE task_id = ?1`,
                [event.task_id, envelope.slot],
            );
            break;
        }
        case 'task_judged': {
            await ensureTaskExists(db, event.task_id, envelope.slot, envelope.timestamp);
            await run(
                db,
                `UPDATE tasks
                 SET state = ?2, winner = ?3, slot = MAX(slot, ?4)
                 WHERE task_id = ?1`,
                [event.task_id, TASK_STATE_COMPLETED, pubkeyToString(event.winner), envelope.slot],
            );

            const winner = pubkeyToString(event.winner);
            const scoreBasisPoints = event.score * 100;
            await run(
                db,
                `INSERT INTO reputations (
                    agent, global_avg_score, global_win_rate, global_completed,
                    global_total_applied, total_earned, updated_slot
                 ) VALUES (?1, ?2, 10000, 1, 0, ?3, ?4)
                 ON CONFLICT(agent) DO UPDATE SET
                    global_avg_score = CAST(
                        ROUND(
                            ((reputations.global_avg_score * reputations.global_completed) + excluded.global_avg_score) * 1.0
                            / (reputations.global_completed + 1)
                        )
                        AS INTEGER
                    ),
                    global_completed = reputations.global_completed + 1,
                    global_win_rate = CASE
                        WHEN reputations.global_total_applied > 0 THEN ((reputations.global_completed + 1) * 10000) / reputations.global_total_applied
                        ELSE 10000
                    END,
                    total_earned = reputations.total_earned + excluded.total_earned,
                    updated_slot = MAX(reputations.updated_slot, excluded.updated_slot)`,
                [winner, scoreBasisPoints, event.agent_payout, envelope.slot],
            );

            const category = await queryFirst<{ category: number }>(
                db,
                'SELECT category FROM tasks WHERE task_id = ?1',
                [event.task_id],
            );
            if (category) {
                await run(
                    db,
                    `INSERT INTO reputation_by_category (agent, category, avg_score, completed)
                     VALUES (?1, ?2, ?3, 1)
                     ON CONFLICT(agent, category) DO UPDATE SET
                        avg_score = CAST(
                            ROUND(
                                ((reputation_by_category.avg_score * reputation_by_category.completed) + excluded.avg_score) * 1.0
                                / (reputation_by_category.completed + 1)
                            )
                            AS INTEGER
                        ),
                        completed = reputation_by_category.completed + 1`,
                    [winner, category.category, scoreBasisPoints],
                );
            }
            break;
        }
        case 'task_refunded':
        case 'task_cancelled': {
            await ensureTaskExists(db, event.task_id, envelope.slot, envelope.timestamp);
            await run(
                db,
                `UPDATE tasks
                 SET state = ?2, slot = MAX(slot, ?3)
                 WHERE task_id = ?1`,
                [event.task_id, TASK_STATE_REFUNDED, envelope.slot],
            );
            break;
        }
        case 'task_applied': {
            await run(
                db,
                `INSERT INTO reputations (
                    agent, global_avg_score, global_win_rate, global_completed,
                    global_total_applied, total_earned, updated_slot
                 ) VALUES (?1, 0, 0, 0, 1, 0, ?2)
                 ON CONFLICT(agent) DO UPDATE SET
                    global_total_applied = global_total_applied + 1,
                    updated_slot = MAX(updated_slot, excluded.updated_slot)`,
                [pubkeyToString(event.agent), envelope.slot],
            );
            break;
        }
        case 'judge_registered': {
            const judge = pubkeyToString(event.judge);
            await run(
                db,
                `INSERT INTO reputations (
                    agent, global_avg_score, global_win_rate, global_completed,
                    global_total_applied, total_earned, updated_slot
                 ) VALUES (?1, 0, 0, 0, 0, 0, ?2)
                 ON CONFLICT(agent) DO UPDATE SET
                    updated_slot = MAX(updated_slot, excluded.updated_slot)`,
                [judge, envelope.slot],
            );

            for (const category of event.categories) {
                await run(
                    db,
                    `INSERT INTO judge_pool_members (category, judge, stake, active, updated_slot)
                     VALUES (?1, ?2, ?3, 1, ?4)
                     ON CONFLICT(category, judge) DO UPDATE SET
                        stake = excluded.stake,
                        active = 1,
                        updated_slot = MAX(judge_pool_members.updated_slot, excluded.updated_slot)`,
                    [category, judge, event.stake, envelope.slot],
                );
            }
            break;
        }
        case 'judge_unstaked': {
            const judge = pubkeyToString(event.judge);
            for (const category of event.categories) {
                await run(
                    db,
                    `UPDATE judge_pool_members
                     SET active = 0, updated_slot = MAX(updated_slot, ?3)
                     WHERE category = ?1 AND judge = ?2`,
                    [category, judge, envelope.slot],
                );
            }
            break;
        }
    }
}

async function ensureTaskExists(
    db: D1Database,
    taskId: number,
    slot: number,
    timestamp: number,
): Promise<void> {
    await run(
        db,
        `INSERT INTO tasks (
            task_id, poster, judge, judge_mode, reward, mint, min_stake, state,
            category, eval_ref, deadline, judge_deadline, submission_count, winner, created_at, slot
         ) VALUES (?1, '11111111111111111111111111111111', '11111111111111111111111111111111', ?2, 0, 'SOL', 0, ?3, 0, '', 0, 0, 0, NULL, ?4, ?5)
         ON CONFLICT(task_id) DO NOTHING`,
        [taskId, JUDGE_MODE_DESIGNATED, TASK_STATE_OPEN, timestamp, slot],
    );
}

async function queryAll<T>(
    db: D1Database,
    sql: string,
    params: unknown[],
): Promise<T[]> {
    const response = await db.prepare(sql).bind(...params).all();
    return response.results as T[];
}

async function queryFirst<T>(
    db: D1Database,
    sql: string,
    params: unknown[],
): Promise<T | null> {
    const row = await db.prepare(sql).bind(...params).first();
    return (row as T | null) ?? null;
}

async function run(db: D1Database, sql: string, params: unknown[]): Promise<void> {
    await db.prepare(sql).bind(...params).run();
}

function mapTask(task: TaskRow): Record<string, unknown> {
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

function parseState(value: string | null): number | null {
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

function parseOptionalInt(value: string | null): number | null {
    if (value === null) {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
        return null;
    }
    return parsed;
}

function parsePositiveInt(value: string): number | null {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        return null;
    }
    return parsed;
}

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
    const out = value.map((entry) => {
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
    if (value.some((entry) => typeof entry !== 'string')) {
        return null;
    }
    return value as string[];
}

function decodeBase64(value: string): Uint8Array {
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function pubkeyToString(bytes: number[]): string {
    if (bytes.length !== 32) {
        throw new Error('pubkey must be 32 bytes');
    }
    return base58Encode(new Uint8Array(bytes));
}

function base58Encode(bytes: Uint8Array): string {
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

function validateWebhookAuth(request: Request, env: Env): Response | null {
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

function extractWebhookToken(request: Request): string | null {
    const authorization = request.headers.get('authorization');
    if (authorization && authorization.toLowerCase().startsWith('bearer ')) {
        return authorization.slice(7).trim();
    }

    const webhookToken = request.headers.get('x-webhook-token');
    return webhookToken ? webhookToken.trim() : null;
}

function constantTimeEquals(left: string, right: string): boolean {
    if (left.length !== right.length) {
        return false;
    }
    let result = 0;
    for (let i = 0; i < left.length; i += 1) {
        result |= left.charCodeAt(i) ^ right.charCodeAt(i);
    }
    return result === 0;
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
