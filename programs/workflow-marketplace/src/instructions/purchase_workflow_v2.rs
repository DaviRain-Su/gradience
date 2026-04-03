use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView,
    address::Address,
    cpi::Seed,
    error::ProgramError,
    sysvars::{clock::Clock, Sysvar},
    ProgramResult,
};
use pinocchio_system::instructions::Transfer;

use crate::{
    constants::{ACCESS_SEED, ACCOUNT_VERSION_V1, CONFIG_SEED, TREASURY_SEED, WORKFLOW_SEED},
    errors::WorkflowError,
    state::{
        ProgramConfig, WorkflowAccess, WorkflowMetadata, WORKFLOW_ACCESS_DISCRIMINATOR,
        WORKFLOW_ACCESS_LEN, WORKFLOW_METADATA_DISCRIMINATOR, PROGRAM_CONFIG_DISCRIMINATOR,
    },
    utils::{address_to_bytes, create_pda_account},
};

/// Purchase a workflow with payment
///
/// Accounts:
/// 0. [signer, writable] Buyer (pays for workflow + rent)
/// 1. [writable] Workflow PDA (read metadata, update purchases)
/// 2. [writable] Access PDA (to create)
/// 3. [writable] Author (receives payment)
/// 4. [writable] Treasury PDA (receives protocol fee)
/// 5. [] Config PDA (read fees)
/// 6. [] System program
///
/// Data layout (33 bytes):
/// - workflow_id: [u8; 32]
/// - access_type: u8 (0=purchased, 1=subscribed, 2=rented)
///
/// Payment Flow:
/// - Read price from workflow metadata
/// - Calculate splits: creator_share, protocol_fee (from config)
/// - Transfer to author: price * creator_share / 10000
/// - Transfer to treasury: price * protocol_fee / 10000
/// - Remainder to author (if any)
pub fn process(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    if accounts.len() < 7 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let buyer = &accounts[0];
    let workflow_account = &accounts[1];
    let access_account = &accounts[2];
    let author = &accounts[3];
    let treasury = &accounts[4];
    let config_account = &accounts[5];
    let _system_program = &accounts[6];

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

    // Verify config PDA
    let (config_pda, _) = Address::find_program_address(&[CONFIG_SEED], program_id);
    if config_account.address() != &config_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    // Verify treasury PDA
    let (treasury_pda, _) = Address::find_program_address(&[TREASURY_SEED], program_id);
    if treasury.address() != &treasury_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    // Check workflow exists
    if workflow_account.data_len() == 0 {
        return Err(WorkflowError::WorkflowNotFound.into());
    }

    // Read workflow metadata
    let (metadata, price_amount, author_expected) = {
        let workflow_data = workflow_account.try_borrow()?;
        if workflow_data[0] != WORKFLOW_METADATA_DISCRIMINATOR {
            return Err(ProgramError::InvalidAccountData);
        }

        let metadata = WorkflowMetadata::deserialize(&mut &workflow_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;

        if !metadata.is_active {
            return Err(WorkflowError::WorkflowInactive.into());
        }

        (metadata.clone(), metadata.price_amount, metadata.author)
    };

    // Verify author address matches
    if author.address().as_ref() != &author_expected {
        return Err(ProgramError::InvalidAccountData);
    }

    // Read config for fee rates
    let protocol_fee_bps = {
        let config_data = config_account.try_borrow()?;
        if config_data[0] != PROGRAM_CONFIG_DISCRIMINATOR {
            return Err(ProgramError::InvalidAccountData);
        }

        let config = ProgramConfig::deserialize(&mut &config_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;

        config.protocol_fee_bps
    };

    // Verify access PDA
    let buyer_bytes = address_to_bytes(buyer.address());
    let (access_pda, access_bump) =
        Address::find_program_address(&[ACCESS_SEED, &workflow_id, &buyer_bytes], program_id);
    if access_account.address() != &access_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    // Check access doesn't already exist
    if access_account.data_len() > 0 {
        return Err(WorkflowError::WorkflowAlreadyExists.into());
    }

    // Calculate payment splits (if price > 0)
    if price_amount > 0 {
        // Protocol fee (from config, e.g., 2% = 200 bps)
        let protocol_amount = (price_amount as u128)
            .checked_mul(protocol_fee_bps as u128)
            .and_then(|x| x.checked_div(10000))
            .and_then(|x| u64::try_from(x).ok())
            .ok_or(ProgramError::ArithmeticOverflow)?;

        // Creator share (from metadata, e.g., 5% = 500 bps)
        let creator_share_bps = metadata.creator_share;
        let creator_amount = (price_amount as u128)
            .checked_mul(creator_share_bps as u128)
            .and_then(|x| x.checked_div(10000))
            .and_then(|x| u64::try_from(x).ok())
            .ok_or(ProgramError::ArithmeticOverflow)?;

        // Author receives: price - protocol_fee
        let author_amount = price_amount
            .checked_sub(protocol_amount)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        // Transfer protocol fee to treasury
        if protocol_amount > 0 {
            Transfer {
                from: buyer,
                to: treasury,
                lamports: protocol_amount,
            }
            .invoke()?;
        }

        // Transfer payment to author
        if author_amount > 0 {
            Transfer {
                from: buyer,
                to: author,
                lamports: author_amount,
            }
            .invoke()?;
        }
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

    // Calculate expiration for subscriptions
    let expires_at = match access_type {
        1 => now + (30 * 24 * 60 * 60), // Subscription: 30 days
        2 => now + (7 * 24 * 60 * 60),  // Rental: 7 days
        _ => 0,                          // One-time: never expires
    };

    // Create access record
    let access = WorkflowAccess {
        workflow_id,
        user: buyer_bytes,
        access_type,
        purchased_at: now,
        expires_at,
        executions: 0,
        max_executions: 0, // Unlimited (could be set based on pricing model)
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
