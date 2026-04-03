//! Initialize instruction

use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    pubkey::Pubkey,
};

use crate::{
    errors::AgentMError,
    state::ProgramConfig,
};

/// Initialize the AgentM Core program
pub fn initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _data: &[u8],
) -> Result<(), ProgramError> {
    let accounts_iter = &mut accounts.iter();
    
    let admin = accounts_iter.next().ok_or(ProgramError::NotEnoughAccountKeys)?;
    let config_account = accounts_iter.next().ok_or(ProgramError::NotEnoughAccountKeys)?;
    let system_program = accounts_iter.next().ok_or(ProgramError::NotEnoughAccountKeys)?;
    
    // Verify admin signed
    if !admin.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify config account is owned by program
    if config_account.owner() != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Check if already initialized
    let config_data = config_account.try_borrow_data()?;
    if config_data.len() >= 8 && config_data[0..8] == ProgramConfig::DISCRIMINATOR {
        return Err(AgentMError::AccountAlreadyInitialized.into());
    }
    drop(config_data);
    
    // Initialize config
    let config = ProgramConfig {
        discriminator: ProgramConfig::DISCRIMINATOR,
        version: 1,
        admin: admin.key().to_bytes(),
        total_users: 0,
        total_agents: 0,
        registration_enabled: true,
    };
    
    // Serialize config to account
    let mut config_data = config_account.try_borrow_mut_data()?;
    let serialized = borsh::to_vec(&config).map_err(|_| ProgramError::InvalidAccountData)?;
    
    if config_data.len() < serialized.len() {
        return Err(ProgramError::AccountDataTooSmall);
    }
    
    config_data[..serialized.len()].copy_from_slice(&serialized);
    
    Ok(())
}
