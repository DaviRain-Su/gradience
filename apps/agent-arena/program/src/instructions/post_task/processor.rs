use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView, cpi::Seed, error::ProgramError, sysvars::clock::Clock, sysvars::Sysvar,
    Address, ProgramResult,
};
use pinocchio_system::instructions::Transfer;

use crate::{
    constants::{MAX_CATEGORIES, MAX_REF_LEN},
    errors::GradienceProgramError,
    events::TaskCreatedEvent,
    instructions::PostTask,
    state::{
        ACCOUNT_VERSION_V1, ESCROW_DISCRIMINATOR, ESCROW_LEN, JUDGE_POOL_DISCRIMINATOR,
        JUDGE_POOL_LEN, PROGRAM_CONFIG_DISCRIMINATOR, TASK_DISCRIMINATOR, TASK_LEN, Escrow,
        JudgeMode, JudgePool, ProgramConfig, Task, TaskState,
    },
    traits::EventSerialize,
    utils::{create_pda_account, emit_event, verify_owned_by},
};

const CONFIG_SEED: &[u8] = b"config";
const TASK_SEED: &[u8] = b"task";
const ESCROW_SEED: &[u8] = b"escrow";

#[inline(always)]
fn address_to_bytes(address: &Address) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(address.as_ref());
    bytes
}

#[inline(always)]
fn derive_task_pda(program_id: &Address, task_id: u64) -> (Address, u8, [u8; 8]) {
    let task_id_bytes = task_id.to_le_bytes();
    let (pda, bump) = Address::find_program_address(&[TASK_SEED, task_id_bytes.as_ref()], program_id);
    (pda, bump, task_id_bytes)
}

#[inline(always)]
fn derive_escrow_pda(program_id: &Address, task_id_bytes: &[u8; 8]) -> (Address, u8) {
    Address::find_program_address(&[ESCROW_SEED, task_id_bytes.as_ref()], program_id)
}

#[inline(always)]
fn select_pool_judge(
    program_id: &Address,
    judge_pool_account: &AccountView,
    category: u8,
    task_id: u64,
    slot: u64,
) -> Result<[u8; 32], ProgramError> {
    verify_owned_by(judge_pool_account, program_id)?;

    if judge_pool_account.data_len() < JUDGE_POOL_LEN {
        return Err(GradienceProgramError::JudgePoolEmpty.into());
    }

    let data = judge_pool_account.try_borrow()?;
    if data[0] != JUDGE_POOL_DISCRIMINATOR || data[1] != ACCOUNT_VERSION_V1 {
        return Err(ProgramError::InvalidAccountData);
    }

    let pool = JudgePool::try_from_slice(&data[2..]).map_err(|_| ProgramError::InvalidAccountData)?;
    if pool.category != category || pool.entries.is_empty() || pool.total_weight == 0 {
        return Err(GradienceProgramError::JudgePoolEmpty.into());
    }

    let point = ((slot as u32).wrapping_add(task_id as u32)) % pool.total_weight;
    let mut cumulative: u32 = 0;
    for entry in &pool.entries {
        cumulative = cumulative.saturating_add(entry.weight);
        if point < cumulative {
            return Ok(entry.judge);
        }
    }

    pool.entries
        .last()
        .map(|entry| entry.judge)
        .ok_or_else(|| GradienceProgramError::JudgePoolEmpty.into())
}

pub fn process_post_task(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let ix = PostTask::try_from((instruction_data, accounts))?;

    verify_owned_by(ix.accounts.config, program_id)?;

    if ix.data.reward == 0 {
        return Err(GradienceProgramError::ZeroReward.into());
    }
    if ix.data.eval_ref.is_empty() {
        return Err(GradienceProgramError::EmptyRef.into());
    }
    if ix.data.eval_ref.len() > MAX_REF_LEN {
        return Err(GradienceProgramError::RefTooLong.into());
    }
    if ix.data.category >= MAX_CATEGORIES as u8 {
        return Err(GradienceProgramError::InvalidCategory.into());
    }

    let clock = Clock::get()?;
    if ix.data.deadline <= clock.unix_timestamp {
        return Err(GradienceProgramError::InvalidDeadline.into());
    }
    if ix.data.judge_deadline <= ix.data.deadline {
        return Err(GradienceProgramError::InvalidJudgeDeadline.into());
    }

    let mut config = {
        let config_data = ix.accounts.config.try_borrow()?;
        if config_data.len() < 2
            || config_data[0] != PROGRAM_CONFIG_DISCRIMINATOR
            || config_data[1] != ACCOUNT_VERSION_V1
        {
            return Err(ProgramError::InvalidAccountData);
        }
        ProgramConfig::try_from_slice(&config_data[2..]).map_err(|_| ProgramError::InvalidAccountData)?
    };

    let (config_pda, _) = Address::find_program_address(&[CONFIG_SEED], program_id);
    if ix.accounts.config.address() != &config_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let task_id = config.task_count;
    let (task_pda, task_bump, task_id_bytes) = derive_task_pda(program_id, task_id);
    if ix.accounts.task.address() != &task_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let (escrow_pda, escrow_bump) = derive_escrow_pda(program_id, &task_id_bytes);
    if ix.accounts.escrow.address() != &escrow_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let (judge_mode, judge) = match ix.data.judge_mode {
        0 => {
            if ix.data.judge == [0u8; 32] {
                return Err(ProgramError::InvalidInstructionData);
            }
            (JudgeMode::Designated, ix.data.judge)
        }
        1 => (
            JudgeMode::Pool,
            select_pool_judge(
                program_id,
                ix.accounts.judge_pool,
                ix.data.category,
                task_id,
                clock.slot,
            )?,
        ),
        _ => return Err(ProgramError::InvalidInstructionData),
    };

    let task = Task {
        task_id,
        poster: address_to_bytes(ix.accounts.poster.address()),
        judge,
        judge_mode,
        reward: ix.data.reward,
        mint: [0u8; 32],
        min_stake: ix.data.min_stake,
        state: TaskState::Open,
        category: ix.data.category,
        eval_ref: ix.data.eval_ref.clone(),
        deadline: ix.data.deadline,
        judge_deadline: ix.data.judge_deadline,
        submission_count: 0,
        winner: None,
        created_at: clock.unix_timestamp,
        bump: task_bump,
    };

    let escrow = Escrow {
        task_id,
        mint: [0u8; 32],
        amount: ix.data.reward,
        bump: escrow_bump,
    };

    let task_bump_seed = [task_bump];
    create_pda_account(
        ix.accounts.poster,
        TASK_LEN,
        program_id,
        ix.accounts.task,
        [
            Seed::from(TASK_SEED),
            Seed::from(task_id_bytes.as_slice()),
            Seed::from(task_bump_seed.as_slice()),
        ],
    )?;

    let escrow_bump_seed = [escrow_bump];
    create_pda_account(
        ix.accounts.poster,
        ESCROW_LEN,
        program_id,
        ix.accounts.escrow,
        [
            Seed::from(ESCROW_SEED),
            Seed::from(task_id_bytes.as_slice()),
            Seed::from(escrow_bump_seed.as_slice()),
        ],
    )?;

    Transfer {
        from: ix.accounts.poster,
        to: ix.accounts.escrow,
        lamports: ix.data.reward,
    }
    .invoke()?;

    {
        let mut task_data = ix.accounts.task.try_borrow_mut()?;
        task_data[0] = TASK_DISCRIMINATOR;
        task_data[1] = ACCOUNT_VERSION_V1;
        task.serialize(&mut &mut task_data[2..]).map_err(|_| ProgramError::InvalidAccountData)?;
    }

    {
        let mut escrow_data = ix.accounts.escrow.try_borrow_mut()?;
        escrow_data[0] = ESCROW_DISCRIMINATOR;
        escrow_data[1] = ACCOUNT_VERSION_V1;
        escrow
            .serialize(&mut &mut escrow_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    config.task_count = config
        .task_count
        .checked_add(1)
        .ok_or(GradienceProgramError::Overflow)?;

    {
        let mut config_data = ix.accounts.config.try_borrow_mut()?;
        config_data[0] = PROGRAM_CONFIG_DISCRIMINATOR;
        config_data[1] = ACCOUNT_VERSION_V1;
        config
            .serialize(&mut &mut config_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    let event = TaskCreatedEvent {
        task_id,
        poster: address_to_bytes(ix.accounts.poster.address()),
        judge,
        reward: ix.data.reward,
        category: ix.data.category,
        deadline: ix.data.deadline,
    };
    emit_event(
        program_id,
        ix.accounts.event_authority,
        ix.accounts.program,
        &event.to_bytes(),
    )?;
    Ok(())
}
