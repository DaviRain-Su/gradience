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
    constants::{ACCESS_SEED, ACCOUNT_VERSION_V1, REVIEW_SEED, WORKFLOW_SEED},
    errors::WorkflowError,
    state::{
        WorkflowAccess, WorkflowMetadata, WorkflowReview, WORKFLOW_ACCESS_DISCRIMINATOR,
        WORKFLOW_METADATA_DISCRIMINATOR, WORKFLOW_REVIEW_DISCRIMINATOR, WORKFLOW_REVIEW_LEN,
    },
    utils::{address_to_bytes, create_pda_account},
};

/// Review a workflow
///
/// Accounts:
/// 0. [signer, writable] Reviewer
/// 1. [writable] Workflow PDA (to update avg_rating)
/// 2. [writable] Review PDA (to create)
/// 3. [] Access PDA (to verify purchase)
/// 4. [] System program
///
/// Data layout (65 bytes):
/// - workflow_id: [u8; 32]
/// - rating: u8 (1-5)
/// - comment_hash: [u8; 32]
pub fn process(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    if accounts.len() < 4 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let reviewer = &accounts[0];
    let workflow_account = &accounts[1];
    let review_account = &accounts[2];
    let access_account = &accounts[3];

    // Check reviewer is signer
    if !reviewer.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Parse data
    if data.len() < 65 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let mut workflow_id = [0u8; 32];
    workflow_id.copy_from_slice(&data[0..32]);
    let rating = data[32];
    let mut comment_hash = [0u8; 32];
    comment_hash.copy_from_slice(&data[33..65]);

    // Validate rating (1-5)
    if rating < 1 || rating > 5 {
        return Err(WorkflowError::InvalidRating.into());
    }

    // Verify workflow PDA
    let (workflow_pda, _) =
        Address::find_program_address(&[WORKFLOW_SEED, &workflow_id], program_id);
    if workflow_account.address() != &workflow_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    // Verify access PDA (reviewer must have purchased)
    let reviewer_bytes = address_to_bytes(reviewer.address());
    let (access_pda, _) =
        Address::find_program_address(&[ACCESS_SEED, &workflow_id, &reviewer_bytes], program_id);
    if access_account.address() != &access_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    // Check access exists
    if access_account.data_len() == 0 {
        return Err(WorkflowError::NotPurchased.into());
    }

    // Verify access discriminator
    {
        let access_data = access_account.try_borrow()?;
        if access_data[0] != WORKFLOW_ACCESS_DISCRIMINATOR {
            return Err(ProgramError::InvalidAccountData);
        }
    }

    // Verify review PDA
    let (review_pda, review_bump) = Address::find_program_address(
        &[REVIEW_SEED, &workflow_id, &reviewer_bytes],
        program_id,
    );
    if review_account.address() != &review_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    // Check review doesn't already exist
    if review_account.data_len() > 0 {
        return Err(WorkflowError::AlreadyReviewed.into());
    }

    // Create review account
    let review_bump_seed = [review_bump];
    create_pda_account(
        reviewer,
        WORKFLOW_REVIEW_LEN,
        program_id,
        review_account,
        [
            Seed::from(REVIEW_SEED),
            Seed::from(workflow_id.as_slice()),
            Seed::from(reviewer_bytes.as_slice()),
            Seed::from(review_bump_seed.as_slice()),
        ],
    )?;

    // Get current timestamp
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    // Create review
    let review = WorkflowReview {
        workflow_id,
        reviewer: reviewer_bytes,
        rating,
        comment_hash,
        created_at: now,
        helpful_votes: 0,
        verified: true, // Verified because we checked access
        bump: review_bump,
    };

    // Serialize review to account
    {
        let mut account_data = review_account.try_borrow_mut()?;
        account_data[0] = WORKFLOW_REVIEW_DISCRIMINATOR;
        account_data[1] = ACCOUNT_VERSION_V1;
        review
            .serialize(&mut &mut account_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    // Update workflow avg_rating
    {
        let mut workflow_data = workflow_account.try_borrow_mut()?;
        if workflow_data[0] != WORKFLOW_METADATA_DISCRIMINATOR {
            return Err(ProgramError::InvalidAccountData);
        }

        let mut metadata = WorkflowMetadata::deserialize(&mut &workflow_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;

        // Simple average calculation (rating is 1-5, stored as 0-10000 where 10000 = 5.0)
        // rating * 2000 = rating in 0-10000 scale
        let rating_scaled = (rating as u16) * 2000;

        // Calculate new average
        if metadata.avg_rating == 0 {
            metadata.avg_rating = rating_scaled;
        } else {
            // Simple moving average (could be improved with review count)
            metadata.avg_rating =
                ((metadata.avg_rating as u32 + rating_scaled as u32) / 2) as u16;
        }

        // Re-serialize
        workflow_data[0] = WORKFLOW_METADATA_DISCRIMINATOR;
        workflow_data[1] = ACCOUNT_VERSION_V1;
        metadata
            .serialize(&mut &mut workflow_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    Ok(())
}
