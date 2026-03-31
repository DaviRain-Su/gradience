use alloc::string::String;
use borsh::{BorshDeserialize, BorshSerialize};

use crate::constants::{MAX_SKILL_METADATA_URI_LEN, MAX_SKILL_NAME_LEN};

pub type PubkeyBytes = [u8; 32];

pub const ACCOUNT_HEADER_LEN: usize = 2;
pub const ACCOUNT_VERSION_V1: u8 = 1;

const BORSH_STRING_PREFIX_LEN: usize = 4;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct ProgramConfig {
    pub upgrade_authority: PubkeyBytes,
    pub agent_layer_program: PubkeyBytes,
    pub skill_count: u64,
    pub delegation_task_count: u64,
    pub bump: u8,
}

pub const PROGRAM_CONFIG_DATA_LEN: usize = 32 + 32 + 8 + 8 + 1;
pub const PROGRAM_CONFIG_DISCRIMINATOR: u8 = 0x01;
pub const PROGRAM_CONFIG_LEN: usize = ACCOUNT_HEADER_LEN + PROGRAM_CONFIG_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct SkillRegistry {
    pub total_registered: u64,
    pub bump: u8,
}

pub const SKILL_REGISTRY_DATA_LEN: usize = 8 + 1;
pub const SKILL_REGISTRY_DISCRIMINATOR: u8 = 0x02;
pub const SKILL_REGISTRY_LEN: usize = ACCOUNT_HEADER_LEN + SKILL_REGISTRY_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct SkillEntry {
    pub skill_id: u64,
    pub authority: PubkeyBytes,
    pub judge_category: u8,
    pub name: String,
    pub metadata_uri: String,
    pub bump: u8,
}

pub const SKILL_ENTRY_DATA_LEN: usize = 8
    + 32
    + 1
    + (BORSH_STRING_PREFIX_LEN + MAX_SKILL_NAME_LEN)
    + (BORSH_STRING_PREFIX_LEN + MAX_SKILL_METADATA_URI_LEN)
    + 1;
pub const SKILL_ENTRY_DISCRIMINATOR: u8 = 0x03;
pub const SKILL_ENTRY_LEN: usize = ACCOUNT_HEADER_LEN + SKILL_ENTRY_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct DelegationTaskAccount {
    pub task_id: u64,
    pub requester: PubkeyBytes,
    pub skill: PubkeyBytes,
    pub selected_agent_authority: PubkeyBytes,
    pub selected_judge_authority: PubkeyBytes,
    pub judge_pool: PubkeyBytes,
    pub judge_category: u8,
    pub bump: u8,
}

pub const DELEGATION_TASK_DATA_LEN: usize = 8 + 32 + 32 + 32 + 32 + 32 + 1 + 1;
pub const DELEGATION_TASK_DISCRIMINATOR: u8 = 0x04;
pub const DELEGATION_TASK_LEN: usize = ACCOUNT_HEADER_LEN + DELEGATION_TASK_DATA_LEN;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_account_lengths() {
        assert_eq!(PROGRAM_CONFIG_DATA_LEN, 81);
        assert_eq!(PROGRAM_CONFIG_LEN, 83);
        assert_eq!(SKILL_REGISTRY_DATA_LEN, 9);
        assert_eq!(SKILL_REGISTRY_LEN, 11);
        assert_eq!(SKILL_ENTRY_DATA_LEN, 210);
        assert_eq!(SKILL_ENTRY_LEN, 212);
        assert_eq!(DELEGATION_TASK_DATA_LEN, 170);
        assert_eq!(DELEGATION_TASK_LEN, 172);
    }
}
