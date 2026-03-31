CREATE TABLE IF NOT EXISTS tasks (
    task_id INTEGER PRIMARY KEY,
    poster TEXT NOT NULL,
    judge TEXT NOT NULL,
    judge_mode INTEGER NOT NULL,
    reward INTEGER NOT NULL,
    mint TEXT NOT NULL,
    min_stake INTEGER NOT NULL,
    state INTEGER NOT NULL,
    category INTEGER NOT NULL,
    eval_ref TEXT NOT NULL,
    deadline INTEGER NOT NULL,
    judge_deadline INTEGER NOT NULL,
    submission_count INTEGER DEFAULT 0,
    winner TEXT,
    created_at INTEGER NOT NULL,
    slot INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
    task_id INTEGER NOT NULL,
    agent TEXT NOT NULL,
    result_ref TEXT NOT NULL,
    trace_ref TEXT NOT NULL,
    runtime_provider TEXT NOT NULL,
    runtime_model TEXT NOT NULL,
    runtime_runtime TEXT NOT NULL,
    runtime_version TEXT NOT NULL,
    submission_slot INTEGER NOT NULL,
    submitted_at INTEGER NOT NULL,
    PRIMARY KEY (task_id, agent)
);

CREATE TABLE IF NOT EXISTS reputations (
    agent TEXT PRIMARY KEY,
    global_avg_score INTEGER NOT NULL DEFAULT 0,
    global_win_rate INTEGER NOT NULL DEFAULT 0,
    global_completed INTEGER NOT NULL DEFAULT 0,
    global_total_applied INTEGER NOT NULL DEFAULT 0,
    total_earned INTEGER NOT NULL DEFAULT 0,
    updated_slot INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reputation_by_category (
    agent TEXT NOT NULL,
    category INTEGER NOT NULL,
    avg_score INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (agent, category)
);

CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_submissions_agent ON submissions(agent);
