use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{account::AccountView, address::Address, error::ProgramError, ProgramResult};

use crate::{
    constants::{ACCOUNT_VERSION_V1, WORKFLOW_SEED},
    errors::WorkflowError,
    state::{WorkflowMetadata, WORKFLOW_METADATA_DISCRIMINATOR},
    utils::address_to_bytes,
};

/// Deactivate workflow (make unavailable for purchase)
///
/// Accounts:
/// 0. [signer] Author
/// 1. [writable] Workflow PDA
///
/// Data: workflow_id [u8; 32]
pub fn process_deactivate(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    toggle_workflow_status(program_id, accounts, data, false)
}

/// Activate workflow (make available for purchase)
///
/// Accounts:
/// 0. [signer] Author
/// 1. [writable] Workflow PDA
///
/// Data: workflow_id [u8; 32]
pub fn process_activate(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    toggle_workflow_status(program_id, accounts, data, true)
}

/// Common logic for toggling workflow status
fn toggle_workflow_status(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
    active: bool,
) -> ProgramResult {
    if accounts.len() < 2 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let author = &accounts[0];
    let workflow_account = &accounts[1];

    // Check author is signer
    if !author.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
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

    // Update workflow status
    {
        let mut workflow_data = workflow_account.try_borrow_mut()?;
        if workflow_data[0] != WORKFLOW_METADATA_DISCRIMINATOR {
            return Err(ProgramError::InvalidAccountData);
        }

        let mut metadata = WorkflowMetadata::deserialize(&mut &workflow_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;

        // Verify author
        let author_bytes = address_to_bytes(author.address());
        if metadata.author != author_bytes {
            return Err(WorkflowError::Unauthorized.into());
        }

        // Toggle status
        metadata.is_active = active;

        // Re-serialize
        workflow_data[0] = WORKFLOW_METADATA_DISCRIMINATOR;
        workflow_data[1] = ACCOUNT_VERSION_V1;
        metadata
            .serialize(&mut &mut workflow_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    Ok(())
}
