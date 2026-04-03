//! Initialize instruction

use pinocchio::{account::AccountView, error::ProgramError, Address};

use crate::{addr_to_bytes, errors::AgentMError, state::ProgramConfig};

pub fn initialize(
    program_id: &Address,
    accounts: &[AccountView],
    _data: &[u8],
) -> Result<(), ProgramError> {
    let accounts_iter = &mut accounts.iter();

    let admin = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;
    let config_account = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;
    let _system_program = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;

    if !admin.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if unsafe { config_account.owner() } != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }

    let config_data = config_account.try_borrow()?;
    if config_data.len() >= 8 && config_data[0..8] == ProgramConfig::DISCRIMINATOR {
        return Err(AgentMError::AccountAlreadyInitialized.into());
    }
    drop(config_data);

    let config = ProgramConfig {
        discriminator: ProgramConfig::DISCRIMINATOR,
        version: 1,
        admin: addr_to_bytes(admin.address()),
        total_users: 0,
        total_agents: 0,
        registration_enabled: true,
    };

    let mut config_data = config_account.try_borrow_mut()?;
    let serialized = borsh::to_vec(&config).map_err(|_| ProgramError::InvalidAccountData)?;

    if config_data.len() < serialized.len() {
        return Err(ProgramError::AccountDataTooSmall);
    }

    config_data[..serialized.len()].copy_from_slice(&serialized);

    Ok(())
}
