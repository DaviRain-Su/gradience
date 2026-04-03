use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView, cpi::{Seed, Signer}, error::ProgramError, sysvars::clock::Clock,
    sysvars::Sysvar, Address, ProgramResult,
};
use pinocchio_token::instructions::TransferChecked as SplTransferChecked;
use pinocchio_token_2022::instructions::TransferChecked as Token2022TransferChecked;

use crate::{
    constants::{
        BPS_DENOMINATOR, FORCE_REFUND_DELAY, JUDGE_FEE_BPS, LAMPORTS_PER_SOL, MAX_CATEGORIES,
        PROTOCOL_FEE_BPS,
    },
    errors::GradienceProgramError,
    events::{TaskRefundedEvent, TASK_REFUND_REASON_FORCE_REFUND},
    instructions::ForceRefund,
    state::{
        ACCOUNT_VERSION_V1, APPLICATION_DISCRIMINATOR, ESCROW_DISCRIMINATOR,
        JUDGE_POOL_DISCRIMINATOR, PROGRAM_CONFIG_DISCRIMINATOR, REPUTATION_DISCRIMINATOR,
        STAKE_DISCRIMINATOR, TASK_DISCRIMINATOR, TREASURY_DISCRIMINATOR, Application, Escrow,
        JudgePool, ProgramConfig, Reputation, Stake, Task, TaskState,
    },
    traits::EventSerialize,
    utils::{
        borsh_deserialize_padded, close_pda_account, create_associated_token_account_if_needed, emit_event,
        token_program_kind as resolve_token_program_kind, validate_mint_and_get_decimals,
        verify_owned_by, verify_system_account, verify_token_account, verify_writable,
        TokenProgramKind,
    },
};

const CONFIG_SEED: &[u8] = b"config";
const TASK_SEED: &[u8] = b"task";
const ESCROW_SEED: &[u8] = b"escrow";
const APPLICATION_SEED: &[u8] = b"application";
const REPUTATION_SEED: &[u8] = b"reputation";
const STAKE_SEED: &[u8] = b"stake";
const JUDGE_POOL_SEED: &[u8] = b"judge_pool";
const TREASURY_SEED: &[u8] = b"treasury";

#[inline(always)]
fn address_to_bytes(address: &Address) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(address.as_ref());
    bytes
}

fn transfer_program_lamports(from: &AccountView, to: &AccountView, amount: u64) -> ProgramResult {
    if amount == 0 {
        return Ok(());
    }

    let from_lamports = from.lamports();
    if from_lamports < amount {
        return Err(ProgramError::InsufficientFunds);
    }
    let to_lamports = to.lamports();
    from.set_lamports(
        from_lamports
            .checked_sub(amount)
            .ok_or(ProgramError::ArithmeticOverflow)?,
    );
    to.set_lamports(
        to_lamports
            .checked_add(amount)
            .ok_or(ProgramError::ArithmeticOverflow)?,
    );
    Ok(())
}

struct EscrowTokenTransferCtx<'a> {
    kind: TokenProgramKind,
    from: &'a AccountView,
    mint: &'a AccountView,
    escrow: &'a AccountView,
    token_program: &'a AccountView,
    decimals: u8,
    task_id_bytes: [u8; 8],
    escrow_bump: u8,
}

fn transfer_from_escrow_token(
    ctx: &EscrowTokenTransferCtx<'_>,
    to: &AccountView,
    amount: u64,
) -> ProgramResult {
    if amount == 0 {
        return Ok(());
    }

    let escrow_bump_seed = [ctx.escrow_bump];
    let signer_seeds = [
        Seed::from(ESCROW_SEED),
        Seed::from(ctx.task_id_bytes.as_ref()),
        Seed::from(escrow_bump_seed.as_slice()),
    ];
    let signer = [Signer::from(&signer_seeds)];

    match ctx.kind {
        TokenProgramKind::Spl => SplTransferChecked {
            from: ctx.from,
            mint: ctx.mint,
            to,
            authority: ctx.escrow,
            amount,
            decimals: ctx.decimals,
        }
        .invoke_signed(&signer),
        TokenProgramKind::Token2022 => Token2022TransferChecked {
            from: ctx.from,
            mint: ctx.mint,
            to,
            authority: ctx.escrow,
            amount,
            decimals: ctx.decimals,
            token_program: ctx.token_program.address(),
        }
        .invoke_signed(&signer),
    }
}

fn parse_application(application: &AccountView) -> Result<Application, ProgramError> {
    let data = application.try_borrow()?;
    if data.len() < 2 || data[0] != APPLICATION_DISCRIMINATOR || data[1] != ACCOUNT_VERSION_V1 {
        return Err(ProgramError::InvalidAccountData);
    }
    Application::try_from_slice(&data[2..]).map_err(|_| ProgramError::InvalidAccountData)
}

pub fn process_force_refund(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let ix = ForceRefund::try_from((instruction_data, accounts))?;

    verify_owned_by(ix.accounts.config, program_id)?;
    verify_owned_by(ix.accounts.task, program_id)?;
    verify_owned_by(ix.accounts.escrow, program_id)?;
    verify_owned_by(ix.accounts.judge_stake, program_id)?;
    verify_owned_by(ix.accounts.treasury, program_id)?;

    let clock = Clock::get()?;

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
    let (config_pda, _) = Address::find_program_address(&[CONFIG_SEED], program_id);
    if ix.accounts.config.address() != &config_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let mut task: Task = {
        let task_data = ix.accounts.task.try_borrow()?;
        if task_data.len() < 2
            || task_data[0] != TASK_DISCRIMINATOR
            || task_data[1] != ACCOUNT_VERSION_V1
        {
            return Err(ProgramError::InvalidAccountData);
        }
        borsh_deserialize_padded(&task_data[2..])?
    };
    if task.state != TaskState::Open {
        return Err(GradienceProgramError::TaskNotOpen.into());
    }
    if task.submission_count == 0 {
        return Err(GradienceProgramError::NoSubmissions.into());
    }
    if clock.unix_timestamp <= task.judge_deadline {
        return Err(GradienceProgramError::JudgeDeadlineNotPassed.into());
    }
    let force_refund_after = task
        .judge_deadline
        .checked_add(FORCE_REFUND_DELAY)
        .ok_or(GradienceProgramError::Overflow)?;
    if clock.unix_timestamp <= force_refund_after {
        return Err(GradienceProgramError::ForceRefundDelayNotPassed.into());
    }

    let task_id_bytes = task.task_id.to_le_bytes();
    let (task_pda, _) =
        Address::find_program_address(&[TASK_SEED, task_id_bytes.as_ref()], program_id);
    if ix.accounts.task.address() != &task_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let (escrow_pda, _) =
        Address::find_program_address(&[ESCROW_SEED, task_id_bytes.as_ref()], program_id);
    if ix.accounts.escrow.address() != &escrow_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let (treasury_pda, _) = Address::find_program_address(&[TREASURY_SEED], program_id);
    if ix.accounts.treasury.address() != &treasury_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    if address_to_bytes(ix.accounts.poster_account.address()) != task.poster {
        return Err(ProgramError::InvalidInstructionData);
    }

    let judge_address = Address::new_from_array(task.judge);
    if address_to_bytes(ix.accounts.judge_account.address()) != task.judge {
        return Err(ProgramError::InvalidInstructionData);
    }

    let (stake_pda, _) =
        Address::find_program_address(&[STAKE_SEED, judge_address.as_ref()], program_id);
    if ix.accounts.judge_stake.address() != &stake_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let mut judge_stake = {
        let stake_data = ix.accounts.judge_stake.try_borrow()?;
        if stake_data.len() < 2
            || stake_data[0] != STAKE_DISCRIMINATOR
            || stake_data[1] != ACCOUNT_VERSION_V1
        {
            return Err(ProgramError::InvalidAccountData);
        }
        Stake::try_from_slice(&stake_data[2..]).map_err(|_| ProgramError::InvalidAccountData)?
    };
    if judge_stake.judge != task.judge {
        return Err(ProgramError::InvalidAccountData);
    }
    if judge_stake.category_count as usize > MAX_CATEGORIES {
        return Err(ProgramError::InvalidAccountData);
    }
    let pool_count = judge_stake.category_count as usize;
    if ix.accounts.remaining_accounts.len() < pool_count {
        return Err(ProgramError::NotEnoughAccountKeys);
    }
    let (judge_pool_accounts, refund_accounts) = ix.accounts.remaining_accounts.split_at(pool_count);
    if !refund_accounts.len().is_multiple_of(2) {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let (judge_reputation_pda, _) =
        Address::find_program_address(&[REPUTATION_SEED, judge_address.as_ref()], program_id);
    if ix.accounts.judge_reputation.address() != &judge_reputation_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let judge_avg_score = if ix.accounts.judge_reputation.data_len() == 0 {
        0u16
    } else {
        verify_owned_by(ix.accounts.judge_reputation, program_id)?;
        let reputation_data = ix.accounts.judge_reputation.try_borrow()?;
        if reputation_data.len() < 2
            || reputation_data[0] != REPUTATION_DISCRIMINATOR
            || reputation_data[1] != ACCOUNT_VERSION_V1
        {
            return Err(ProgramError::InvalidAccountData);
        }
        let reputation: Reputation = borsh_deserialize_padded(&reputation_data[2..])?;
        if reputation.agent != task.judge {
            return Err(ProgramError::InvalidAccountData);
        }
        reputation.global.avg_score
    };

    {
        let treasury_data = ix.accounts.treasury.try_borrow()?;
        if treasury_data.len() < 2
            || treasury_data[0] != TREASURY_DISCRIMINATOR
            || treasury_data[1] != ACCOUNT_VERSION_V1
        {
            return Err(ProgramError::InvalidAccountData);
        }
    }

    let mut escrow = {
        let escrow_data = ix.accounts.escrow.try_borrow()?;
        if escrow_data.len() < 2
            || escrow_data[0] != ESCROW_DISCRIMINATOR
            || escrow_data[1] != ACCOUNT_VERSION_V1
        {
            return Err(ProgramError::InvalidAccountData);
        }
        Escrow::try_from_slice(&escrow_data[2..]).map_err(|_| ProgramError::InvalidAccountData)?
    };
    if escrow.task_id != task.task_id || escrow.mint != task.mint {
        return Err(ProgramError::InvalidAccountData);
    }

    let is_sol_path = task.mint == [0u8; 32];
    let token_path_accounts = ix.accounts.token_path_accounts();
    if is_sol_path && token_path_accounts.is_some() {
        return Err(ProgramError::InvalidInstructionData);
    }
    if !is_sol_path && token_path_accounts.is_none() {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let reward = task.reward;
    let most_active_share = reward
        .checked_mul(JUDGE_FEE_BPS as u64)
        .ok_or(GradienceProgramError::Overflow)?
        / BPS_DENOMINATOR;
    let protocol_fee = reward
        .checked_mul(PROTOCOL_FEE_BPS as u64)
        .ok_or(GradienceProgramError::Overflow)?
        / BPS_DENOMINATOR;
    let poster_share = reward
        .checked_sub(most_active_share)
        .ok_or(GradienceProgramError::Overflow)?
        .checked_sub(protocol_fee)
        .ok_or(GradienceProgramError::Overflow)?;

    let slash_amount = config.min_judge_stake;
    let actual_slash = judge_stake.amount.min(slash_amount);
    let remaining_after_slash = judge_stake
        .amount
        .checked_sub(actual_slash)
        .ok_or(GradienceProgramError::Overflow)?;
    transfer_program_lamports(ix.accounts.judge_stake, ix.accounts.treasury, actual_slash)?;

    let keep_judge_in_pool = remaining_after_slash >= config.min_judge_stake;
    if keep_judge_in_pool {
        judge_stake.amount = remaining_after_slash;
    } else {
        judge_stake.amount = 0;
        transfer_program_lamports(ix.accounts.judge_stake, ix.accounts.judge_account, remaining_after_slash)?;
    }

    let recomputed_weight = if keep_judge_in_pool {
        let stake_weight = (remaining_after_slash / LAMPORTS_PER_SOL).min(1000);
        let reputation_weight = ((judge_avg_score as u64) / 100).min(100);
        u32::try_from(
            stake_weight
                .checked_add(reputation_weight)
                .ok_or(GradienceProgramError::Overflow)?,
        )
        .map_err(|_| GradienceProgramError::Overflow)?
    } else {
        0
    };

    for (idx, pool_account) in judge_pool_accounts.iter().enumerate() {
        verify_writable(pool_account)?;
        verify_owned_by(pool_account, program_id)?;

        let category = judge_stake.categories[idx];
        let (expected_pool_pda, _) =
            Address::find_program_address(&[JUDGE_POOL_SEED, &[category]], program_id);
        if pool_account.address() != &expected_pool_pda {
            return Err(ProgramError::InvalidSeeds);
        }

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
            .position(|entry| entry.judge == task.judge)
            .ok_or(ProgramError::InvalidAccountData)?;
        let old_weight = pool.entries[judge_index].weight;

        if keep_judge_in_pool {
            pool.entries[judge_index].weight = recomputed_weight;
            pool.total_weight = pool
                .total_weight
                .checked_sub(old_weight)
                .ok_or(GradienceProgramError::Overflow)?
                .checked_add(recomputed_weight)
                .ok_or(GradienceProgramError::Overflow)?;
        } else {
            pool.entries.remove(judge_index);
            pool.total_weight = pool
                .total_weight
                .checked_sub(old_weight)
                .ok_or(GradienceProgramError::Overflow)?;
        }

        let mut pool_data = pool_account.try_borrow_mut()?;
        pool_data[0] = JUDGE_POOL_DISCRIMINATOR;
        pool_data[1] = ACCOUNT_VERSION_V1;
        pool.serialize(&mut &mut pool_data[2..]).map_err(|_| ProgramError::InvalidAccountData)?;
    }

    let most_active_bytes = address_to_bytes(ix.accounts.most_active_agent.address());

    if let Some(token_accounts) = token_path_accounts {
        if address_to_bytes(token_accounts.mint.address()) != task.mint {
            return Err(ProgramError::InvalidInstructionData);
        }

        let kind = resolve_token_program_kind(token_accounts.token_program)?;
        let decimals = validate_mint_and_get_decimals(token_accounts.mint, kind)?;

        verify_token_account(
            token_accounts.escrow_ata,
            kind,
            token_accounts.mint.address(),
            ix.accounts.escrow.address(),
        )?;
        let poster_address = Address::new_from_array(task.poster);
        verify_token_account(
            token_accounts.poster_token_account,
            kind,
            token_accounts.mint.address(),
            &poster_address,
        )?;
        let most_active_address = Address::new_from_array(most_active_bytes);
        verify_token_account(
            token_accounts.most_active_agent_token_account,
            kind,
            token_accounts.mint.address(),
            &most_active_address,
        )?;

        create_associated_token_account_if_needed(
            ix.accounts.anyone,
            token_accounts.treasury_ata,
            ix.accounts.treasury,
            token_accounts.mint,
            token_accounts.token_program,
            token_accounts.associated_token_program,
            ix.accounts.system_program,
        )?;

        let transfer_ctx = EscrowTokenTransferCtx {
            kind,
            from: token_accounts.escrow_ata,
            mint: token_accounts.mint,
            escrow: ix.accounts.escrow,
            token_program: token_accounts.token_program,
            decimals,
            task_id_bytes,
            escrow_bump: escrow.bump,
        };

        transfer_from_escrow_token(&transfer_ctx, token_accounts.poster_token_account, poster_share)?;
        transfer_from_escrow_token(
            &transfer_ctx,
            token_accounts.most_active_agent_token_account,
            most_active_share,
        )?;
        transfer_from_escrow_token(&transfer_ctx, token_accounts.treasury_ata, protocol_fee)?;

        let mut total_stake_returned = 0u64;
        let mut most_active_seen = false;
        for pair in refund_accounts.chunks_exact(2) {
            let [application_account, agent_account] = pair else {
                return Err(ProgramError::NotEnoughAccountKeys);
            };
            verify_writable(agent_account)?;
            verify_owned_by(application_account, program_id)?;
            let application = parse_application(application_account)?;
            if application.task_id != task.task_id {
                return Err(ProgramError::InvalidAccountData);
            }
            let agent_address = Address::new_from_array(application.agent);
            verify_token_account(
                agent_account,
                kind,
                token_accounts.mint.address(),
                &agent_address,
            )?;
            let (expected_application_pda, _) = Address::find_program_address(
                &[APPLICATION_SEED, task_id_bytes.as_ref(), agent_address.as_ref()],
                program_id,
            );
            if application_account.address() != &expected_application_pda {
                return Err(ProgramError::InvalidSeeds);
            }
            if application.agent == most_active_bytes {
                most_active_seen = true;
            }

            transfer_from_escrow_token(&transfer_ctx, agent_account, application.stake_amount)?;
            total_stake_returned = total_stake_returned
                .checked_add(application.stake_amount)
                .ok_or(GradienceProgramError::Overflow)?;
        }
        if !most_active_seen {
            return Err(ProgramError::InvalidInstructionData);
        }

        let total_deducted = reward
            .checked_add(total_stake_returned)
            .ok_or(GradienceProgramError::Overflow)?;
        escrow.amount = escrow
            .amount
            .checked_sub(total_deducted)
            .ok_or(GradienceProgramError::Overflow)?;
    } else {
        verify_system_account(ix.accounts.poster_account)?;
        verify_system_account(ix.accounts.most_active_agent)?;
        if address_to_bytes(ix.accounts.poster_account.address()) != task.poster {
            return Err(ProgramError::InvalidInstructionData);
        }

        transfer_program_lamports(ix.accounts.escrow, ix.accounts.poster_account, poster_share)?;
        transfer_program_lamports(ix.accounts.escrow, ix.accounts.most_active_agent, most_active_share)?;
        transfer_program_lamports(ix.accounts.escrow, ix.accounts.treasury, protocol_fee)?;

        let mut total_stake_returned = 0u64;
        let mut most_active_seen = false;
        for pair in refund_accounts.chunks_exact(2) {
            let [application_account, agent_account] = pair else {
                return Err(ProgramError::NotEnoughAccountKeys);
            };
            verify_writable(agent_account)?;
            verify_system_account(agent_account)?;
            verify_owned_by(application_account, program_id)?;
            let application = parse_application(application_account)?;
            if application.task_id != task.task_id {
                return Err(ProgramError::InvalidAccountData);
            }
            if address_to_bytes(agent_account.address()) != application.agent {
                return Err(ProgramError::InvalidAccountData);
            }
            let agent_address = Address::new_from_array(application.agent);
            let (expected_application_pda, _) = Address::find_program_address(
                &[APPLICATION_SEED, task_id_bytes.as_ref(), agent_address.as_ref()],
                program_id,
            );
            if application_account.address() != &expected_application_pda {
                return Err(ProgramError::InvalidSeeds);
            }
            if application.agent == most_active_bytes {
                most_active_seen = true;
            }

            transfer_program_lamports(ix.accounts.escrow, agent_account, application.stake_amount)?;
            total_stake_returned = total_stake_returned
                .checked_add(application.stake_amount)
                .ok_or(GradienceProgramError::Overflow)?;
        }
        if !most_active_seen {
            return Err(ProgramError::InvalidInstructionData);
        }

        let total_deducted = reward
            .checked_add(total_stake_returned)
            .ok_or(GradienceProgramError::Overflow)?;
        escrow.amount = escrow
            .amount
            .checked_sub(total_deducted)
            .ok_or(GradienceProgramError::Overflow)?;
    }

    task.state = TaskState::Refunded;
    task.winner = None;

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

    if keep_judge_in_pool {
        let mut stake_data = ix.accounts.judge_stake.try_borrow_mut()?;
        stake_data[0] = STAKE_DISCRIMINATOR;
        stake_data[1] = ACCOUNT_VERSION_V1;
        judge_stake
            .serialize(&mut &mut stake_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    } else {
        close_pda_account(ix.accounts.judge_stake, ix.accounts.judge_account)?;
    }

    let event = TaskRefundedEvent {
        task_id: task.task_id,
        reason: TASK_REFUND_REASON_FORCE_REFUND,
        amount: poster_share,
    };
    emit_event(
        program_id,
        ix.accounts.event_authority,
        ix.accounts.program,
        &event.to_bytes(),
    )?;

    Ok(())
}
