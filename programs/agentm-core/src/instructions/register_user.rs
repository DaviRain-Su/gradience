//! Register user instruction

use pinocchio::{account::AccountView, error::ProgramError, Address};

use crate::{constants::*, errors::AgentMError, state::User};

pub fn register_user(
    _program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> Result<(), ProgramError> {
    let username = String::from_utf8(data.to_vec()).map_err(|_| AgentMError::InvalidUsername)?;

    if username.len() > MAX_USERNAME_LEN {
        return Err(AgentMError::UsernameTooLong.into());
    }

    let accounts_iter = &mut accounts.iter();
    let payer = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;
    let user_account = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;
    let _system_program = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;

    if !payer.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let user = User {
        discriminator: User::DISCRIMINATOR,
        version: 1,
        owner: crate::addr_to_bytes(payer.address()),
        username,
        created_at: 0,
        updated_at: 0,
        is_active: true,
        agent_count: 0,
    };

    let mut user_data = user_account.try_borrow_mut()?;
    let serialized = borsh::to_vec(&user).map_err(|_| ProgramError::InvalidAccountData)?;
    if user_data.len() < serialized.len() {
        return Err(ProgramError::AccountDataTooSmall);
    }
    user_data[..serialized.len()].copy_from_slice(&serialized);

    Ok(())
}
