use borsh::BorshSerialize;
use pinocchio::{account::AccountView, address::Address, cpi::Seed, error::ProgramError, ProgramResult};

use crate::{
    constants::{ACCOUNT_VERSION_V1, CONFIG_SEED, TREASURY_SEED},
    state::{
        ProgramConfig, Treasury, PROGRAM_CONFIG_DISCRIMINATOR, PROGRAM_CONFIG_LEN,
        TREASURY_DISCRIMINATOR, TREASURY_LEN,
    },
    utils::{address_to_bytes, create_pda_account},
};

/// Initialize the program
///
/// Accounts:
/// 0. [signer, writable] Payer
/// 1. [writable] Config PDA
/// 2. [writable] Treasury PDA
/// 3. [] System program
///
/// Data:
/// - treasury: [u8; 32]
/// - upgrade_authority: [u8; 32]
pub fn process(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    if accounts.len() < 3 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let payer = &accounts[0];
    let config_account = &accounts[1];
    let treasury_account = &accounts[2];

    // Check payer is signer
    if !payer.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Parse data
    if data.len() < 64 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let mut treasury_bytes = [0u8; 32];
    treasury_bytes.copy_from_slice(&data[0..32]);

    let mut upgrade_authority = [0u8; 32];
    upgrade_authority.copy_from_slice(&data[32..64]);

    // Check accounts are not already initialized
    if config_account.data_len() > 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }
    if treasury_account.data_len() > 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // Verify PDAs
    let (config_pda, config_bump) = Address::find_program_address(&[CONFIG_SEED], program_id);
    if config_account.address() != &config_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let (treasury_pda, treasury_bump) =
        Address::find_program_address(&[TREASURY_SEED], program_id);
    if treasury_account.address() != &treasury_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    // Create config PDA
    let config_bump_seed = [config_bump];
    create_pda_account(
        payer,
        PROGRAM_CONFIG_LEN,
        program_id,
        config_account,
        [
            Seed::from(CONFIG_SEED),
            Seed::from(config_bump_seed.as_slice()),
        ],
    )?;

    // Create treasury PDA
    let treasury_bump_seed = [treasury_bump];
    create_pda_account(
        payer,
        TREASURY_LEN,
        program_id,
        treasury_account,
        [
            Seed::from(TREASURY_SEED),
            Seed::from(treasury_bump_seed.as_slice()),
        ],
    )?;

    // Initialize config
    let config = ProgramConfig {
        treasury: treasury_bytes,
        upgrade_authority,
        protocol_fee_bps: 200, // 2%
        judge_fee_bps: 300,    // 3%
        bump: config_bump,
    };

    // Initialize treasury
    let treasury = Treasury {
        bump: treasury_bump,
    };

    // Write config data
    {
        let mut data = config_account.try_borrow_mut()?;
        data[0] = PROGRAM_CONFIG_DISCRIMINATOR;
        data[1] = ACCOUNT_VERSION_V1;
        config
            .serialize(&mut &mut data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    // Write treasury data
    {
        let mut data = treasury_account.try_borrow_mut()?;
        data[0] = TREASURY_DISCRIMINATOR;
        data[1] = ACCOUNT_VERSION_V1;
        treasury
            .serialize(&mut &mut data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    Ok(())
}
