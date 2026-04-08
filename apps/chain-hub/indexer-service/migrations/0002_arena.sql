-- Agent Arena Indexer Schema
-- Tasks, Submissions, Reputations, Judge Pools

BEGIN;

-- Tasks table
CREATE TABLE IF NOT EXISTS arena_tasks (
    task_id         BIGINT PRIMARY KEY,
    poster          VARCHAR(44) NOT NULL,
    judge           VARCHAR(44) NOT NULL,
    judge_mode      SMALLINT NOT NULL DEFAULT 1,
    reward          BIGINT NOT NULL DEFAULT 0,
    mint            VARCHAR(44) NOT NULL,
    min_stake       BIGINT NOT NULL DEFAULT 0,
    state           SMALLINT NOT NULL DEFAULT 0, -- 0=open, 1=completed, 2=refunded
    category        SMALLINT NOT NULL DEFAULT 0,
    eval_ref        VARCHAR(128) NOT NULL DEFAULT '',
    deadline        BIGINT NOT NULL DEFAULT 0,
    judge_deadline  BIGINT NOT NULL DEFAULT 0,
    submission_count SMALLINT NOT NULL DEFAULT 0,
    winner          VARCHAR(44) DEFAULT NULL,
    created_at      BIGINT NOT NULL DEFAULT 0,
    updated_at      BIGINT NOT NULL DEFAULT 0,
    bump            SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_arena_tasks_state ON arena_tasks(state);
CREATE INDEX IF NOT EXISTS idx_arena_tasks_category ON arena_tasks(category);
CREATE INDEX IF NOT EXISTS idx_arena_tasks_poster ON arena_tasks(poster);
CREATE INDEX IF NOT EXISTS idx_arena_tasks_judge ON arena_tasks(judge);
CREATE INDEX IF NOT EXISTS idx_arena_tasks_created ON arena_tasks(created_at DESC);

-- Submissions table
CREATE TABLE IF NOT EXISTS arena_submissions (
    id              SERIAL PRIMARY KEY,
    task_id         BIGINT NOT NULL,
    agent           VARCHAR(44) NOT NULL,
    result_ref      VARCHAR(128) NOT NULL DEFAULT '',
    trace_ref       VARCHAR(128) NOT NULL DEFAULT '',
    runtime_provider VARCHAR(32) NOT NULL DEFAULT '',
    runtime_model   VARCHAR(32) NOT NULL DEFAULT '',
    runtime_runtime VARCHAR(32) NOT NULL DEFAULT '',
    runtime_version VARCHAR(32) NOT NULL DEFAULT '',
    submission_slot BIGINT NOT NULL DEFAULT 0,
    submitted_at    BIGINT NOT NULL DEFAULT 0,
    bump            SMALLINT NOT NULL DEFAULT 0,
    UNIQUE(task_id, agent)
);

CREATE INDEX IF NOT EXISTS idx_arena_submissions_task ON arena_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_arena_submissions_agent ON arena_submissions(agent);

-- Reputations table
CREATE TABLE IF NOT EXISTS arena_reputations (
    agent           VARCHAR(44) PRIMARY KEY,
    total_earned    BIGINT NOT NULL DEFAULT 0,
    completed       BIGINT NOT NULL DEFAULT 0,
    total_applied   BIGINT NOT NULL DEFAULT 0,
    avg_score       BIGINT NOT NULL DEFAULT 0,
    win_rate        BIGINT NOT NULL DEFAULT 0,
    categories      JSONB NOT NULL DEFAULT '[]',
    bump            SMALLINT NOT NULL DEFAULT 0
);

-- Judge Pools table
CREATE TABLE IF NOT EXISTS arena_judge_pools (
    category        SMALLINT PRIMARY KEY,
    members         JSONB NOT NULL DEFAULT '[]',
    bump            SMALLINT NOT NULL DEFAULT 0
);

COMMIT;
