BEGIN;

CREATE TABLE IF NOT EXISTS judge_pool_members (
    category SMALLINT NOT NULL,
    judge TEXT NOT NULL,
    stake BIGINT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    updated_slot BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (category, judge)
);

CREATE INDEX IF NOT EXISTS idx_judge_pool_category_active
    ON judge_pool_members(category, active);

COMMIT;
