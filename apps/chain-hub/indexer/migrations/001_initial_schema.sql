-- Gradience Indexer: Initial Schema
-- Mirrors the API types from packages/indexer-mock/src/types.ts

CREATE TABLE IF NOT EXISTS tasks (
    task_id        SERIAL PRIMARY KEY,
    poster         VARCHAR(44) NOT NULL,
    judge          VARCHAR(44) NOT NULL,
    judge_mode     VARCHAR(20) NOT NULL DEFAULT 'designated',
    reward         BIGINT NOT NULL DEFAULT 0,
    mint           VARCHAR(44) NOT NULL,
    min_stake      BIGINT NOT NULL DEFAULT 0,
    state          VARCHAR(20) NOT NULL DEFAULT 'open',
    category       INTEGER NOT NULL DEFAULT 0,
    eval_ref       TEXT NOT NULL DEFAULT '',
    deadline       BIGINT NOT NULL,
    judge_deadline BIGINT NOT NULL,
    submission_count INTEGER NOT NULL DEFAULT 0,
    winner         VARCHAR(44),
    created_at     BIGINT NOT NULL,
    slot           BIGINT NOT NULL
);

CREATE INDEX idx_tasks_state ON tasks(state);
CREATE INDEX idx_tasks_category ON tasks(category);
CREATE INDEX idx_tasks_poster ON tasks(poster);

CREATE TABLE IF NOT EXISTS submissions (
    id                SERIAL PRIMARY KEY,
    task_id           INTEGER NOT NULL REFERENCES tasks(task_id),
    agent             VARCHAR(44) NOT NULL,
    result_ref        TEXT NOT NULL DEFAULT '',
    trace_ref         TEXT NOT NULL DEFAULT '',
    runtime_provider  VARCHAR(100) NOT NULL DEFAULT '',
    runtime_model     VARCHAR(100) NOT NULL DEFAULT '',
    runtime_runtime   VARCHAR(100) NOT NULL DEFAULT '',
    runtime_version   VARCHAR(50) NOT NULL DEFAULT '',
    submission_slot   BIGINT NOT NULL,
    submitted_at      BIGINT NOT NULL
);

CREATE INDEX idx_submissions_task ON submissions(task_id);
CREATE INDEX idx_submissions_agent ON submissions(agent);

CREATE TABLE IF NOT EXISTS reputation (
    agent               VARCHAR(44) PRIMARY KEY,
    global_avg_score    DOUBLE PRECISION NOT NULL DEFAULT 0,
    global_win_rate     DOUBLE PRECISION NOT NULL DEFAULT 0,
    global_completed    INTEGER NOT NULL DEFAULT 0,
    global_total_applied INTEGER NOT NULL DEFAULT 0,
    total_earned        BIGINT NOT NULL DEFAULT 0,
    updated_slot        BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agent_profiles (
    agent         VARCHAR(44) PRIMARY KEY,
    display_name  VARCHAR(200) NOT NULL DEFAULT '',
    bio           TEXT NOT NULL DEFAULT '',
    links_website VARCHAR(500),
    links_github  VARCHAR(500),
    links_x       VARCHAR(500),
    onchain_ref   VARCHAR(100),
    publish_mode  VARCHAR(20) NOT NULL DEFAULT 'manual',
    updated_at    BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS judge_pool_entries (
    id        SERIAL PRIMARY KEY,
    category  INTEGER NOT NULL,
    judge     VARCHAR(44) NOT NULL,
    stake     BIGINT NOT NULL DEFAULT 0,
    weight    DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE INDEX idx_judge_pool_category ON judge_pool_entries(category);

CREATE TABLE IF NOT EXISTS agent_rows (
    agent     VARCHAR(44) PRIMARY KEY,
    weight    DOUBLE PRECISION NOT NULL DEFAULT 0,
    rep_avg_score    DOUBLE PRECISION,
    rep_completed    INTEGER,
    rep_win_rate     DOUBLE PRECISION
);

-- Full-text search support for Agent Social (Phase 2)
CREATE TABLE IF NOT EXISTS agent_social_profiles (
    agent         VARCHAR(44) PRIMARY KEY,
    domain        VARCHAR(200),
    display_name  VARCHAR(200) NOT NULL DEFAULT '',
    bio           TEXT NOT NULL DEFAULT '',
    avatar_url    TEXT,
    reputation_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    follower_count   INTEGER NOT NULL DEFAULT 0,
    following_count  INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_profiles_domain ON agent_social_profiles(domain);

CREATE TABLE IF NOT EXISTS follows (
    follower  VARCHAR(44) NOT NULL,
    followee  VARCHAR(44) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower, followee)
);

CREATE INDEX idx_follows_followee ON follows(followee);

CREATE TABLE IF NOT EXISTS feed_events (
    id          SERIAL PRIMARY KEY,
    agent       VARCHAR(44) NOT NULL,
    event_type  VARCHAR(50) NOT NULL,
    content     JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feed_events_agent ON feed_events(agent);
CREATE INDEX idx_feed_events_created ON feed_events(created_at DESC);

CREATE TABLE IF NOT EXISTS messages (
    id          SERIAL PRIMARY KEY,
    sender      VARCHAR(44) NOT NULL,
    recipient   VARCHAR(44) NOT NULL,
    content     TEXT NOT NULL,
    read        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_sender ON messages(sender);
CREATE INDEX idx_messages_recipient ON messages(recipient);
CREATE INDEX idx_messages_conversation ON messages(LEAST(sender, recipient), GREATEST(sender, recipient));

CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    agent       VARCHAR(44) NOT NULL,
    type        VARCHAR(50) NOT NULL,
    actor       VARCHAR(44),
    content     JSONB NOT NULL DEFAULT '{}',
    read        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_agent ON notifications(agent, read);
