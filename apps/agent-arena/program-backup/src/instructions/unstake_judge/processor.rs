use alloc::vec::Vec;
use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView,
    error::ProgramError,
    sysvars::{clock::Clock, Sysvar},
    Address, ProgramResult,
};

use crate::{
    constants::MAX_CATEGORIES,
    errors::GradienceProgramError,
    events::JudgeUnstakedEvent,
    instructions::UnstakeJudge,
    state::{
        ACCOUNT_VERSION_V1, JUDGE_POOL_DISCRIMINATOR, STAKE_DISCRIMINATOR, Stake, JudgePool,
    },
    traits::EventSerialize,
    utils::{borsh_deserialize_padded, close_pda_account, emit_event, verify_owned_by},
};

const STAKE_SEED: &[u8] = b"stake";
const JUDGE_POOL_SEED: &[u8] = b"judge_pool";

#[inline(always)]
fn address_to_bytes(address: &Address) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(address.as_ref());
    bytes
}

pub fn process_unstake_judge(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let ix = UnstakeJudge::try_from((instruction_data, accounts))?;

    verify_owned_by(ix.accounts.stake, program_id)?;

    let judge_bytes = address_to_bytes(ix.accounts.judge.address());
    let (stake_pda, _) = Address::find_program_address(
        &[STAKE_SEED, ix.accounts.judge.address().as_ref()],
        program_id,
    );
    if ix.accounts.stake.address() != &stake_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let stake = {
        let stake_data = ix.accounts.stake.try_borrow()?;
        if stake_data.len() < 2
            || stake_data[0] != STAKE_DISCRIMINATOR
            || stake_data[1] != ACCOUNT_VERSION_V1
        {
            return Err(ProgramError::InvalidAccountData);
        }
        Stake::try_from_slice(&stake_data[2..]).map_err(|_| ProgramError::InvalidAccountData)?
    };
    if stake.judge != judge_bytes {
        return Err(ProgramError::InvalidAccountData);
    }

    let pool_count = stake.category_count as usize;
    if pool_count > MAX_CATEGORIES {
        return Err(ProgramError::InvalidAccountData);
    }
    if ix.accounts.remaining_accounts.len() != pool_count {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let clock = Clock::get()?;
    if clock.unix_timestamp <= stake.cooldown_until {
        return Err(GradienceProgramError::CooldownNotExpired.into());
    }

    for (idx, pool_account) in ix.accounts.remaining_accounts.iter().enumerate() {
        let category = stake.categories[idx];
        let (pool_pda, _) =
            Address::find_program_address(&[JUDGE_POOL_SEED, &[category]], program_id);
        if pool_account.address() != &pool_pda {
            return Err(ProgramError::InvalidSeeds);
        }

        verify_owned_by(pool_account, program_id)?;
        let mut pool: JudgePool = {
            let pool_data = pool_account.try_borrow()?;
            if pool_data.len() < 2
                || pool_data[0] != JUDGE_POOL_DISCRIMINATOR
                || pool_data[1] != ACCOUNT_VERSION_V1
            {
                return Err(ProgramError::InvalidAccountData);
            }
            borsh_deserialize_padded(&pool_data[2..])?
        };
        if pool.category != category {
            return Err(ProgramError::InvalidAccountData);
        }

        let judge_index = pool
            .entries
            .iter()
            .position(|entry| entry.judge == judge_bytes)
            .ok_or(ProgramError::InvalidAccountData)?;
        let removed_weight = pool.entries[judge_index].weight;
        pool.entries.remove(judge_index);
        pool.total_weight = pool
            .total_weight
            .checked_sub(removed_weight)
            .ok_or(GradienceProgramError::Overflow)?;

        let mut pool_data = pool_account.try_borrow_mut()?;
        pool_data[0] = JUDGE_POOL_DISCRIMINATOR;
        pool_data[1] = ACCOUNT_VERSION_V1;
        pool.serialize(&mut &mut pool_data[2..]).map_err(|_| ProgramError::InvalidAccountData)?;
    }

    let returned_stake = stake.amount;
    let categories: Vec<u8> = stake.categories[..pool_count].to_vec();
    close_pda_account(ix.accounts.stake, ix.accounts.judge)?;

    let event = JudgeUnstakedEvent {
        judge: judge_bytes,
        returned_stake,
        categories,
    };
    emit_event(
        program_id,
        ix.accounts.event_authority,
        ix.accounts.program,
        &event.to_bytes(),
    )?;

    Ok(())
}
