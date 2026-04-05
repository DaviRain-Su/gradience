-- Chain Hub Indexer: Initial Schema
-- Supports Skills, Protocols, Royalties, and Invocations

BEGIN;

-- Skills table
CREATE TABLE IF NOT EXISTS skills (
    skill_id        BIGINT PRIMARY KEY,
    authority       VARCHAR(44) NOT NULL,
    judge_category  SMALLINT NOT NULL DEFAULT 0,
    status          SMALLINT NOT NULL DEFAULT 0, -- 0=active, 1=paused
    name            VARCHAR(32) NOT NULL,
    metadata_uri    VARCHAR(128) NOT NULL,
    created_at      BIGINT NOT NULL,
    slot            BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skills_status ON skills(status);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(judge_category);
CREATE INDEX IF NOT EXISTS idx_skills_authority ON skills(authority);

-- Protocols table
CREATE TABLE IF NOT EXISTS protocols (
    protocol_id         VARCHAR(32) PRIMARY KEY,
    authority           VARCHAR(44) NOT NULL,
    protocol_type       SMALLINT NOT NULL DEFAULT 0, -- 0=rest-api, 1=solana-program
    trust_model         SMALLINT NOT NULL DEFAULT 0, -- 0=centralized-enterprise, 1=centralized-community, 2=onchain-verified
    auth_mode           SMALLINT NOT NULL DEFAULT 0, -- 0=***, 1=key-vault
    status              SMALLINT NOT NULL DEFAULT 0, -- 0=active, 1=paused
    capabilities_mask   BIGINT NOT NULL DEFAULT 0,
    endpoint            VARCHAR(128) NOT NULL DEFAULT '',
    docs_uri            VARCHAR(128) NOT NULL DEFAULT '',
    program_id          VARCHAR(44) NOT NULL DEFAULT '11111111111111111111111111111111',
    idl_ref             VARCHAR(128) NOT NULL DEFAULT '',
    created_at          BIGINT NOT NULL,
    slot                BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_protocols_status ON protocols(status);
CREATE INDEX IF NOT EXISTS idx_protocols_type ON protocols(protocol_type);
CREATE INDEX IF NOT EXISTS idx_protocols_authority ON protocols(authority);

-- Royalties table for tracking agent earnings
CREATE TABLE IF NOT EXISTS royalties (
    agent           VARCHAR(44) PRIMARY KEY,
    total_earned    BIGINT NOT NULL DEFAULT 0,
    total_paid      BIGINT NOT NULL DEFAULT 0,
    balance         BIGINT NOT NULL DEFAULT 0,
    updated_slot    BIGINT NOT NULL DEFAULT 0
);

-- Invocations table for tracking skill invocations
CREATE TABLE IF NOT EXISTS invocations (
    invocation_id   BIGINT PRIMARY KEY,
    task_id         BIGINT NOT NULL,
    requester       VARCHAR(44) NOT NULL,
    skill_id        BIGINT NOT NULL REFERENCES skills(skill_id),
    protocol_id     VARCHAR(32) NOT NULL REFERENCES protocols(protocol_id),
    agent           VARCHAR(44) NOT NULL,
    judge           VARCHAR(44) NOT NULL,
    amount          BIGINT NOT NULL DEFAULT 0,
    status          SMALLINT NOT NULL DEFAULT 0, -- 0=pending, 1=completed, 2=failed
    royalty_amount  BIGINT NOT NULL DEFAULT 0,
    created_at      BIGINT NOT NULL,
    completed_at    BIGINT,
    slot            BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invocations_agent ON invocations(agent);
CREATE INDEX IF NOT EXISTS idx_invocations_skill ON invocations(skill_id);
CREATE INDEX IF NOT EXISTS idx_invocations_protocol ON invocations(protocol_id);
CREATE INDEX IF NOT EXISTS idx_invocations_status ON invocations(status);
CREATE INDEX IF NOT EXISTS idx_invocations_created ON invocations(created_at DESC);

COMMIT;
