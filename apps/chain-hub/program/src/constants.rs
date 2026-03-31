/// PDA seed for global config.
pub const CONFIG_SEED: &[u8] = b"config";

/// PDA seed for skill registry.
pub const SKILL_REGISTRY_SEED: &[u8] = b"skill_registry";

/// PDA seed prefix for skill entries.
pub const SKILL_ENTRY_SEED: &[u8] = b"skill";

/// PDA seed prefix for delegation task records.
pub const DELEGATION_TASK_SEED: &[u8] = b"delegation_task";

/// Agent Layer JudgePool PDA seed prefix (integration touchpoint).
pub const AGENT_LAYER_JUDGE_POOL_SEED: &[u8] = b"judge_pool";

/// Maximum supported categories aligned with Agent Layer.
pub const MAX_CATEGORIES: u8 = 8;

/// Maximum UTF-8 byte length for a skill name.
pub const MAX_SKILL_NAME_LEN: usize = 32;

/// Maximum UTF-8 byte length for skill metadata URI.
pub const MAX_SKILL_METADATA_URI_LEN: usize = 128;
