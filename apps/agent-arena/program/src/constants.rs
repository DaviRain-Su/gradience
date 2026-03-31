/// Judge fee: 3% of task reward (basis points)
pub const JUDGE_FEE_BPS: u16 = 300;

/// Protocol fee: 2% of task reward (basis points)
pub const PROTOCOL_FEE_BPS: u16 = 200;

/// Agent/Poster share: 95% of task reward (basis points)
pub const AGENT_FEE_BPS: u16 = 9500;

/// Cancel fee: 2% deducted when poster cancels (basis points)
pub const CANCEL_FEE_BPS: u16 = 200;

/// Delay after judge_deadline before `force_refund` is allowed (seconds)
pub const FORCE_REFUND_DELAY: i64 = 604_800; // 7 days

/// Cooldown period after unstaking before a judge can restake (seconds)
pub const UNSTAKE_COOLDOWN: i64 = 604_800; // 7 days

/// Maximum number of judges allowed in a single judge pool
pub const MAX_JUDGES_PER_POOL: usize = 200;

/// Maximum number of supported task categories
pub const MAX_CATEGORIES: usize = 8;

/// Minimum score required for a valid completion
pub const MIN_SCORE: u8 = 60;

/// Maximum score value
pub const MAX_SCORE: u8 = 100;

/// Maximum byte length of CID reference fields
pub const MAX_REF_LEN: usize = 128;

/// Maximum byte length of `runtime_env.provider`
pub const MAX_PROVIDER_LEN: usize = 32;

/// Maximum byte length of `runtime_env.model`
pub const MAX_MODEL_LEN: usize = 64;

/// Maximum byte length of `runtime_env.runtime`
pub const MAX_RUNTIME_LEN: usize = 32;

/// Maximum byte length of `runtime_env.version`
pub const MAX_VERSION_LEN: usize = 32;

/// Lamports per 1 SOL
pub const LAMPORTS_PER_SOL: u64 = 1_000_000_000;

/// Initial configurable value for `ProgramConfig.min_judge_stake` (1 SOL)
pub const MIN_JUDGE_STAKE: u64 = LAMPORTS_PER_SOL;

/// Basis points denominator
pub const BPS_DENOMINATOR: u64 = 10_000;
