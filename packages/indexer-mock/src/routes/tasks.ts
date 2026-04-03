import { Hono } from 'hono';
import type { TaskApi, SubmissionApi, TaskListParams } from '../types';

export function createTasksRouter(
    tasks: Map<number, TaskApi>,
    submissions: Map<number, SubmissionApi[]>,
    broadcast: (event: string, payload: unknown) => void
) {
    const router = new Hono();

    // GET /api/tasks - list tasks with filtering
    router.get('/', (c) => {
        const query = c.req.query();

        const params: TaskListParams & { reward_min?: number; reward_max?: number } = {
            status: query.status as TaskListParams['status'],
            state: query.state as TaskListParams['state'],
            category: query.category !== undefined ? Number(query.category) : undefined,
            mint: query.mint,
            poster: query.poster,
            limit: query.limit !== undefined ? Number(query.limit) : undefined,
            offset: query.offset !== undefined ? Number(query.offset) : undefined,
            reward_min: query.reward_min !== undefined ? Number(query.reward_min) : undefined,
            reward_max: query.reward_max !== undefined ? Number(query.reward_max) : undefined,
        };

        let filtered = Array.from(tasks.values());

        const stateFilter = params.status ?? params.state;
        if (stateFilter) {
            filtered = filtered.filter((t) => t.state === stateFilter);
        }

        if (params.category !== undefined) {
            filtered = filtered.filter((t) => t.category === params.category);
        }

        if (params.poster) {
            filtered = filtered.filter((t) => t.poster === params.poster);
        }

        if (params.mint) {
            filtered = filtered.filter((t) => t.mint === params.mint);
        }

        if (params.reward_min !== undefined) {
            filtered = filtered.filter((t) => t.reward >= params.reward_min!);
        }

        if (params.reward_max !== undefined) {
            filtered = filtered.filter((t) => t.reward <= params.reward_max!);
        }

        const offset = params.offset ?? 0;
        const limit = params.limit ?? filtered.length;
        const paginated = filtered.slice(offset, offset + limit);

        return c.json(paginated);
    });

    // GET /api/tasks/:id - get single task
    router.get('/:id', (c) => {
        const id = Number(c.req.param('id'));
        const task = tasks.get(id);
        if (!task) {
            return c.json({ error: 'Task not found' }, 404);
        }
        return c.json(task);
    });

    // POST /api/tasks - create a new task
    router.post('/', async (c) => {
        const body = await c.req.json<Partial<TaskApi>>();
        const now = Math.floor(Date.now() / 1000);

        const taskId = body.task_id ?? Math.max(0, ...tasks.keys()) + 1;

        if (tasks.has(taskId)) {
            return c.json({ error: `Task ${taskId} already exists` }, 409);
        }

        const task: TaskApi = {
            task_id: taskId,
            poster: body.poster ?? '11111111111111111111111111111111',
            judge: body.judge ?? '11111111111111111111111111111111',
            judge_mode: (body.judge_mode as TaskApi['judge_mode']) ?? 'designated',
            reward: body.reward ?? 0,
            mint: body.mint ?? '11111111111111111111111111111112',
            min_stake: body.min_stake ?? 0,
            state: (body.state as TaskApi['state']) ?? 'open',
            category: body.category ?? 0,
            eval_ref: body.eval_ref ?? '',
            deadline: body.deadline ?? now + 86400,
            judge_deadline: body.judge_deadline ?? now + 172800,
            submission_count: body.submission_count ?? 0,
            winner: body.winner ?? null,
            created_at: body.created_at ?? now,
            slot: body.slot ?? 250_000_000 + Math.floor(Math.random() * 1_000_000),
        };

        tasks.set(taskId, task);
        broadcast('task_created', task);

        return c.json(task, 201);
    });

    // GET /api/tasks/:id/submissions
    router.get('/:id/submissions', (c) => {
        const id = Number(c.req.param('id'));
        const task = tasks.get(id);
        if (!task) {
            return c.json({ error: 'Task not found' }, 404);
        }

        const sort = c.req.query('sort') as 'score' | 'slot' | undefined;
        let list = submissions.get(id) ?? [];
        list = [...list];

        if (sort === 'score') {
            list.sort((a, b) => a.agent.localeCompare(b.agent));
        } else if (sort === 'slot') {
            list.sort((a, b) => b.submission_slot - a.submission_slot);
        }

        return c.json(list);
    });

    return router;
}
