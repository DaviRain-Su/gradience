use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView,
    address::Address,
    cpi::Seed,
    error::ProgramError,
    sysvars::{clock::Clock, Sysvar},
    ProgramResult,
};

use crate::{
    constants::{ACCESS_SEED, ACCOUNT_VERSION_V1, WORKFLOW_SEED},
    errors::WorkflowError,
    state::{
        WorkflowAccess, WorkflowMetadata, WORKFLOW_ACCESS_DISCRIMINATOR, WORKFLOW_ACCESS_LEN,
        WORKFLOW_METADATA_DISCRIMINATOR,
    },
    utils::{address_to_bytes, create_pda_account},
};

/// Purchase a workflow
///
/// Accounts:
/// 0. [signer, writable] Buyer
/// 1. [] Workflow PDA (read-only, to verify exists and is active)
/// 2. [writable] Access PDA (to create)
/// 3. [] System program
///
/// Data layout (33 bytes):
/// - workflow_id: [u8; 32]
/// - access_type: u8 (0=purchased, 1=subscribed, 2=rented)
///
/// Note: This is a simplified version. Full implementation would include:
/// - Payment transfer to author
/// - Protocol fee to treasury
/// - SPL token support
pub fn process(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    if accounts.len() < 3 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let buyer = &accounts[0];
    let workflow_account = &accounts[1];
    let access_account = &accounts[2];

    // Check buyer is signer
    if !buyer.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Parse data
    if data.len() < 33 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let mut workflow_id = [0u8; 32];
    workflow_id.copy_from_slice(&data[0..32]);
    let access_type = data[32];

    // Validate access type (0-2)
    if access_type > 2 {
        return Err(ProgramError::InvalidInstructionData);
    }

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

    // Read workflow metadata to check if active
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
    let buyer_bytes = address_to_bytes(buyer.address());
    let (access_pda, access_bump) =
        Address::find_program_address(&[ACCESS_SEED, &workflow_id, &buyer_bytes], program_id);
    if access_account.address() != &access_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    // Check access doesn't already exist
    if access_account.data_len() > 0 {
        return Err(WorkflowError::WorkflowAlreadyExists.into()); // Reusing error - could add AlreadyPurchased
    }

    // Create access account
    let access_bump_seed = [access_bump];
    create_pda_account(
        buyer,
        WORKFLOW_ACCESS_LEN,
        program_id,
        access_account,
        [
            Seed::from(ACCESS_SEED),
            Seed::from(workflow_id.as_slice()),
            Seed::from(buyer_bytes.as_slice()),
            Seed::from(access_bump_seed.as_slice()),
        ],
    )?;

    // Get current timestamp
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    // Create access record
    let access = WorkflowAccess {
        workflow_id,
        user: buyer_bytes,
        access_type,
        purchased_at: now,
        expires_at: 0, // Never expires (for one-time purchase)
        executions: 0,
        max_executions: 0, // Unlimited
        bump: access_bump,
    };

    // Serialize to account
    {
        let mut account_data = access_account.try_borrow_mut()?;
        account_data[0] = WORKFLOW_ACCESS_DISCRIMINATOR;
        account_data[1] = ACCOUNT_VERSION_V1;
        access
            .serialize(&mut &mut account_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    // Update workflow metadata (increment total_purchases)
    {
        let mut workflow_data = workflow_account.try_borrow_mut()?;
        let mut metadata = WorkflowMetadata::deserialize(&mut &workflow_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;

        metadata.total_purchases = metadata
            .total_purchases
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
