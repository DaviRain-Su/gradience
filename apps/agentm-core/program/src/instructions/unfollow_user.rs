//! Unfollow user instruction

use pinocchio::{account::AccountView, error::ProgramError, Address};

pub fn unfollow_user(
    _program_id: &Address,
    accounts: &[AccountView],
    _data: &[u8],
) -> Result<(), ProgramError> {
    let accounts_iter = &mut accounts.iter();
    let follower = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;
    let _target = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;

    if !follower.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    Ok(())
}
