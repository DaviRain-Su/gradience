use alloc::vec::Vec;
use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView,
    cpi::Seed,
    error::ProgramError,
    sysvars::{clock::Clock, Sysvar},
    Address, ProgramResult,
};
use pinocchio_system::instructions::Transfer;

use crate::{
    constants::{LAMPORTS_PER_SOL, MAX_CATEGORIES, MAX_JUDGES_PER_POOL},
    errors::GradienceProgramError,
    events::JudgeRegisteredEvent,
    instructions::RegisterJudge,
    state::{
        ACCOUNT_VERSION_V1, JUDGE_POOL_DISCRIMINATOR, JUDGE_POOL_LEN, PROGRAM_CONFIG_DISCRIMINATOR,
        REPUTATION_DISCRIMINATOR, STAKE_DISCRIMINATOR, STAKE_LEN, JudgePool, JudgePoolEntry,
        ProgramConfig, Reputation, Stake,
    },
    traits::EventSerialize,
    utils::{borsh_deserialize_padded, create_pda_account, emit_event, verify_owned_by},
};

const CONFIG_SEED: &[u8] = b"config";
const STAKE_SEED: &[u8] = b"stake";
const REPUTATION_SEED: &[u8] = b"reputation";
const JUDGE_POOL_SEED: &[u8] = b"judge_pool";

#[inline(always)]
fn address_to_bytes(address: &Address) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(address.as_ref());
    bytes
}

pub fn process_register_judge(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let ix = RegisterJudge::try_from((instruction_data, accounts))?;

    verify_owned_by(ix.accounts.config, program_id)?;
    if ix.accounts.stake.data_len() != 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let categories_len = ix.data.categories.len();
    if categories_len == 0 || categories_len > MAX_CATEGORIES {
        return Err(GradienceProgramError::InvalidCategories.into());
    }
    if ix.accounts.remaining_accounts.len() != categories_len {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let config = {
        let config_data = ix.accounts.config.try_borrow()?;
        if config_data.len() < 2
            || config_data[0] != PROGRAM_CONFIG_DISCRIMINATOR
            || config_data[1] != ACCOUNT_VERSION_V1
        {
            return Err(ProgramError::InvalidAccountData);
        }
        ProgramConfig::try_from_slice(&config_data[2..]).map_err(|_| ProgramError::InvalidAccountData)?
    };

    if ix.data.stake_amount < config.min_judge_stake {
        return Err(GradienceProgramError::InsufficientJudgeStake.into());
    }

    let (config_pda, _) = Address::find_program_address(&[CONFIG_SEED], program_id);
    if ix.accounts.config.address() != &config_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let judge_bytes = address_to_bytes(ix.accounts.judge.address());
    let (stake_pda, stake_bump) = Address::find_program_address(
        &[STAKE_SEED, ix.accounts.judge.address().as_ref()],
        program_id,
    );
    if ix.accounts.stake.address() != &stake_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let (reputation_pda, _) = Address::find_program_address(
        &[REPUTATION_SEED, ix.accounts.judge.address().as_ref()],
        program_id,
    );
    if ix.accounts.reputation.address() != &reputation_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let reputation_avg_score = if ix.accounts.reputation.data_len() == 0 {
        0u16
    } else {
        verify_owned_by(ix.accounts.reputation, program_id)?;
        let reputation_data = ix.accounts.reputation.try_borrow()?;
        if reputation_data.len() < 2
            || reputation_data[0] != REPUTATION_DISCRIMINATOR
            || reputation_data[1] != ACCOUNT_VERSION_V1
        {
            return Err(ProgramError::InvalidAccountData);
        }
        let reputation = Reputation::try_from_slice(&reputation_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
        if reputation.agent != judge_bytes {
            return Err(ProgramError::InvalidAccountData);
        }
        reputation.global.avg_score
    };

    let mut seen_categories = [false; MAX_CATEGORIES];
    let mut category_storage = [0u8; MAX_CATEGORIES];
    for (idx, &category) in ix.data.categories.iter().enumerate() {
        let category_idx = usize::from(category);
        if category_idx >= MAX_CATEGORIES {
            return Err(GradienceProgramError::InvalidCategory.into());
        }
        if seen_categories[category_idx] {
            return Err(GradienceProgramError::InvalidCategories.into());
        }
        seen_categories[category_idx] = true;
        category_storage[idx] = category;
    }

    let stake_bump_seed = [stake_bump];
    create_pda_account(
        ix.accounts.judge,
        STAKE_LEN,
        program_id,
        ix.accounts.stake,
        [
            Seed::from(STAKE_SEED),
            Seed::from(ix.accounts.judge.address().as_ref()),
            Seed::from(stake_bump_seed.as_slice()),
        ],
    )?;

    Transfer {
        from: ix.accounts.judge,
        to: ix.accounts.stake,
        lamports: ix.data.stake_amount,
    }
    .invoke()?;

    let stake_weight = (ix.data.stake_amount / LAMPORTS_PER_SOL).min(1000);
    let reputation_weight = ((reputation_avg_score as u64) / 100).min(100);
    let weight = u32::try_from(
        stake_weight
            .checked_add(reputation_weight)
            .ok_or(GradienceProgramError::Overflow)?,
    )
    .map_err(|_| GradienceProgramError::Overflow)?;

    for (idx, pool_account) in ix.accounts.remaining_accounts.iter().enumerate() {
        let category = ix.data.categories[idx];
        let (pool_pda, pool_bump) =
            Address::find_program_address(&[JUDGE_POOL_SEED, &[category]], program_id);
        if pool_account.address() != &pool_pda {
            return Err(ProgramError::InvalidSeeds);
        }

        let mut pool = if pool_account.data_len() == 0 {
            let pool_bump_seed = [pool_bump];
            create_pda_account(
                ix.accounts.judge,
                JUDGE_POOL_LEN,
                program_id,
                pool_account,
                [
                    Seed::from(JUDGE_POOL_SEED),
                    Seed::from(&[category]),
                    Seed::from(pool_bump_seed.as_slice()),
                ],
            )?;

            JudgePool {
                category,
                total_weight: 0,
                entries: Vec::new(),
                bump: pool_bump,
            }
        } else {
            verify_owned_by(pool_account, program_id)?;
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
        if pool.entries.len() >= MAX_JUDGES_PER_POOL {
            return Err(GradienceProgramError::JudgePoolFull.into());
        }
        if pool.entries.iter().any(|entry| entry.judge == judge_bytes) {
            return Err(GradienceProgramError::AlreadyInPool.into());
        }

        pool.entries.push(JudgePoolEntry {
            judge: judge_bytes,
            weight,
        });
        pool.total_weight = pool
            .total_weight
            .checked_add(weight)
            .ok_or(GradienceProgramError::Overflow)?;

        let mut pool_data = pool_account.try_borrow_mut()?;
        pool_data[0] = JUDGE_POOL_DISCRIMINATOR;
        pool_data[1] = ACCOUNT_VERSION_V1;
        pool.serialize(&mut &mut pool_data[2..]).map_err(|_| ProgramError::InvalidAccountData)?;
    }

    let clock = Clock::get()?;
    let stake = Stake {
        judge: judge_bytes,
        amount: ix.data.stake_amount,
        categories: category_storage,
        category_count: categories_len as u8,
        registered_at: clock.unix_timestamp,
        cooldown_until: 0,
        bump: stake_bump,
    };

    {
        let mut stake_data = ix.accounts.stake.try_borrow_mut()?;
        stake_data[0] = STAKE_DISCRIMINATOR;
        stake_data[1] = ACCOUNT_VERSION_V1;
        stake
            .serialize(&mut &mut stake_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    let event = JudgeRegisteredEvent {
        judge: judge_bytes,
        stake: ix.data.stake_amount,
        categories: ix.data.categories.clone(),
    };
    emit_event(
        program_id,
        ix.accounts.event_authority,
        ix.accounts.program,
        &event.to_bytes(),
    )?;

    Ok(())
}
