//! Register user instruction

use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    pubkey::Pubkey,
};

use crate::{
    constants::*,
    errors::AgentMError,
    state::User,
};

/// Register a new user
pub fn register_user(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> Result<(), ProgramError> {
    // Parse username from data
    let username = String::from_utf8(data.to_vec())
        .map_err(|_| AgentMError::InvalidUsername)?;
    
    // Validate username length
    if username.len() > MAX_USERNAME_LEN {
        return Err(AgentMError::UsernameTooLong.into());
    }
    
    let accounts_iter = &mut accounts.iter();
    let payer = accounts_iter.next().ok_or(ProgramError::NotEnoughAccountKeys)?;
    let user_account = accounts_iter.next().ok_or(ProgramError::NotEnoughAccountKeys)?;
    let _system_program = accounts_iter.next().ok_or(ProgramError::NotEnoughAccountKeys)?;
    
    // Verify payer signed
    if !payer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Create user account
    let user = User {
        discriminator: User::DISCRIMINATOR,
        version: 1,
        owner: payer.key().to_bytes(),
        username,
        created_at: 0, // Would use Clock sysvar in real impl
        updated_at: 0,
        is_active: true,
        agent_count: 0,
    };
    
    // Serialize user to account
    let mut user_data = user_account.try_borrow_mut_data()?;
    let serialized = borsh::to_vec(&user).map_err(|_| ProgramError::InvalidAccountData)?;
    user_data[..serialized.len()].copy_from_slice(&serialized);
    
    Ok(())
}
