use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView,
    address::Address,
    error::ProgramError,
    sysvars::{clock::Clock, Sysvar},
    ProgramResult,
};

use crate::{
    constants::{ACCESS_SEED, ACCOUNT_VERSION_V1, WORKFLOW_SEED},
    errors::WorkflowError,
    state::{
        WorkflowAccess, WorkflowMetadata, WORKFLOW_ACCESS_DISCRIMINATOR,
        WORKFLOW_METADATA_DISCRIMINATOR,
    },
    utils::address_to_bytes,
};

/// Record workflow execution
///
/// Accounts:
/// 0. [signer] Executor (user who runs the workflow)
/// 1. [writable] Workflow PDA (to increment total_executions)
/// 2. [writable] Access PDA (to increment executions, check limits)
///
/// Data layout (32 bytes):
/// - workflow_id: [u8; 32]
///
/// This instruction should be called after successful off-chain execution.
/// It:
/// - Verifies user has access
/// - Checks access hasn't expired
/// - Checks execution limits (if any)
/// - Increments execution counters
pub fn process(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    if accounts.len() < 3 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let executor = &accounts[0];
    let workflow_account = &accounts[1];
    let access_account = &accounts[2];

    // Check executor is signer
    if !executor.is_signer() {
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

    // Check workflow exists and is active
    if workflow_account.data_len() == 0 {
        return Err(WorkflowError::WorkflowNotFound.into());
    }

    {
        let workflow_data = workflow_account.try_borrow()?;
        if workflow_data[0] != WORKFLOW_METADATA_DISCRIMINATOR {
            return Err(ProgramError::InvalidAccountData);
        }

        let metadata = WorkflowMetadata::deserialize(&mut &workflow_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;

        if !metadata.is_active {
            return Err(WorkflowError::WorkflowInactive.into());
        }
    }

    // Verify access PDA
    let executor_bytes = address_to_bytes(executor.address());
    let (access_pda, _) =
        Address::find_program_address(&[ACCESS_SEED, &workflow_id, &executor_bytes], program_id);
    if access_account.address() != &access_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    // Check access exists
    if access_account.data_len() == 0 {
        return Err(WorkflowError::NotPurchased.into());
    }

    // Get current time
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    // Update access record
    {
        let mut access_data = access_account.try_borrow_mut()?;
        if access_data[0] != WORKFLOW_ACCESS_DISCRIMINATOR {
            return Err(ProgramError::InvalidAccountData);
        }

        let mut access = WorkflowAccess::deserialize(&mut &access_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;

        // Check if access has expired (for subscriptions/rentals)
        if access.expires_at > 0 && now > access.expires_at {
            return Err(WorkflowError::WorkflowInactive.into()); // Reusing error - could add AccessExpired
        }

        // Check execution limit (if set)
        if access.max_executions > 0 && access.executions >= access.max_executions {
            return Err(WorkflowError::WorkflowInactive.into()); // Could add ExecutionLimitReached
        }

        // Increment execution count
        access.executions = access
            .executions
            .checked_add(1)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        // Re-serialize
        access_data[0] = WORKFLOW_ACCESS_DISCRIMINATOR;
        access_data[1] = ACCOUNT_VERSION_V1;
        access
            .serialize(&mut &mut access_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    // Update workflow metadata (increment total_executions)
    {
        let mut workflow_data = workflow_account.try_borrow_mut()?;
        let mut metadata = WorkflowMetadata::deserialize(&mut &workflow_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;

        metadata.total_executions = metadata
            .total_executions
            .checked_add(1)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        // Re-serialize
        workflow_data[0] = WORKFLOW_METADATA_DISCRIMINATOR;
        workflow_data[1] = ACCOUNT_VERSION_V1;
        metadata
            .serialize(&mut &mut workflow_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    Ok(())
}
