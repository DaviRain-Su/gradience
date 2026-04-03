//! Follow user instruction
use pinocchio::{account_info::AccountInfo, program_error::ProgramError, pubkey::Pubkey};
use crate::errors::AgentMError;

pub fn follow_user(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    _data: &[u8],
) -> Result<(), ProgramError> {
    let accounts_iter = &mut accounts.iter();
    let follower = accounts_iter.next().ok_or(ProgramError::NotEnoughAccountKeys)?;
    let _target = accounts_iter.next().ok_or(ProgramError::NotEnoughAccountKeys)?;
    
    if !follower.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Implementation would update social graph
    Ok(())
}
