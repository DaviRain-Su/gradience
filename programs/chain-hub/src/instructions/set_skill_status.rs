use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{account::AccountView, error::ProgramError, Address, ProgramResult};

use crate::{
    constants::{CONFIG_SEED, SKILL_ENTRY_SEED, SKILL_REGISTRY_SEED},
    errors::ChainHubError,
    state::{
        ProgramConfig, SkillEntry, SkillRegistry, SkillStatus, PROGRAM_CONFIG_DISCRIMINATOR,
        SKILL_ENTRY_DISCRIMINATOR, SKILL_REGISTRY_DISCRIMINATOR,
    },
    utils::{read_borsh_account, verify_signer, verify_writable, write_borsh_account},
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct SetSkillStatusData {
    pub skill_id: u64,
    pub status: u8,
}

pub fn process_set_skill_status(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = SetSkillStatusData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    let [authority, config_account, skill_registry_account, skill_entry_account] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    verify_signer(authority)?;
    verify_writable(config_account)?;
    verify_writable(skill_registry_account)?;
    verify_writable(skill_entry_account)?;

    let (config_pda, _) = Address::find_program_address(&[CONFIG_SEED], program_id);
    if config_account.address() != &config_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let (skill_registry_pda, _) = Address::find_program_address(&[SKILL_REGISTRY_SEED], program_id);
    if skill_registry_account.address() != &skill_registry_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let skill_id_bytes = data.skill_id.to_le_bytes();
    let (skill_pda, _) =
        Address::find_program_address(&[SKILL_ENTRY_SEED, skill_id_bytes.as_ref()], program_id);
    if skill_entry_account.address() != &skill_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let config: ProgramConfig = read_borsh_account(config_account, PROGRAM_CONFIG_DISCRIMINATOR)?;
    if authority.address().to_bytes() != config.upgrade_authority {
        return Err(ChainHubError::NotUpgradeAuthority.into());
    }
    let mut registry: SkillRegistry =
        read_borsh_account(skill_registry_account, SKILL_REGISTRY_DISCRIMINATOR)?;
    let mut skill: SkillEntry = read_borsh_account(skill_entry_account, SKILL_ENTRY_DISCRIMINATOR)?;

    let new_status = parse_status(data.status)?;
    if skill.status != new_status {
        match (skill.status, new_status) {
            (SkillStatus::Active, SkillStatus::Paused) => {
                registry.total_active = registry
                    .total_active
                    .checked_sub(1)
                    .ok_or(ProgramError::ArithmeticOverflow)?;
            }
            (SkillStatus::Paused, SkillStatus::Active) => {
                registry.total_active = registry
                    .total_active
                    .checked_add(1)
                    .ok_or(ProgramError::ArithmeticOverflow)?;
            }
            _ => {}
        }
        skill.status = new_status;
    }

    write_borsh_account(skill_registry_account, SKILL_REGISTRY_DISCRIMINATOR, &registry)?;
    write_borsh_account(skill_entry_account, SKILL_ENTRY_DISCRIMINATOR, &skill)?;
    Ok(())
}

fn parse_status(value: u8) -> Result<SkillStatus, ProgramError> {
    match value {
        0 => Ok(SkillStatus::Active),
        1 => Ok(SkillStatus::Paused),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}
