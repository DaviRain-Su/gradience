//! AgentM Core Constants

/// Program version
pub const VERSION: u8 = 1;

/// Maximum username length
pub const MAX_USERNAME_LEN: usize = 32;

/// Maximum display name length
pub const MAX_DISPLAY_NAME_LEN: usize = 64;

/// Maximum bio length
pub const MAX_BIO_LEN: usize = 256;

/// Maximum avatar URL length
pub const MAX_AVATAR_URL_LEN: usize = 128;

/// Maximum message content length
pub const MAX_MESSAGE_LEN: usize = 1024;

/// Maximum agent name length
pub const MAX_AGENT_NAME_LEN: usize = 64;

/// Maximum agent description length
pub const MAX_AGENT_DESCRIPTION_LEN: usize = 512;

/// Maximum serialized agent config size
pub const MAX_AGENT_CONFIG_LEN: usize = 1024;

/// Maximum reputation score in basis points (100.00%)
pub const MAX_REPUTATION_SCORE_BPS: u16 = 10_000;

/// Seed for user PDA
pub const USER_SEED: &[u8] = b"user";

/// Seed for profile PDA
pub const PROFILE_SEED: &[u8] = b"profile";

/// Seed for social graph PDA
pub const SOCIAL_GRAPH_SEED: &[u8] = b"social_graph";

/// Seed for message PDA
pub const MESSAGE_SEED: &[u8] = b"message";

/// Seed for agent PDA
pub const AGENT_SEED: &[u8] = b"agent";

/// Maximum followers per user
pub const MAX_FOLLOWERS: u32 = 10_000;

/// Maximum following per user
pub const MAX_FOLLOWING: u32 = 1_000;
