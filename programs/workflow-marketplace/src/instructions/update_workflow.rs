use pinocchio::account_info::AccountInfo;
use pinocchio::program_error::ProgramError;
use pinocchio::pubkey::Pubkey;
use pinocchio::sysvars::clock::Clock;
use pinocchio::sysvars::Sysvar;

use crate::state::{WorkflowMetadata, WorkflowError};

/// Update workflow metadata
/// Only author can update
/// 
/// Accounts:
/// 0. [signer] Author
/// 1. [writable] Workflow PDA
/// 
/// Data:
/// - content_hash: [u8; 64] (optional)
/// - version: [u8; 16] (optional)
/// - is_public: bool (optional)
pub fn process(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
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

    // Verify author (skip discriminator and version)
    if workflow_data[2..34] != author.key().as_ref()[..] {
        return Err(WorkflowError::Unauthorized.into());
    }

    // Get current timestamp
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    // Parse update data (simplified - in real impl use flags for optional fields)
    if data.len() >= 64 {
        // Update content_hash
        workflow_data[66..130].copy_from_slice(&data[0..64]);
    }

    if data.len() >= 80 {
        // Update version
        workflow_data[130..146].copy_from_slice(&data[64..80]);
    }

    // Update updated_at
    workflow_data[158..166].copy_from_slice(&now.to_le_bytes());

    Ok(())
}
