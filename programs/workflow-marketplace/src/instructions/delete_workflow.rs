use borsh::BorshDeserialize;
use pinocchio::{account::AccountView, address::Address, error::ProgramError, ProgramResult};

use crate::{
    constants::{WORKFLOW_SEED},
    errors::WorkflowError,
    state::{WorkflowMetadata, WORKFLOW_METADATA_DISCRIMINATOR},
    utils::address_to_bytes,
};

/// Delete a workflow
///
/// Accounts:
/// 0. [signer, writable] Author (will receive rent refund)
/// 1. [writable] Workflow PDA (will be closed)
///
/// Data: workflow_id [u8; 32]
///
/// Note: Can only delete if total_purchases == 0 (no one has purchased it)
pub fn process(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    if accounts.len() < 2 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let author = &accounts[0];
    let workflow_account = &accounts[1];

    // Check author is signer and writable
    if !author.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !author.is_writable() {
        return Err(ProgramError::Immutable);
    }

    // Parse workflow_id
    if data.len() < 32 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let mut workflow_id = [0u8; 32];
    workflow_id.copy_from_slice(&data[0..32]);

    // Verify workflow PDA
    let (workflow_pda, _) =
        Address::find_program_address(&[WORKFLOW_SEED, &workflow_id], program_id);
    if workflow_account.address() != &workflow_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    // Check workflow exists
    if workflow_account.data_len() == 0 {
        return Err(WorkflowError::WorkflowNotFound.into());
    }

    // Verify author and check purchases
    {
        let workflow_data = workflow_account.try_borrow()?;
        if workflow_data[0] != WORKFLOW_METADATA_DISCRIMINATOR {
            return Err(ProgramError::InvalidAccountData);
        }

        let metadata = WorkflowMetadata::deserialize(&mut &workflow_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;

        // Verify author
        let author_bytes = address_to_bytes(author.address());
        if metadata.author != author_bytes {
            return Err(WorkflowError::Unauthorized.into());
        }

        // Cannot delete if has purchases
        if metadata.total_purchases > 0 {
            return Err(WorkflowError::HasPurchases.into());
        }
    }

    // Close account and transfer lamports to author
    let workflow_lamports = workflow_account.lamports();
    let author_lamports = author.lamports();

    author.set_lamports(
        author_lamports
            .checked_add(workflow_lamports)
            .ok_or(ProgramError::ArithmeticOverflow)?,
    );
    workflow_account.set_lamports(0);
    workflow_account.close()?;

    Ok(())
}
