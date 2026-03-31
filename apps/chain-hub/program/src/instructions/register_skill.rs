use alloc::string::String;
use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{account::AccountView, cpi::Seed, error::ProgramError, Address, ProgramResult};

use crate::{
    constants::{
        CONFIG_SEED, MAX_CATEGORIES, MAX_SKILL_METADATA_URI_LEN, MAX_SKILL_NAME_LEN,
        SKILL_ENTRY_SEED, SKILL_REGISTRY_SEED,
    },
    errors::ChainHubError,
    state::{
        ProgramConfig, SkillEntry, SkillRegistry, SkillStatus, PROGRAM_CONFIG_DISCRIMINATOR,
        SKILL_ENTRY_DISCRIMINATOR, SKILL_ENTRY_LEN, SKILL_REGISTRY_DISCRIMINATOR,
    },
    utils::{
        address_to_bytes, create_pda_account, read_borsh_account, verify_signer,
        verify_system_program, verify_writable, write_borsh_account,
    },
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct RegisterSkillData {
    pub judge_category: u8,
    pub name: String,
    pub metadata_uri: String,
}

pub fn process_register_skill(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = RegisterSkillData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    let [authority, config_account, skill_registry_account, skill_entry_account, system_program] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    verify_signer(authority)?;
    verify_writable(config_account)?;
    verify_writable(skill_registry_account)?;
    verify_writable(skill_entry_account)?;
    verify_system_program(system_program)?;

    if data.judge_category >= MAX_CATEGORIES {
        return Err(ChainHubError::InvalidSkillCategory.into());
    }
    if data.name.is_empty() || data.name.len() > MAX_SKILL_NAME_LEN {
        return Err(ChainHubError::InvalidSkillName.into());
    }
    if data.metadata_uri.is_empty() || data.metadata_uri.len() > MAX_SKILL_METADATA_URI_LEN {
        return Err(ChainHubError::InvalidSkillMetadataUri.into());
    }

    let (config_pda, _) = Address::find_program_address(&[CONFIG_SEED], program_id);
    if config_account.address() != &config_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let (skill_registry_pda, _) = Address::find_program_address(&[SKILL_REGISTRY_SEED], program_id);
    if skill_registry_account.address() != &skill_registry_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let mut config: ProgramConfig =
        read_borsh_account(config_account, PROGRAM_CONFIG_DISCRIMINATOR)?;
    let mut skill_registry: SkillRegistry =
        read_borsh_account(skill_registry_account, SKILL_REGISTRY_DISCRIMINATOR)?;

    if authority.address().to_bytes() != config.upgrade_authority {
        return Err(ChainHubError::NotUpgradeAuthority.into());
    }

    let skill_id = config
        .skill_count
        .checked_add(1)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    let skill_id_bytes = skill_id.to_le_bytes();
    let (skill_pda, skill_bump) =
        Address::find_program_address(&[SKILL_ENTRY_SEED, skill_id_bytes.as_ref()], program_id);
    if skill_entry_account.address() != &skill_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let skill_bump_seed = [skill_bump];
    create_pda_account(
        authority,
        SKILL_ENTRY_LEN,
        program_id,
        skill_entry_account,
        [
            Seed::from(SKILL_ENTRY_SEED),
            Seed::from(skill_id_bytes.as_ref()),
            Seed::from(skill_bump_seed.as_slice()),
        ],
    )?;

    let skill = SkillEntry {
        skill_id,
        authority: address_to_bytes(authority.address()),
        judge_category: data.judge_category,
        status: SkillStatus::Active,
        name: data.name,
        metadata_uri: data.metadata_uri,
        bump: skill_bump,
    };

    config.skill_count = skill_id;
    skill_registry.total_registered = skill_registry
        .total_registered
        .checked_add(1)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    skill_registry.total_active = skill_registry
        .total_active
        .checked_add(1)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    write_borsh_account(skill_entry_account, SKILL_ENTRY_DISCRIMINATOR, &skill)?;
    write_borsh_account(config_account, PROGRAM_CONFIG_DISCRIMINATOR, &config)?;
    write_borsh_account(
        skill_registry_account,
        SKILL_REGISTRY_DISCRIMINATOR,
        &skill_registry,
    )?;

    Ok(())
}
