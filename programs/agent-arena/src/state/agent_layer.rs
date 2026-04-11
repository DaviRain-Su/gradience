use alloc::{string::String, vec::Vec};
use borsh::{BorshDeserialize, BorshSerialize};
use codama::{CodamaAccount, CodamaType};

use crate::constants::{
    MAX_CATEGORIES, MAX_JUDGES_PER_POOL, MAX_MODEL_LEN, MAX_PROVIDER_LEN, MAX_REF_LEN,
    MAX_RUNTIME_LEN, MAX_VERSION_LEN,
};

pub type PubkeyBytes = [u8; 32];
/// 2 bytes: discriminator (1) + version (1)
pub const ACCOUNT_HEADER_LEN: usize = 2;
pub const ACCOUNT_VERSION_V1: u8 = 1;

const BORSH_STRING_PREFIX_LEN: usize = 4;
const BORSH_VEC_PREFIX_LEN: usize = 4;
const PUBKEY_BYTES_LEN: usize = 32;
const OPTION_TAG_LEN: usize = 1;

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq, CodamaType)]
#[borsh(use_discriminant = true)]
#[repr(u8)]
pub enum TaskState {
    Open = 0,
    Completed = 1,
    Refunded = 2,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq, CodamaType)]
#[borsh(use_discriminant = true)]
#[repr(u8)]
pub enum JudgeMode {
    Designated = 0,
    Pool = 1,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq, CodamaType)]
#[borsh(use_discriminant = true)]
#[repr(u8)]
pub enum Category {
    General = 0,
    Defi = 1,
    Code = 2,
    Research = 3,
    Creative = 4,
    Data = 5,
    Compute = 6,
    Gov = 7,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq, CodamaAccount)]
pub struct Task {
    pub task_id: u64,
    pub poster: PubkeyBytes,
    pub judge: PubkeyBytes,
    pub judge_mode: JudgeMode,
    pub reward: u64,
    pub mint: PubkeyBytes,
    pub min_stake: u64,
    pub state: TaskState,
    pub category: u8,
    pub eval_ref: String,
    pub deadline: i64,
    pub judge_deadline: i64,
    pub submission_count: u16,
    pub winner: Option<PubkeyBytes>,
    pub created_at: i64,
    pub bump: u8,
}

pub const TASK_DATA_LEN: usize = 8
    + PUBKEY_BYTES_LEN
    + PUBKEY_BYTES_LEN
    + 1
    + 8
    + PUBKEY_BYTES_LEN
    + 8
    + 1
    + 1
    + BORSH_STRING_PREFIX_LEN
    + MAX_REF_LEN
    + 8
    + 8
    + 2
    + OPTION_TAG_LEN
    + PUBKEY_BYTES_LEN
    + 8
    + 1;
pub const TASK_DISCRIMINATOR: u8 = 0x01;
pub const TASK_LEN: usize = ACCOUNT_HEADER_LEN + TASK_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq, CodamaAccount)]
pub struct Escrow {
    pub task_id: u64,
    pub mint: PubkeyBytes,
    pub amount: u64,
    pub bump: u8,
}

pub const ESCROW_DATA_LEN: usize = 8 + PUBKEY_BYTES_LEN + 8 + 1;
pub const ESCROW_DISCRIMINATOR: u8 = 0x02;
pub const ESCROW_LEN: usize = ACCOUNT_HEADER_LEN + ESCROW_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq, CodamaAccount)]
pub struct Application {
    pub task_id: u64,
    pub agent: PubkeyBytes,
    pub stake_amount: u64,
    pub applied_at: i64,
    pub bump: u8,
}

pub const APPLICATION_DATA_LEN: usize = 8 + PUBKEY_BYTES_LEN + 8 + 8 + 1;
pub const APPLICATION_DISCRIMINATOR: u8 = 0x03;
pub const APPLICATION_LEN: usize = ACCOUNT_HEADER_LEN + APPLICATION_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq, CodamaType)]
pub struct RuntimeEnv {
    pub provider: String,
    pub model: String,
    pub runtime: String,
    pub version: String,
}

pub const RUNTIME_ENV_DATA_LEN: usize = (BORSH_STRING_PREFIX_LEN + MAX_PROVIDER_LEN)
    + (BORSH_STRING_PREFIX_LEN + MAX_MODEL_LEN)
    + (BORSH_STRING_PREFIX_LEN + MAX_RUNTIME_LEN)
    + (BORSH_STRING_PREFIX_LEN + MAX_VERSION_LEN);

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq, CodamaAccount)]
pub struct Submission {
    pub task_id: u64,
    pub agent: PubkeyBytes,
    pub result_ref: String,
    pub trace_ref: String,
    pub runtime_env: RuntimeEnv,
    pub submission_slot: u64,
    pub submitted_at: i64,
    pub bump: u8,
}

pub const SUBMISSION_DATA_LEN: usize = 8
    + PUBKEY_BYTES_LEN
    + (BORSH_STRING_PREFIX_LEN + MAX_REF_LEN)
    + (BORSH_STRING_PREFIX_LEN + MAX_REF_LEN)
    + RUNTIME_ENV_DATA_LEN
    + 8
    + 8
    + 1;
pub const SUBMISSION_DISCRIMINATOR: u8 = 0x04;
pub const SUBMISSION_LEN: usize = ACCOUNT_HEADER_LEN + SUBMISSION_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq, Default, CodamaType)]
pub struct ReputationStats {
    pub total_earned: u64,
    pub completed: u32,
    pub total_applied: u32,
    pub avg_score: u16,
    pub win_rate: u16,
}

pub const REPUTATION_STATS_DATA_LEN: usize = 8 + 4 + 4 + 2 + 2;

#[derive(
    BorshSerialize,
    BorshDeserialize,
    Clone,
    Copy,
    Debug,
    PartialEq,
    Eq,
    Default,
    CodamaType,
)]
pub struct CategoryStats {
    pub category: u8,
    pub avg_score: u16,
    pub completed: u32,
}

pub const CATEGORY_STATS_DATA_LEN: usize = 1 + 2 + 4;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct Reputation {
    pub agent: PubkeyBytes,
    pub global: ReputationStats,
    pub by_category: [CategoryStats; MAX_CATEGORIES],
    pub bump: u8,
    pub evm_sync_nonce: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, CodamaAccount)]
#[codama(name = "Reputation")]
pub struct ReputationCodama {
    pub agent: PubkeyBytes,
    pub global: ReputationStats,
    pub by_category: Vec<CategoryStats>,
    pub bump: u8,
    pub evm_sync_nonce: u64,
}

pub const REPUTATION_DATA_LEN: usize = PUBKEY_BYTES_LEN
    + REPUTATION_STATS_DATA_LEN
    + (CATEGORY_STATS_DATA_LEN * MAX_CATEGORIES)
    + 1
    + 8;
pub const REPUTATION_DISCRIMINATOR: u8 = 0x05;
pub const REPUTATION_LEN: usize = ACCOUNT_HEADER_LEN + REPUTATION_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct EvmAuthority {
    pub owner: PubkeyBytes,
    pub relayers: Vec<PubkeyBytes>,
    pub max_relayer_age_slots: u64,
    pub bump: u8,
}

pub const EVM_AUTHORITY_SEED: &[u8] = b"evm_authority";
pub const EVM_AUTHORITY_DATA_LEN: usize = PUBKEY_BYTES_LEN
    + BORSH_VEC_PREFIX_LEN
    + (PUBKEY_BYTES_LEN * 8)
    + 8
    + 1;
pub const EVM_AUTHORITY_DISCRIMINATOR: u8 = 0x0d;
pub const EVM_AUTHORITY_LEN: usize = ACCOUNT_HEADER_LEN + EVM_AUTHORITY_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct Stake {
    pub judge: PubkeyBytes,
    pub amount: u64,
    pub categories: [u8; MAX_CATEGORIES],
    pub category_count: u8,
    pub registered_at: i64,
    pub cooldown_until: i64,
    pub bump: u8,
}

pub const STAKE_DATA_LEN: usize = PUBKEY_BYTES_LEN + 8 + MAX_CATEGORIES + 1 + 8 + 8 + 1;
pub const STAKE_DISCRIMINATOR: u8 = 0x06;
pub const STAKE_LEN: usize = ACCOUNT_HEADER_LEN + STAKE_DATA_LEN;

#[derive(Clone, Debug, PartialEq, Eq, CodamaAccount)]
#[codama(name = "Stake")]
pub struct StakeCodama {
    pub judge: PubkeyBytes,
    pub amount: u64,
    pub categories: Vec<u8>,
    pub category_count: u8,
    pub registered_at: i64,
    pub cooldown_until: i64,
    pub bump: u8,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq, CodamaType)]
pub struct JudgePoolEntry {
    pub judge: PubkeyBytes,
    pub weight: u32,
}

pub const JUDGE_POOL_ENTRY_DATA_LEN: usize = PUBKEY_BYTES_LEN + 4;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq, CodamaAccount)]
pub struct JudgePool {
    pub category: u8,
    pub total_weight: u32,
    pub entries: Vec<JudgePoolEntry>,
    pub bump: u8,
}

pub const JUDGE_POOL_DATA_LEN: usize = 1
    + 4
    + BORSH_VEC_PREFIX_LEN
    + (MAX_JUDGES_PER_POOL * JUDGE_POOL_ENTRY_DATA_LEN)
    + 1;
pub const JUDGE_POOL_DISCRIMINATOR: u8 = 0x07;
pub const JUDGE_POOL_LEN: usize = ACCOUNT_HEADER_LEN + JUDGE_POOL_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq, CodamaAccount)]
pub struct Treasury {
    pub bump: u8,
}

pub const TREASURY_DATA_LEN: usize = 1;
pub const TREASURY_DISCRIMINATOR: u8 = 0x08;
pub const TREASURY_LEN: usize = ACCOUNT_HEADER_LEN + TREASURY_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq, CodamaAccount)]
pub struct ProgramConfig {
    pub treasury: PubkeyBytes,
    pub upgrade_authority: PubkeyBytes,
    pub min_judge_stake: u64,
    pub task_count: u64,
    pub bump: u8,
}

pub const PROGRAM_CONFIG_DATA_LEN: usize = PUBKEY_BYTES_LEN + PUBKEY_BYTES_LEN + 8 + 8 + 1;
pub const PROGRAM_CONFIG_DISCRIMINATOR: u8 = 0x09;
pub const VRF_RESULT_DISCRIMINATOR: u8 = 0x0a;
pub const PROGRAM_CONFIG_LEN: usize = ACCOUNT_HEADER_LEN + PROGRAM_CONFIG_DATA_LEN;

/// Stores a fulfilled MagicBlock VRF randomness result for a task.
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq, CodamaAccount)]
pub struct VrfResult {
    pub task_id: u64,
    pub randomness: [u8; 32],
    pub fulfilled: bool,
    pub bump: u8,
}

pub const VRF_RESULT_DATA_LEN: usize = 8 + 32 + 1 + 1; // 42
pub const VRF_RESULT_LEN: usize = ACCOUNT_HEADER_LEN + VRF_RESULT_DATA_LEN; // 44

/// Cross-chain identity binding between a Solana owner and an EVM address.
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq, CodamaAccount)]
pub struct IdentityBinding {
    pub owner: PubkeyBytes,
    pub evm_address: [u8; 20],
    pub sol_signature: [u8; 64],
    pub evm_signature: [u8; 65],
    pub verified: bool,
    pub updated_at: i64,
    pub bump: u8,
}

pub const IDENTITY_BINDING_DATA_LEN: usize = PUBKEY_BYTES_LEN
    + 20
    + 64
    + 65
    + 1
    + 8
    + 1;
pub const IDENTITY_BINDING_DISCRIMINATOR: u8 = 0x0c;
pub const IDENTITY_BINDING_LEN: usize = ACCOUNT_HEADER_LEN + IDENTITY_BINDING_DATA_LEN; // 199

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_account_data_lengths_match_spec() {
        assert_eq!(TASK_DATA_LEN, 315);
        assert_eq!(TASK_LEN, 317);
        assert_eq!(ESCROW_DATA_LEN, 49);
        assert_eq!(ESCROW_LEN, 51);
        assert_eq!(APPLICATION_DATA_LEN, 57);
        assert_eq!(APPLICATION_LEN, 59);
        assert_eq!(RUNTIME_ENV_DATA_LEN, 176);
        assert_eq!(SUBMISSION_DATA_LEN, 497);
        assert_eq!(SUBMISSION_LEN, 499);
        assert_eq!(REPUTATION_STATS_DATA_LEN, 20);
        assert_eq!(CATEGORY_STATS_DATA_LEN, 7);
        assert_eq!(REPUTATION_DATA_LEN, 117);
        assert_eq!(REPUTATION_LEN, 119);
        assert_eq!(STAKE_DATA_LEN, 66);
        assert_eq!(STAKE_LEN, 68);
        assert_eq!(JUDGE_POOL_ENTRY_DATA_LEN, 36);
        assert_eq!(JUDGE_POOL_DATA_LEN, 7210);
        assert_eq!(JUDGE_POOL_LEN, 7212);
        assert_eq!(TREASURY_DATA_LEN, 1);
        assert_eq!(TREASURY_LEN, 3);
        assert_eq!(PROGRAM_CONFIG_DATA_LEN, 81);
        assert_eq!(PROGRAM_CONFIG_LEN, 83);
        assert_eq!(VRF_RESULT_DATA_LEN, 42);
        assert_eq!(VRF_RESULT_LEN, 44);
    }

    #[test]
    fn test_max_category_alignment() {
        assert_eq!(MAX_CATEGORIES, 8);
        assert_eq!(CATEGORY_STATS_DATA_LEN * MAX_CATEGORIES, 56);
    }

    #[test]
    fn test_identity_binding_length() {
        assert_eq!(IDENTITY_BINDING_DATA_LEN, 199);
        assert_eq!(IDENTITY_BINDING_LEN, 201);
    }

    #[test]
    fn test_evm_authority_length() {
        assert_eq!(EVM_AUTHORITY_DATA_LEN, 293);
        assert_eq!(EVM_AUTHORITY_LEN, 295);
    }
}
