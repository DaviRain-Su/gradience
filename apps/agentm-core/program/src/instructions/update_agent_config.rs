//! Update agent config instruction
use pinocchio::{account_info::AccountInfo, program_error::ProgramError, pubkey::Pubkey};

pub fn update_agent_config(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    _data: &[u8],
) -> Result<(), ProgramError> {
    let accounts_iter = &mut accounts.iter();
    let owner = accounts_iter.next().ok_or(ProgramError::NotEnoughAccountKeys)?;
    let _agent_account = accounts_iter.next().ok_or(ProgramError::NotEnoughAccountKeys)?;
    
    if !owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    Ok(())
}
