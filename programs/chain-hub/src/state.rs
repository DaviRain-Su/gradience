use alloc::string::String;
use borsh::{BorshDeserialize, BorshSerialize};

use crate::constants::{
    MAX_PROTOCOL_DOCS_URI_LEN, MAX_PROTOCOL_ENDPOINT_LEN, MAX_PROTOCOL_ID_LEN,
    MAX_PROTOCOL_IDL_REF_LEN, MAX_SKILL_METADATA_URI_LEN, MAX_SKILL_NAME_LEN,
};

pub type PubkeyBytes = [u8; 32];

pub const ACCOUNT_HEADER_LEN: usize = 2;
pub const ACCOUNT_VERSION_V1: u8 = 1;

const BORSH_STRING_PREFIX_LEN: usize = 4;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct ProgramConfig {
    pub upgrade_authority: PubkeyBytes,
    pub agent_layer_program: PubkeyBytes,
    pub skill_count: u64,
    pub protocol_count: u64,
    pub delegation_task_count: u64,
    pub bump: u8,
}

pub const PROGRAM_CONFIG_DATA_LEN: usize = 32 + 32 + 8 + 8 + 8 + 1;
pub const PROGRAM_CONFIG_DISCRIMINATOR: u8 = 0x01;
pub const PROGRAM_CONFIG_LEN: usize = ACCOUNT_HEADER_LEN + PROGRAM_CONFIG_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct SkillRegistry {
    pub total_registered: u64,
    pub total_active: u64,
    pub bump: u8,
}

pub const SKILL_REGISTRY_DATA_LEN: usize = 8 + 8 + 1;
pub const SKILL_REGISTRY_DISCRIMINATOR: u8 = 0x02;
pub const SKILL_REGISTRY_LEN: usize = ACCOUNT_HEADER_LEN + SKILL_REGISTRY_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct ProtocolRegistry {
    pub total_registered: u64,
    pub total_active: u64,
    pub bump: u8,
}

pub const PROTOCOL_REGISTRY_DATA_LEN: usize = 8 + 8 + 1;
pub const PROTOCOL_REGISTRY_DISCRIMINATOR: u8 = 0x03;
pub const PROTOCOL_REGISTRY_LEN: usize = ACCOUNT_HEADER_LEN + PROTOCOL_REGISTRY_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[borsh(use_discriminant = true)]
#[repr(u8)]
pub enum SkillStatus {
    Active = 0,
    Paused = 1,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct SkillEntry {
    pub skill_id: u64,
    pub authority: PubkeyBytes,
    pub judge_category: u8,
    pub status: SkillStatus,
    pub name: String,
    pub metadata_uri: String,
    pub bump: u8,
}

pub const SKILL_ENTRY_DATA_LEN: usize = 8
    + 32
    + 1
    + 1
    + (BORSH_STRING_PREFIX_LEN + MAX_SKILL_NAME_LEN)
    + (BORSH_STRING_PREFIX_LEN + MAX_SKILL_METADATA_URI_LEN)
    + 1;
pub const SKILL_ENTRY_DISCRIMINATOR: u8 = 0x04;
pub const SKILL_ENTRY_LEN: usize = ACCOUNT_HEADER_LEN + SKILL_ENTRY_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[borsh(use_discriminant = true)]
#[repr(u8)]
pub enum ProtocolType {
    RestApi = 0,
    SolanaProgram = 1,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[borsh(use_discriminant = true)]
#[repr(u8)]
pub enum ProtocolTrustModel {
    CentralizedEnterprise = 0,
    CentralizedCommunity = 1,
    OnChainVerified = 2,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[borsh(use_discriminant = true)]
#[repr(u8)]
pub enum AuthMode {
    None = 0,
    KeyVault = 1,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[borsh(use_discriminant = true)]
#[repr(u8)]
pub enum ProtocolStatus {
    Active = 0,
    Paused = 1,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct ProtocolEntry {
    pub protocol_id: String,
    pub authority: PubkeyBytes,
    pub protocol_type: ProtocolType,
    pub trust_model: ProtocolTrustModel,
    pub auth_mode: AuthMode,
    pub status: ProtocolStatus,
    pub capabilities_mask: u64,
    pub endpoint: String,
    pub docs_uri: String,
    pub program_id: PubkeyBytes,
    pub idl_ref: String,
    pub bump: u8,
}

pub const PROTOCOL_ENTRY_DATA_LEN: usize = (BORSH_STRING_PREFIX_LEN + MAX_PROTOCOL_ID_LEN)
    + 32
    + 1
    + 1
    + 1
    + 1
    + 8
    + (BORSH_STRING_PREFIX_LEN + MAX_PROTOCOL_ENDPOINT_LEN)
    + (BORSH_STRING_PREFIX_LEN + MAX_PROTOCOL_DOCS_URI_LEN)
    + 32
    + (BORSH_STRING_PREFIX_LEN + MAX_PROTOCOL_IDL_REF_LEN)
    + 1;
pub const PROTOCOL_ENTRY_DISCRIMINATOR: u8 = 0x05;
pub const PROTOCOL_ENTRY_LEN: usize = ACCOUNT_HEADER_LEN + PROTOCOL_ENTRY_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[borsh(use_discriminant = true)]
#[repr(u8)]
pub enum DelegationTaskStatus {
    Created = 0,
    Active = 1,
    Completed = 2,
    Cancelled = 3,
    Expired = 4,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct DelegationTaskAccount {
    pub task_id: u64,
    pub requester: PubkeyBytes,
    pub skill: PubkeyBytes,
    pub protocol: PubkeyBytes,
    pub selected_agent_authority: PubkeyBytes,
    pub selected_judge_authority: PubkeyBytes,
    pub judge_pool: PubkeyBytes,
    pub judge_category: u8,
    pub max_executions: u32,
    pub executed_count: u32,
    pub expires_at: i64,
    pub status: DelegationTaskStatus,
    pub policy_hash: [u8; 32],
    pub bump: u8,
}

pub const DELEGATION_TASK_DATA_LEN: usize =
    8 + 32 + 32 + 32 + 32 + 32 + 32 + 1 + 4 + 4 + 8 + 1 + 32 + 1;
pub const DELEGATION_TASK_DISCRIMINATOR: u8 = 0x06;
pub const DELEGATION_TASK_LEN: usize = ACCOUNT_HEADER_LEN + DELEGATION_TASK_DATA_LEN;

pub const MAX_PROOF_LEN: usize = 64;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct ExternalEvaluationAccount {
    pub task_id: u64,
    pub evaluator: PubkeyBytes,
    pub score: u8,
    pub proof: String,
    pub evaluated_at: i64,
    pub bump: u8,
}

pub const EXTERNAL_EVALUATION_DATA_LEN: usize =
    8 + 32 + 1 + (BORSH_STRING_PREFIX_LEN + MAX_PROOF_LEN) + 8 + 1;
pub const EXTERNAL_EVALUATION_DISCRIMINATOR: u8 = 0x07;
pub const EXTERNAL_EVALUATION_LEN: usize = ACCOUNT_HEADER_LEN + EXTERNAL_EVALUATION_DATA_LEN;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_account_lengths() {
        assert_eq!(PROGRAM_CONFIG_DATA_LEN, 89);
        assert_eq!(PROGRAM_CONFIG_LEN, 91);
        assert_eq!(SKILL_REGISTRY_DATA_LEN, 17);
        assert_eq!(SKILL_REGISTRY_LEN, 19);
        assert_eq!(PROTOCOL_REGISTRY_DATA_LEN, 17);
        assert_eq!(PROTOCOL_REGISTRY_LEN, 19);
        assert_eq!(SKILL_ENTRY_DATA_LEN, 211);
        assert_eq!(SKILL_ENTRY_LEN, 213);
        assert_eq!(PROTOCOL_ENTRY_DATA_LEN, 509);
        assert_eq!(PROTOCOL_ENTRY_LEN, 511);
        assert_eq!(DELEGATION_TASK_DATA_LEN, 251);
        assert_eq!(DELEGATION_TASK_LEN, 253);
        assert_eq!(EXTERNAL_EVALUATION_DATA_LEN, 118);
        assert_eq!(EXTERNAL_EVALUATION_LEN, 120);
    }
}
