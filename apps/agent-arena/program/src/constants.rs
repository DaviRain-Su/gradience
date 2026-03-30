/// Judge fee: 3% of task reward (in basis points)
pub const JUDGE_FEE_BPS: u64 = 300;

/// Protocol fee: 2% of task reward (in basis points)
pub const PROTOCOL_FEE_BPS: u64 = 200;

/// Agent/Poster fee: 95% of task reward (in basis points)
pub const AGENT_FEE_BPS: u64 = 9500;

/// Cancel fee: 2% deducted when poster cancels (in basis points)
pub const CANCEL_FEE_BPS: u64 = 200;

/// Delay after judge_deadline before force_refund is allowed (in seconds)
pub const FORCE_REFUND_DELAY: i64 = 7 * 24 * 60 * 60; // 7 days

/// Cooldown period after unstaking before a judge can restake (in seconds)
pub const UNSTAKE_COOLDOWN: i64 = 7 * 24 * 60 * 60; // 7 days

/// Maximum number of judges allowed in a single JudgePool
pub const MAX_JUDGES_PER_POOL: usize = 200;

/// Maximum number of task categories supported
pub const MAX_CATEGORIES: usize = 16;

/// Minimum score (0–100) required for a task to be considered completed
pub const MIN_SCORE: u8 = 60;

/// Maximum score value
pub const MAX_SCORE: u8 = 100;

/// Maximum byte length of result_ref / reason_ref / trace_ref / evaluation_cid fields
pub const MAX_REF_LEN: usize = 128;

/// Maximum byte length of the provider field in RuntimeEnv
pub const MAX_PROVIDER_LEN: usize = 36;

/// Maximum byte length of the model field in RuntimeEnv
pub const MAX_MODEL_LEN: usize = 68;

/// Maximum byte length of the runtime field in RuntimeEnv
pub const MAX_RUNTIME_LEN: usize = 36;

/// Maximum byte length of the version field in RuntimeEnv
pub const MAX_VERSION_LEN: usize = 32;

/// Basis points denominator
pub const BPS_DENOMINATOR: u64 = 10_000;
