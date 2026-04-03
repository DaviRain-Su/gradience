use pinocchio::account_info::AccountInfo;
use pinocchio::program_error::ProgramError;
use pinocchio::pubkey::Pubkey;
use pinocchio::program::invoke_signed;
use pinocchio::system_instruction::close_account;

use crate::state::{WorkflowMetadata, WorkflowError};

/// Delete a workflow (hard delete)
/// Only author can delete
/// Only allowed if no purchases (total_purchases == 0)
/// 
/// Accounts:
/// 0. [signer] Author
/// 1. [writable] Workflow PDA
/// 2. [writable] Destination account (for lamports refund)
/// 3. [] System program
pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _data: &[u8],
) -> Result<(), ProgramError> {
    if accounts.len() < 4 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let author = &accounts[0];
    let workflow_account = &accounts[1];
    let destination = &accounts[2];
    let system_program = &accounts[3];

    // Check author is signer
    if !author.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Check workflow exists
    if workflow_account.data_len() == 0 {
        return Err(WorkflowError::WorkflowNotFound.into());
    }

    let workflow_data = workflow_account.try_borrow_data()?;

    // Verify author
    if workflow_data[2..34] != author.key().as_ref()[..] {
        return Err(WorkflowError::Unauthorized.into());
    }

    // Check no purchases (total_purchases at offset 148)
    let total_purchases = u32::from_le_bytes([
        workflow_data[148], workflow_data[149], 
        workflow_data[150], workflow_data[151]
    ]);
    
    if total_purchases > 0 {
        return Err(WorkflowError::HasPurchases.into());
    }

    // Get workflow_id for seeds
    let workflow_id = Pubkey::new_from_array(&workflow_data[2..34]);
    let bump = workflow_data[171];

    // Close account and refund lamports
    invoke_signed(
        &close_account(
            workflow_account.key(),
            destination.key(),
        ),
        &[workflow_account.clone(), destination.clone(), system_program.clone()],
        &[&[b"workflow", workflow_id.as_ref(), &[bump]]],
    )?;

    Ok(())
}
