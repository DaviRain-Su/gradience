import type { D1Database, ProgramEvent, EventEnvelope } from '../types';
import { run, queryFirst } from '../db/operations';

const TASK_STATE_OPEN = 0;
const TASK_STATE_COMPLETED = 1;
const TASK_STATE_REFUNDED = 2;
const JUDGE_MODE_DESIGNATED = 0;

function pubkeyToString(bytes: number[]): string {
    if (bytes.length !== 32) {
        throw new Error('pubkey must be 32 bytes');
    }
    return base58Encode(new Uint8Array(bytes));
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

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

async function ensureTaskExists(db: D1Database, taskId: number, slot: number, timestamp: number): Promise<void> {
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

export async function applyEvent(db: D1Database, envelope: EventEnvelope): Promise<void> {
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
