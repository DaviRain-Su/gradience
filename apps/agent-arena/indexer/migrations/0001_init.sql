BEGIN;

CREATE TABLE IF NOT EXISTS tasks (
    task_id BIGINT PRIMARY KEY,
    poster TEXT NOT NULL,
    judge TEXT NOT NULL,
    judge_mode SMALLINT NOT NULL,
    reward BIGINT NOT NULL,
    mint TEXT NOT NULL,
    min_stake BIGINT NOT NULL,
    state SMALLINT NOT NULL,
    category SMALLINT NOT NULL,
    eval_ref TEXT NOT NULL,
    deadline BIGINT NOT NULL,
    judge_deadline BIGINT NOT NULL,
    submission_count SMALLINT DEFAULT 0,
    winner TEXT,
    created_at BIGINT NOT NULL,
    slot BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
    task_id BIGINT NOT NULL,
    agent TEXT NOT NULL,
    result_ref TEXT NOT NULL,
    trace_ref TEXT NOT NULL,
    runtime_provider TEXT NOT NULL,
    runtime_model TEXT NOT NULL,
    runtime_runtime TEXT NOT NULL,
    runtime_version TEXT NOT NULL,
    submission_slot BIGINT NOT NULL,
    submitted_at BIGINT NOT NULL,
    PRIMARY KEY (task_id, agent)
);

CREATE TABLE IF NOT EXISTS reputations (
    agent TEXT PRIMARY KEY,
    global_avg_score INTEGER NOT NULL DEFAULT 0,
    global_win_rate INTEGER NOT NULL DEFAULT 0,
    global_completed INTEGER NOT NULL DEFAULT 0,
    global_total_applied INTEGER NOT NULL DEFAULT 0,
    total_earned BIGINT NOT NULL DEFAULT 0,
    updated_slot BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reputation_by_category (
    agent TEXT NOT NULL,
    category SMALLINT NOT NULL,
    avg_score INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (agent, category)
);

CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_submissions_agent ON submissions(agent);

COMMIT;
