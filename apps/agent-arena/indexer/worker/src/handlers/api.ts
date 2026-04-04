import type {
    Env,
    TaskRow,
    SubmissionRow,
    ReputationRow,
    JudgePoolRow,
} from '../types';

import {
    queryAll,
    queryFirst,
} from '../db/operations';

import {
    jsonResponse,
    errorResponse,
    internalErrorResponse,
    parseState,
    parseUnsignedIntQueryParam,
    parsePositiveInt,
    parseTaskId,
    parseTaskSort,
    parseSubmissionSort,
    resolveTaskOffset,
    mapTask,
    LAMPORTS_PER_SOL,
} from '../utils';

export async function handleGetTasks(url: URL, env: Env): Promise<Response> {
    const statusValue = url.searchParams.get('status') ?? url.searchParams.get('state');
    const state = parseState(statusValue);
    if (statusValue !== null && state === null) {
        return errorResponse(400, 'invalid status value: expected open|completed|refunded');
    }

    const categoryRaw = url.searchParams.get('category');
    const categoryParsed = parseUnsignedIntQueryParam(categoryRaw);
    if (categoryRaw !== null && categoryParsed === null) {
        return errorResponse(400, 'category must be an integer');
    }
    const category = categoryParsed;
    if (category !== null && category > 7) {
        return errorResponse(400, 'category must be in range 0..=7');
    }

    const limitRaw = url.searchParams.get('limit');
    const limitParsed = parseUnsignedIntQueryParam(limitRaw);
    if (limitRaw !== null && limitParsed === null) {
        return errorResponse(400, 'limit must be an integer');
    }
    const limit = limitParsed ?? 20;
    if (limit < 1 || limit > 100) {
        return errorResponse(400, 'limit must be in range 1..=100');
    }

    const offsetRaw = url.searchParams.get('offset');
    const offset = parseUnsignedIntQueryParam(offsetRaw);
    if (offsetRaw !== null && offset === null) {
        return errorResponse(400, 'offset must be an integer');
    }

    const pageRaw = url.searchParams.get('page');
    const page = parseUnsignedIntQueryParam(pageRaw);
    if (pageRaw !== null && page === null) {
        return errorResponse(400, 'page must be an integer');
    }

    const offsetResult = resolveTaskOffset(offset, page, limit);
    if (offsetResult === null) {
        return errorResponse(400, 'page must be >= 1');
    }
    const sortParam = url.searchParams.get('sort');
    const sort = parseTaskSort(sortParam);
    if (sort === null) {
        return errorResponse(400, `invalid sort value: ${sortParam} (expected task_id_desc|task_id_asc)`);
    }
    const finalOffset = offsetResult;

    try {
        const orderClause = sort === 'task_id_asc' ? 'ASC' : 'DESC';
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
             ORDER BY task_id ${orderClause}
             LIMIT ?5 OFFSET ?6`,
            [state, category, url.searchParams.get('mint'), url.searchParams.get('poster'), limit, finalOffset],
        );
        return jsonResponse(rows.map(mapTask));
    } catch (error) {
        return internalErrorResponse('get_tasks', error, env);
    }
}

export async function handleGetTaskById(taskIdRaw: string, env: Env): Promise<Response> {
    const taskIdResult = parseTaskId(taskIdRaw);
    if (typeof taskIdResult === 'string') {
        return errorResponse(400, taskIdResult);
    }
    const taskId = taskIdResult;

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

export async function handleGetTaskSubmissions(taskIdRaw: string, url: URL, env: Env): Promise<Response> {
    const taskIdResult = parseTaskId(taskIdRaw);
    if (typeof taskIdResult === 'string') {
        return errorResponse(400, taskIdResult);
    }
    const taskId = taskIdResult;

    const sortParam = url.searchParams.get('sort');
    const sort = parseSubmissionSort(sortParam);
    if (sort === null) {
        return errorResponse(400, `invalid sort value: ${sortParam} (expected score|slot)`);
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

export async function handleGetReputation(agent: string, env: Env): Promise<Response> {
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

export async function handleGetJudgePool(categoryRaw: string, env: Env): Promise<Response> {
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
