use borsh::BorshSerialize;
use pinocchio::{account::AccountView, cpi::Seed, error::ProgramError, Address, ProgramResult};

use crate::{
    constants::MIN_JUDGE_STAKE,
    instructions::Initialize,
    state::{ProgramConfig, Treasury, PROGRAM_CONFIG_DATA_LEN, TREASURY_DATA_LEN},
    utils::create_pda_account,
};

const CONFIG_SEED: &[u8] = b"config";
const TREASURY_SEED: &[u8] = b"treasury";

#[inline(always)]
fn address_to_bytes(address: &Address) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(address.as_ref());
    bytes
}

pub fn process_initialize(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let ix = Initialize::try_from((instruction_data, accounts))?;

    if ix.accounts.config.data_len() > 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }
    if ix.accounts.treasury.data_len() > 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let (config_pda, config_bump) = Address::find_program_address(&[CONFIG_SEED], program_id);
    if ix.accounts.config.address() != &config_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let (treasury_pda, treasury_bump) =
        Address::find_program_address(&[TREASURY_SEED], program_id);
    if ix.accounts.treasury.address() != &treasury_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let config_bump_seed = [config_bump];
    create_pda_account(
        ix.accounts.payer,
        PROGRAM_CONFIG_DATA_LEN,
        program_id,
        ix.accounts.config,
        [
            Seed::from(CONFIG_SEED),
            Seed::from(config_bump_seed.as_slice()),
        ],
    )?;

    let treasury_bump_seed = [treasury_bump];
    create_pda_account(
        ix.accounts.payer,
        TREASURY_DATA_LEN,
        program_id,
        ix.accounts.treasury,
        [
            Seed::from(TREASURY_SEED),
            Seed::from(treasury_bump_seed.as_slice()),
        ],
    )?;

    let config = ProgramConfig {
        treasury: address_to_bytes(ix.accounts.treasury.address()),
        upgrade_authority: ix.data.upgrade_authority,
        min_judge_stake: if ix.data.min_judge_stake == 0 {
            MIN_JUDGE_STAKE
        } else {
            ix.data.min_judge_stake
        },
        task_count: 0,
        bump: config_bump,
    };

    let treasury = Treasury {
        bump: treasury_bump,
    };

    {
        let mut data = ix.accounts.config.try_borrow_mut()?;
        config
            .serialize(&mut &mut data[..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    {
        let mut data = ix.accounts.treasury.try_borrow_mut()?;
        treasury
            .serialize(&mut &mut data[..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    Ok(())
}
