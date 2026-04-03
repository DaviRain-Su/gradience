import type pg from 'pg';
import type {
    TaskApi,
    SubmissionApi,
    ReputationApi,
    AgentProfileApi,
    AgentRowApi,
    JudgePoolEntryApi,
    TaskListParams,
} from '../types';

export interface DataStore {
    // Tasks
    listTasks(params: TaskListParams & { reward_min?: number; reward_max?: number }): Promise<TaskApi[]>;
    getTask(id: number): Promise<TaskApi | null>;
    createTask(task: TaskApi): Promise<TaskApi>;
    getSubmissions(taskId: number): Promise<SubmissionApi[]>;

    // Agents
    getReputation(agent: string): Promise<ReputationApi | null>;
    getProfile(agent: string): Promise<AgentProfileApi | null>;
    upsertProfile(agent: string, data: Partial<AgentProfileApi>): Promise<void>;

    // Discovery
    getAgentRows(): Promise<AgentRowApi[]>;
    getJudgePool(category: number): Promise<JudgePoolEntryApi[]>;

    // Stats
    getStats(): Promise<{
        tasks_total: number;
        tasks_open: number;
        tasks_completed: number;
        agents_total: number;
        total_rewards_lamports: number;
    }>;
}

// ── In-Memory Implementation (backward compatible) ──

export class InMemoryStore implements DataStore {
    constructor(
        private tasks: Map<number, TaskApi>,
        private submissions: Map<number, SubmissionApi[]>,
        private reputation: Map<string, ReputationApi>,
        private profiles: Map<string, AgentProfileApi>,
        private agentRows: Map<string, AgentRowApi>,
        private judgePools: Map<number, JudgePoolEntryApi[]>,
    ) {}

    async listTasks(params: TaskListParams & { reward_min?: number; reward_max?: number }): Promise<TaskApi[]> {
        let filtered = Array.from(this.tasks.values());
        const stateFilter = params.status ?? params.state;
        if (stateFilter) filtered = filtered.filter((t) => t.state === stateFilter);
        if (params.category !== undefined) filtered = filtered.filter((t) => t.category === params.category);
        if (params.poster) filtered = filtered.filter((t) => t.poster === params.poster);
        if (params.mint) filtered = filtered.filter((t) => t.mint === params.mint);
        if (params.reward_min !== undefined) filtered = filtered.filter((t) => t.reward >= params.reward_min!);
        if (params.reward_max !== undefined) filtered = filtered.filter((t) => t.reward <= params.reward_max!);
        const offset = params.offset ?? 0;
        const limit = params.limit ?? filtered.length;
        return filtered.slice(offset, offset + limit);
    }

    async getTask(id: number): Promise<TaskApi | null> {
        return this.tasks.get(id) ?? null;
    }

    async createTask(task: TaskApi): Promise<TaskApi> {
        this.tasks.set(task.task_id, task);
        return task;
    }

    async getSubmissions(taskId: number): Promise<SubmissionApi[]> {
        return this.submissions.get(taskId) ?? [];
    }

    async getReputation(agent: string): Promise<ReputationApi | null> {
        return this.reputation.get(agent) ?? null;
    }

    async getProfile(agent: string): Promise<AgentProfileApi | null> {
        return this.profiles.get(agent) ?? null;
    }

    async upsertProfile(agent: string, data: Partial<AgentProfileApi>): Promise<void> {
        const existing = this.profiles.get(agent);
        const updated: AgentProfileApi = {
            agent,
            display_name: data.display_name ?? existing?.display_name ?? '',
            bio: data.bio ?? existing?.bio ?? '',
            links: data.links ?? existing?.links ?? {},
            onchain_ref: data.onchain_ref ?? existing?.onchain_ref ?? null,
            publish_mode: (data.publish_mode as AgentProfileApi['publish_mode']) ?? existing?.publish_mode ?? 'manual',
            updated_at: Math.floor(Date.now() / 1000),
        };
        this.profiles.set(agent, updated);
    }

    async getAgentRows(): Promise<AgentRowApi[]> {
        return Array.from(this.agentRows.values());
    }

    async getJudgePool(_category: number): Promise<JudgePoolEntryApi[]> {
        return Array.from(this.agentRows.values()) as unknown as JudgePoolEntryApi[];
    }

    async getStats() {
        const all = Array.from(this.tasks.values());
        return {
            tasks_total: this.tasks.size,
            tasks_open: all.filter((t) => t.state === 'open').length,
            tasks_completed: all.filter((t) => t.state === 'completed').length,
            agents_total: this.reputation.size,
            total_rewards_lamports: all.reduce((sum, t) => sum + t.reward, 0),
        };
    }
}

// ── PostgreSQL Implementation ──

export class PgStore implements DataStore {
    constructor(private pool: pg.Pool) {}

    async listTasks(params: TaskListParams & { reward_min?: number; reward_max?: number }): Promise<TaskApi[]> {
        const conditions: string[] = [];
        const values: unknown[] = [];
        let idx = 1;

        const stateFilter = params.status ?? params.state;
        if (stateFilter) { conditions.push(`state = $${idx++}`); values.push(stateFilter); }
        if (params.category !== undefined) { conditions.push(`category = $${idx++}`); values.push(params.category); }
        if (params.poster) { conditions.push(`poster = $${idx++}`); values.push(params.poster); }
        if (params.mint) { conditions.push(`mint = $${idx++}`); values.push(params.mint); }
        if (params.reward_min !== undefined) { conditions.push(`reward >= $${idx++}`); values.push(params.reward_min); }
        if (params.reward_max !== undefined) { conditions.push(`reward <= $${idx++}`); values.push(params.reward_max); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = params.offset ?? 0;
        const limit = params.limit ?? 100;

        const sql = `SELECT * FROM tasks ${where} ORDER BY task_id LIMIT $${idx++} OFFSET $${idx++}`;
        values.push(limit, offset);

        const { rows } = await this.pool.query(sql, values);
        return rows.map(mapTaskRow);
    }

    async getTask(id: number): Promise<TaskApi | null> {
        const { rows } = await this.pool.query('SELECT * FROM tasks WHERE task_id = $1', [id]);
        return rows[0] ? mapTaskRow(rows[0]) : null;
    }

    async createTask(task: TaskApi): Promise<TaskApi> {
        const { rows } = await this.pool.query(
            `INSERT INTO tasks (task_id, poster, judge, judge_mode, reward, mint, min_stake, state, category, eval_ref, deadline, judge_deadline, submission_count, winner, created_at, slot)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
             RETURNING *`,
            [task.task_id, task.poster, task.judge, task.judge_mode, task.reward, task.mint, task.min_stake, task.state, task.category, task.eval_ref, task.deadline, task.judge_deadline, task.submission_count, task.winner, task.created_at, task.slot]
        );
        return mapTaskRow(rows[0]);
    }

    async getSubmissions(taskId: number): Promise<SubmissionApi[]> {
        const { rows } = await this.pool.query('SELECT * FROM submissions WHERE task_id = $1', [taskId]);
        return rows.map(mapSubmissionRow);
    }

    async getReputation(agent: string): Promise<ReputationApi | null> {
        const { rows } = await this.pool.query('SELECT * FROM reputation WHERE agent = $1', [agent]);
        return rows[0] ? mapReputationRow(rows[0]) : null;
    }

    async getProfile(agent: string): Promise<AgentProfileApi | null> {
        const { rows } = await this.pool.query('SELECT * FROM agent_profiles WHERE agent = $1', [agent]);
        return rows[0] ? mapProfileRow(rows[0]) : null;
    }

    async upsertProfile(agent: string, data: Partial<AgentProfileApi>): Promise<void> {
        const now = Math.floor(Date.now() / 1000);
        await this.pool.query(
            `INSERT INTO agent_profiles (agent, display_name, bio, links_website, links_github, links_x, onchain_ref, publish_mode, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (agent) DO UPDATE SET
               display_name = COALESCE(NULLIF($2, ''), agent_profiles.display_name),
               bio = COALESCE(NULLIF($3, ''), agent_profiles.bio),
               links_website = COALESCE($4, agent_profiles.links_website),
               links_github = COALESCE($5, agent_profiles.links_github),
               links_x = COALESCE($6, agent_profiles.links_x),
               onchain_ref = COALESCE($7, agent_profiles.onchain_ref),
               publish_mode = COALESCE(NULLIF($8, ''), agent_profiles.publish_mode),
               updated_at = $9`,
            [agent, data.display_name ?? '', data.bio ?? '', data.links?.website ?? null, data.links?.github ?? null, data.links?.x ?? null, data.onchain_ref ?? null, data.publish_mode ?? 'manual', now]
        );
    }

    async getAgentRows(): Promise<AgentRowApi[]> {
        const { rows } = await this.pool.query('SELECT * FROM agent_rows');
        return rows.map((r: Record<string, unknown>) => ({
            agent: r.agent as string,
            weight: Number(r.weight),
            reputation: r.rep_avg_score != null ? {
                global_avg_score: Number(r.rep_avg_score),
                global_completed: Number(r.rep_completed),
                win_rate: Number(r.rep_win_rate),
            } : null,
        }));
    }

    async getJudgePool(category: number): Promise<JudgePoolEntryApi[]> {
        const { rows } = await this.pool.query(
            'SELECT judge, stake, weight FROM judge_pool_entries WHERE category = $1',
            [category]
        );
        return rows.map((r: Record<string, unknown>) => ({
            judge: r.judge as string,
            stake: Number(r.stake),
            weight: Number(r.weight),
        }));
    }

    async getStats() {
        const { rows } = await this.pool.query(`
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE state = 'open') as open,
                COUNT(*) FILTER (WHERE state = 'completed') as completed,
                COALESCE(SUM(reward), 0) as total_rewards
            FROM tasks
        `);
        const { rows: agentRows } = await this.pool.query('SELECT COUNT(*) as count FROM reputation');
        const r = rows[0];
        return {
            tasks_total: Number(r.total),
            tasks_open: Number(r.open),
            tasks_completed: Number(r.completed),
            agents_total: Number(agentRows[0].count),
            total_rewards_lamports: Number(r.total_rewards),
        };
    }
}

// ── Row mappers ──

function mapTaskRow(r: Record<string, unknown>): TaskApi {
    return {
        task_id: Number(r.task_id),
        poster: r.poster as string,
        judge: r.judge as string,
        judge_mode: r.judge_mode as TaskApi['judge_mode'],
        reward: Number(r.reward),
        mint: r.mint as string,
        min_stake: Number(r.min_stake),
        state: r.state as TaskApi['state'],
        category: Number(r.category),
        eval_ref: r.eval_ref as string,
        deadline: Number(r.deadline),
        judge_deadline: Number(r.judge_deadline),
        submission_count: Number(r.submission_count),
        winner: (r.winner as string) ?? null,
        created_at: Number(r.created_at),
        slot: Number(r.slot),
    };
}

function mapSubmissionRow(r: Record<string, unknown>): SubmissionApi {
    return {
        task_id: Number(r.task_id),
        agent: r.agent as string,
        result_ref: r.result_ref as string,
        trace_ref: r.trace_ref as string,
        runtime_provider: r.runtime_provider as string,
        runtime_model: r.runtime_model as string,
        runtime_runtime: r.runtime_runtime as string,
        runtime_version: r.runtime_version as string,
        submission_slot: Number(r.submission_slot),
        submitted_at: Number(r.submitted_at),
    };
}

function mapReputationRow(r: Record<string, unknown>): ReputationApi {
    return {
        agent: r.agent as string,
        global_avg_score: Number(r.global_avg_score),
        global_win_rate: Number(r.global_win_rate),
        global_completed: Number(r.global_completed),
        global_total_applied: Number(r.global_total_applied),
        total_earned: Number(r.total_earned),
        updated_slot: Number(r.updated_slot),
    };
}

function mapProfileRow(r: Record<string, unknown>): AgentProfileApi {
    return {
        agent: r.agent as string,
        display_name: r.display_name as string,
        bio: r.bio as string,
        links: {
            website: r.links_website as string | undefined,
            github: r.links_github as string | undefined,
            x: r.links_x as string | undefined,
        },
        onchain_ref: (r.onchain_ref as string) ?? null,
        publish_mode: r.publish_mode as AgentProfileApi['publish_mode'],
        updated_at: Number(r.updated_at),
    };
}
