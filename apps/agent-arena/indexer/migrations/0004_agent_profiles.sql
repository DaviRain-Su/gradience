BEGIN;

CREATE TABLE IF NOT EXISTS agent_profiles (
    agent TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    website TEXT,
    github TEXT,
    x TEXT,
    onchain_ref TEXT,
    publish_mode TEXT NOT NULL DEFAULT 'manual',
    updated_at BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_agent_profiles_updated_at
    ON agent_profiles(updated_at DESC);

COMMIT;
