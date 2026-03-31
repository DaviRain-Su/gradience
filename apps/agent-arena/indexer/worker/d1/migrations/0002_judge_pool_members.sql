CREATE TABLE IF NOT EXISTS judge_pool_members (
    category INTEGER NOT NULL,
    judge TEXT NOT NULL,
    stake INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    updated_slot INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (category, judge)
);

CREATE INDEX IF NOT EXISTS idx_judge_pool_category_active
    ON judge_pool_members(category, active);
