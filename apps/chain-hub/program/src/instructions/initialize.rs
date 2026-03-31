use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{account::AccountView, cpi::Seed, error::ProgramError, Address, ProgramResult};

use crate::{
    constants::{CONFIG_SEED, PROTOCOL_REGISTRY_SEED, SKILL_REGISTRY_SEED},
    errors::ChainHubError,
    state::{
        ProgramConfig, ProtocolRegistry, SkillRegistry, PROGRAM_CONFIG_DISCRIMINATOR,
        PROGRAM_CONFIG_LEN, PROTOCOL_REGISTRY_DISCRIMINATOR, PROTOCOL_REGISTRY_LEN,
        SKILL_REGISTRY_DISCRIMINATOR, SKILL_REGISTRY_LEN,
    },
    utils::{
        create_pda_account, is_zero_pubkey, verify_signer, verify_system_program, verify_writable,
        write_borsh_account,
    },
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct InitializeData {
    pub upgrade_authority: [u8; 32],
    pub agent_layer_program: [u8; 32],
}

pub fn process_initialize(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = InitializeData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    if is_zero_pubkey(&data.upgrade_authority) || is_zero_pubkey(&data.agent_layer_program) {
        return Err(ChainHubError::ZeroAuthority.into());
    }

    let [payer, config, skill_registry, protocol_registry, system_program] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    verify_signer(payer)?;
    verify_writable(payer)?;
    verify_writable(config)?;
    verify_writable(skill_registry)?;
    verify_writable(protocol_registry)?;
    verify_system_program(system_program)?;

    if config.data_len() > 0 || config.lamports() > 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }
    if skill_registry.data_len() > 0 || skill_registry.lamports() > 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }
    if protocol_registry.data_len() > 0 || protocol_registry.lamports() > 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let (config_pda, config_bump) = Address::find_program_address(&[CONFIG_SEED], program_id);
    if config.address() != &config_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let (skill_registry_pda, skill_registry_bump) =
        Address::find_program_address(&[SKILL_REGISTRY_SEED], program_id);
    if skill_registry.address() != &skill_registry_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let (protocol_registry_pda, protocol_registry_bump) =
        Address::find_program_address(&[PROTOCOL_REGISTRY_SEED], program_id);
    if protocol_registry.address() != &protocol_registry_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let config_bump_seed = [config_bump];
    create_pda_account(
        payer,
        PROGRAM_CONFIG_LEN,
        program_id,
        config,
        [
            Seed::from(CONFIG_SEED),
            Seed::from(config_bump_seed.as_slice()),
        ],
    )?;

    let skill_registry_bump_seed = [skill_registry_bump];
    create_pda_account(
        payer,
        SKILL_REGISTRY_LEN,
        program_id,
        skill_registry,
        [
            Seed::from(SKILL_REGISTRY_SEED),
            Seed::from(skill_registry_bump_seed.as_slice()),
        ],
    )?;

    let protocol_registry_bump_seed = [protocol_registry_bump];
    create_pda_account(
        payer,
        PROTOCOL_REGISTRY_LEN,
        program_id,
        protocol_registry,
        [
            Seed::from(PROTOCOL_REGISTRY_SEED),
            Seed::from(protocol_registry_bump_seed.as_slice()),
        ],
    )?;

    write_borsh_account(
        config,
        PROGRAM_CONFIG_DISCRIMINATOR,
        &ProgramConfig {
            upgrade_authority: data.upgrade_authority,
            agent_layer_program: data.agent_layer_program,
            skill_count: 0,
            protocol_count: 0,
            delegation_task_count: 0,
            bump: config_bump,
        },
    )?;

    write_borsh_account(
        skill_registry,
        SKILL_REGISTRY_DISCRIMINATOR,
        &SkillRegistry {
            total_registered: 0,
            total_active: 0,
            bump: skill_registry_bump,
        },
    )?;

    write_borsh_account(
        protocol_registry,
        PROTOCOL_REGISTRY_DISCRIMINATOR,
        &ProtocolRegistry {
            total_registered: 0,
            total_active: 0,
            bump: protocol_registry_bump,
        },
    )?;

    Ok(())
}
