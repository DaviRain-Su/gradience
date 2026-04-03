use borsh::BorshSerialize;
use pinocchio::{
    account::AccountView,
    address::Address,
    cpi::Seed,
    error::ProgramError,
    sysvars::{clock::Clock, Sysvar},
    ProgramResult,
};

use crate::{
    constants::{ACCOUNT_VERSION_V1, WORKFLOW_SEED},
    errors::WorkflowError,
    state::{
        PricingModel, WorkflowMetadata, WORKFLOW_METADATA_DISCRIMINATOR, WORKFLOW_METADATA_LEN,
    },
    utils::{address_to_bytes, create_pda_account},
};

/// Create a new workflow
///
/// Accounts:
/// 0. [signer, writable] Author (creator)
/// 1. [writable] Workflow PDA
/// 2. [] System program
///
/// Data layout (156 bytes):
/// - workflow_id: [u8; 32]
/// - content_hash: [u8; 64]
/// - version: [u8; 16]
/// - pricing_model: u8
/// - price_mint: [u8; 32]
/// - price_amount: u64 (8 bytes)
/// - creator_share: u16 (2 bytes)
/// - is_public: u8 (1 byte)
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

    // Check author is signer
    if !author.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Parse data
    if data.len() < 156 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let mut offset = 0;

    // Parse workflow_id
    let mut workflow_id = [0u8; 32];
    workflow_id.copy_from_slice(&data[offset..offset + 32]);
    offset += 32;

    // Parse content_hash
    let mut content_hash = [0u8; 64];
    content_hash.copy_from_slice(&data[offset..offset + 64]);
    offset += 64;

    // Parse version
    let mut version = [0u8; 16];
    version.copy_from_slice(&data[offset..offset + 16]);
    offset += 16;

    // Parse pricing_model
    let pricing_model = data[offset];
    offset += 1;

    // Validate pricing model
    if PricingModel::from_u8(pricing_model).is_none() {
        return Err(WorkflowError::InvalidPricingModel.into());
    }

    // Parse price_mint
    let mut price_mint = [0u8; 32];
    price_mint.copy_from_slice(&data[offset..offset + 32]);
    offset += 32;

    // Parse price_amount
    let price_amount = u64::from_le_bytes([
        data[offset],
        data[offset + 1],
        data[offset + 2],
        data[offset + 3],
        data[offset + 4],
        data[offset + 5],
        data[offset + 6],
        data[offset + 7],
    ]);
    offset += 8;

    // Parse creator_share
    let creator_share = u16::from_le_bytes([data[offset], data[offset + 1]]);
    offset += 2;

    // Validate creator share (max 10000 bps = 100%)
    if creator_share > 10000 {
        return Err(WorkflowError::InvalidPricingModel.into());
    }

    // Parse is_public
    let is_public = data[offset] != 0;

    // Derive workflow PDA
    let (workflow_pda, workflow_bump) =
        Address::find_program_address(&[WORKFLOW_SEED, &workflow_id], program_id);

    if workflow_account.address() != &workflow_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    // Check if already exists
    if workflow_account.data_len() > 0 {
        return Err(WorkflowError::WorkflowAlreadyExists.into());
    }

    // Create workflow account
    let workflow_bump_seed = [workflow_bump];
    create_pda_account(
        author,
        WORKFLOW_METADATA_LEN,
        program_id,
        workflow_account,
        [
            Seed::from(WORKFLOW_SEED),
            Seed::from(workflow_id.as_slice()),
            Seed::from(workflow_bump_seed.as_slice()),
        ],
    )?;

    // Get current timestamp
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    // Create workflow metadata
    let metadata = WorkflowMetadata {
        workflow_id,
        author: address_to_bytes(author.address()),
        content_hash,
        version,
        pricing_model,
        price_mint,
        price_amount,
        creator_share,
        total_purchases: 0,
        total_executions: 0,
        avg_rating: 0,
        is_public,
        is_active: true,
        created_at: now,
        updated_at: now,
        bump: workflow_bump,
    };

    // Serialize to account
    {
        let mut account_data = workflow_account.try_borrow_mut()?;
        account_data[0] = WORKFLOW_METADATA_DISCRIMINATOR;
        account_data[1] = ACCOUNT_VERSION_V1;
        metadata
            .serialize(&mut &mut account_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    Ok(())
}
