use pinocchio::account_info::AccountInfo;
use pinocchio::program_error::ProgramError;
use pinocchio::pubkey::Pubkey;

use crate::state::{WorkflowMetadata, WorkflowError};

/// Deactivate a workflow (soft delete)
/// Only author can deactivate
/// 
/// Accounts:
/// 0. [signer] Author
/// 1. [writable] Workflow PDA
pub fn process(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    _data: &[u8],
) -> Result<(), ProgramError> {
    if accounts.len() < 2 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let author = &accounts[0];
    let workflow_account = &accounts[1];

    // Check author is signer
    if !author.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Check workflow exists
    if workflow_account.data_len() == 0 {
        return Err(WorkflowError::WorkflowNotFound.into());
    }

    let mut workflow_data = workflow_account.try_borrow_mut_data()?;

    // Verify author
    if workflow_data[2..34] != author.key().as_ref()[..] {
        return Err(WorkflowError::Unauthorized.into());
    }

    // Set is_active to false
    workflow_data[147] = 0;

    Ok(())
}
