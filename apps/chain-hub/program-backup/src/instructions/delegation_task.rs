use alloc::string::String;
use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView, cpi::Seed, error::ProgramError, sysvars::clock::Clock, sysvars::Sysvar,
    Address, ProgramResult,
};

use crate::{
    constants::{
        AGENT_LAYER_JUDGE_POOL_SEED, CONFIG_SEED, DELEGATION_TASK_SEED, MAX_CATEGORIES,
        MAX_PROTOCOL_ID_LEN, PROTOCOL_ENTRY_SEED, SKILL_ENTRY_SEED,
    },
    errors::ChainHubError,
    state::{
        DelegationTaskAccount, DelegationTaskStatus, ProgramConfig, ProtocolEntry, ProtocolStatus,
        SkillEntry, SkillStatus, DELEGATION_TASK_DISCRIMINATOR, DELEGATION_TASK_LEN,
        PROGRAM_CONFIG_DISCRIMINATOR, PROTOCOL_ENTRY_DISCRIMINATOR, SKILL_ENTRY_DISCRIMINATOR,
    },
    utils::{
        address_to_bytes, create_pda_account, is_zero_pubkey, read_borsh_account, verify_signer,
        verify_owner, verify_system_program, verify_writable, write_borsh_account,
    },
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct DelegationTaskData {
    pub skill_id: u64,
    pub protocol_id: String,
    pub judge_category: u8,
    pub selected_agent_authority: [u8; 32],
    pub selected_judge_authority: [u8; 32],
    pub max_executions: u32,
    pub expires_at: i64,
    pub policy_hash: [u8; 32],
}

pub fn process_delegation_task(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = DelegationTaskData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    let [
        requester,
        config_account,
        skill_entry_account,
        protocol_entry_account,
        delegation_task_account,
        judge_pool_account,
        system_program,
    ] = accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    verify_signer(requester)?;
    verify_writable(requester)?;
    verify_writable(config_account)?;
    verify_writable(delegation_task_account)?;
    verify_system_program(system_program)?;

    if data.judge_category >= MAX_CATEGORIES {
        return Err(ChainHubError::InvalidSkillCategory.into());
    }
    if is_zero_pubkey(&data.selected_agent_authority)
        || is_zero_pubkey(&data.selected_judge_authority)
    {
        return Err(ChainHubError::ZeroAuthority.into());
    }
    if data.max_executions == 0 {
        return Err(ChainHubError::InvalidMaxExecutions.into());
    }
    if data.policy_hash == [0u8; 32] {
        return Err(ChainHubError::InvalidPolicyHash.into());
    }
    if data.protocol_id.is_empty() || data.protocol_id.len() > MAX_PROTOCOL_ID_LEN {
        return Err(ChainHubError::InvalidProtocolId.into());
    }

    let clock = Clock::get()?;
    if data.expires_at <= clock.unix_timestamp {
        return Err(ChainHubError::DelegationExpired.into());
    }

    let (config_pda, _) = Address::find_program_address(&[CONFIG_SEED], program_id);
    if config_account.address() != &config_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    verify_owner(config_account, program_id)?;

    let mut config: ProgramConfig =
        read_borsh_account(config_account, PROGRAM_CONFIG_DISCRIMINATOR)?;

    let skill_id_bytes = data.skill_id.to_le_bytes();
    let (skill_pda, _) =
        Address::find_program_address(&[SKILL_ENTRY_SEED, skill_id_bytes.as_ref()], program_id);
    if skill_entry_account.address() != &skill_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    verify_owner(skill_entry_account, program_id)?;
    let skill: SkillEntry = read_borsh_account(skill_entry_account, SKILL_ENTRY_DISCRIMINATOR)?;
    if skill.skill_id != data.skill_id || skill.judge_category != data.judge_category {
        return Err(ChainHubError::SkillMismatch.into());
    }
    if skill.status != SkillStatus::Active {
        return Err(ChainHubError::SkillNotActive.into());
    }

    let protocol_id_seed = data.protocol_id.as_bytes();
    let (protocol_pda, _) =
        Address::find_program_address(&[PROTOCOL_ENTRY_SEED, protocol_id_seed], program_id);
    if protocol_entry_account.address() != &protocol_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    verify_owner(protocol_entry_account, program_id)?;
    let protocol: ProtocolEntry =
        read_borsh_account(protocol_entry_account, PROTOCOL_ENTRY_DISCRIMINATOR)?;
    if protocol.protocol_id != data.protocol_id {
        return Err(ChainHubError::ProtocolMismatch.into());
    }
    if protocol.status != ProtocolStatus::Active {
        return Err(ChainHubError::ProtocolNotActive.into());
    }

    let task_id = config
        .delegation_task_count
        .checked_add(1)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    let task_id_bytes = task_id.to_le_bytes();
    let (delegation_task_pda, task_bump) =
        Address::find_program_address(&[DELEGATION_TASK_SEED, task_id_bytes.as_ref()], program_id);
    if delegation_task_account.address() != &delegation_task_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let agent_layer_program = Address::new_from_array(config.agent_layer_program);
    let judge_category_seed = [data.judge_category];
    let (expected_judge_pool, _) = Address::find_program_address(
        &[AGENT_LAYER_JUDGE_POOL_SEED, judge_category_seed.as_ref()],
        &agent_layer_program,
    );
    if judge_pool_account.address() != &expected_judge_pool {
        return Err(ChainHubError::InvalidJudgePoolShape.into());
    }
    verify_owner(judge_pool_account, &agent_layer_program)?;
    if judge_pool_account.data_len() == 0 && judge_pool_account.lamports() == 0 {
        return Err(ProgramError::UninitializedAccount);
    }

    let task_bump_seed = [task_bump];
    create_pda_account(
        requester,
        DELEGATION_TASK_LEN,
        program_id,
        delegation_task_account,
        [
            Seed::from(DELEGATION_TASK_SEED),
            Seed::from(task_id_bytes.as_ref()),
            Seed::from(task_bump_seed.as_slice()),
        ],
    )?;

    let task = DelegationTaskAccount {
        task_id,
        requester: address_to_bytes(requester.address()),
        skill: address_to_bytes(skill_entry_account.address()),
        protocol: address_to_bytes(protocol_entry_account.address()),
        selected_agent_authority: data.selected_agent_authority,
        selected_judge_authority: data.selected_judge_authority,
        judge_pool: address_to_bytes(judge_pool_account.address()),
        judge_category: data.judge_category,
        max_executions: data.max_executions,
        executed_count: 0,
        expires_at: data.expires_at,
        status: DelegationTaskStatus::Created,
        policy_hash: data.policy_hash,
        bump: task_bump,
    };

    config.delegation_task_count = task_id;

    write_borsh_account(config_account, PROGRAM_CONFIG_DISCRIMINATOR, &config)?;
    write_borsh_account(
        delegation_task_account,
        DELEGATION_TASK_DISCRIMINATOR,
        &task,
    )?;

    Ok(())
}
