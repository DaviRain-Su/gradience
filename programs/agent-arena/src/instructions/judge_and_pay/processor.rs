use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView, cpi::{Seed, Signer}, error::ProgramError, sysvars::clock::Clock,
    sysvars::Sysvar, Address, ProgramResult,
};
use pinocchio_token::instructions::TransferChecked as SplTransferChecked;
use pinocchio_token_2022::instructions::TransferChecked as Token2022TransferChecked;

use crate::{
    constants::{
        BPS_DENOMINATOR, JUDGE_FEE_BPS, MAX_CATEGORIES, MAX_REF_LEN, MAX_SCORE, MIN_SCORE,
        PROTOCOL_FEE_BPS, UNSTAKE_COOLDOWN,
    },
    errors::GradienceProgramError,
    events::{TaskJudgedEvent, TaskRefundedEvent, TASK_REFUND_REASON_LOW_SCORE},
    instructions::JudgeAndPay,
    state::{
        ACCOUNT_VERSION_V1, APPLICATION_DISCRIMINATOR, ESCROW_DISCRIMINATOR,
        REPUTATION_DISCRIMINATOR, STAKE_DISCRIMINATOR, SUBMISSION_DISCRIMINATOR,
        TASK_DISCRIMINATOR, TREASURY_DISCRIMINATOR, Application, Escrow, Reputation, Stake,
        Submission, Task, TaskState,
    },
    traits::EventSerialize,
    utils::{
        borsh_deserialize_padded, create_associated_token_account_if_needed,
        derive_associated_token_address, emit_event,
        token_program_kind as resolve_token_program_kind, validate_mint_and_get_decimals,
        verify_owned_by, verify_token_account, verify_writable, TokenProgramKind,
    },
};

const TASK_SEED: &[u8] = b"task";
const ESCROW_SEED: &[u8] = b"escrow";
const APPLICATION_SEED: &[u8] = b"application";
const SUBMISSION_SEED: &[u8] = b"submission";
const REPUTATION_SEED: &[u8] = b"reputation";
const STAKE_SEED: &[u8] = b"stake";
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

fn parse_reputation(reputation: &AccountView) -> Result<Reputation, ProgramError> {
    let data = reputation.try_borrow()?;
    if data.len() < 2 || data[0] != REPUTATION_DISCRIMINATOR || data[1] != ACCOUNT_VERSION_V1 {
        return Err(ProgramError::InvalidAccountData);
    }
    Reputation::try_from_slice(&data[2..]).map_err(|_| ProgramError::InvalidAccountData)
}

fn update_reputation(
    reputation: &mut Reputation,
    selected_agent: [u8; 32],
    task_category: u8,
    score: u8,
    agent_payout: u64,
) -> Result<(), ProgramError> {
    if reputation.agent != selected_agent {
        return Err(ProgramError::InvalidAccountData);
    }
    if task_category as usize >= MAX_CATEGORIES {
        return Err(ProgramError::InvalidAccountData);
    }

    let prev_completed = reputation.global.completed;
    let next_completed = prev_completed
        .checked_add(1)
        .ok_or(GradienceProgramError::Overflow)?;
    let avg_numerator = (reputation.global.avg_score as u128)
        .checked_mul(prev_completed as u128)
        .and_then(|v| v.checked_add((score as u128) * 100))
        .ok_or(GradienceProgramError::Overflow)?;
    let avg_score = avg_numerator / (next_completed as u128);

    reputation.global.completed = next_completed;
    reputation.global.avg_score = u16::try_from(avg_score).map_err(|_| GradienceProgramError::Overflow)?;
    reputation.global.total_earned = reputation
        .global
        .total_earned
        .checked_add(agent_payout)
        .ok_or(GradienceProgramError::Overflow)?;
    reputation.global.win_rate = if reputation.global.total_applied == 0 {
        0
    } else {
        let win_rate = ((next_completed as u128) * 10_000) / (reputation.global.total_applied as u128);
        u16::try_from(win_rate).map_err(|_| GradienceProgramError::Overflow)?
    };

    let category_stats = &mut reputation.by_category[task_category as usize];
    let prev_category_completed = category_stats.completed;
    let next_category_completed = prev_category_completed
        .checked_add(1)
        .ok_or(GradienceProgramError::Overflow)?;
    let category_avg_numerator = (category_stats.avg_score as u128)
        .checked_mul(prev_category_completed as u128)
        .and_then(|v| v.checked_add((score as u128) * 100))
        .ok_or(GradienceProgramError::Overflow)?;
    let category_avg_score = category_avg_numerator / (next_category_completed as u128);

    category_stats.completed = next_category_completed;
    category_stats.avg_score =
        u16::try_from(category_avg_score).map_err(|_| GradienceProgramError::Overflow)?;

    Ok(())
}

pub fn process_judge_and_pay(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let ix = JudgeAndPay::try_from((instruction_data, accounts))?;

    verify_owned_by(ix.accounts.task, program_id)?;
    verify_owned_by(ix.accounts.escrow, program_id)?;
    verify_owned_by(ix.accounts.winner_application, program_id)?;
    verify_owned_by(ix.accounts.winner_submission, program_id)?;
    verify_owned_by(ix.accounts.winner_reputation, program_id)?;
    verify_owned_by(ix.accounts.judge_stake, program_id)?;
    verify_owned_by(ix.accounts.treasury, program_id)?;

    if ix.data.winner == [0u8; 32] {
        return Err(ProgramError::InvalidInstructionData);
    }
    if ix.data.score > MAX_SCORE {
        return Err(GradienceProgramError::InvalidScore.into());
    }
    if let Some(reason_ref) = &ix.data.reason_ref {
        if reason_ref.len() > MAX_REF_LEN {
            return Err(GradienceProgramError::RefTooLong.into());
        }
    }

    let clock = Clock::get()?;

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

    let is_sol_path = task.mint == [0u8; 32];
    let token_path_accounts = ix.accounts.token_path_accounts();
    if is_sol_path && token_path_accounts.is_some() {
        return Err(ProgramError::InvalidInstructionData);
    }
    if !is_sol_path && token_path_accounts.is_none() {
        return Err(ProgramError::NotEnoughAccountKeys);
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

    let judge_bytes = address_to_bytes(ix.accounts.judge.address());
    if task.judge != judge_bytes {
        return Err(GradienceProgramError::NotTaskJudge.into());
    }
    let (stake_pda, _) =
        Address::find_program_address(&[STAKE_SEED, ix.accounts.judge.address().as_ref()], program_id);
    if ix.accounts.judge_stake.address() != &stake_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    if address_to_bytes(ix.accounts.poster_account.address()) != task.poster {
        return Err(ProgramError::InvalidInstructionData);
    }

    // Schema keeps `winner_*` names, but internally this is the selected agent for evaluation.
    let selected_agent = ix.data.winner;
    if address_to_bytes(ix.accounts.winner_account.address()) != selected_agent {
        return Err(ProgramError::InvalidInstructionData);
    }
    let selected_agent_address = Address::new_from_array(selected_agent);

    let (winner_application_pda, _) = Address::find_program_address(
        &[APPLICATION_SEED, task_id_bytes.as_ref(), selected_agent_address.as_ref()],
        program_id,
    );
    if ix.accounts.winner_application.address() != &winner_application_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let (winner_submission_pda, _) = Address::find_program_address(
        &[SUBMISSION_SEED, task_id_bytes.as_ref(), selected_agent_address.as_ref()],
        program_id,
    );
    if ix.accounts.winner_submission.address() != &winner_submission_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let (winner_reputation_pda, _) =
        Address::find_program_address(&[REPUTATION_SEED, selected_agent_address.as_ref()], program_id);
    if ix.accounts.winner_reputation.address() != &winner_reputation_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let winner_application = parse_application(ix.accounts.winner_application)?;
    if winner_application.task_id != task.task_id || winner_application.agent != selected_agent {
        return Err(GradienceProgramError::AgentNotApplied.into());
    }

    {
        let submission_data = ix.accounts.winner_submission.try_borrow()?;
        if submission_data.len() < 2
            || submission_data[0] != SUBMISSION_DISCRIMINATOR
            || submission_data[1] != ACCOUNT_VERSION_V1
        {
            return Err(ProgramError::InvalidAccountData);
        }
        let submission: Submission = borsh_deserialize_padded(&submission_data[2..])?;
        if submission.task_id != task.task_id || submission.agent != selected_agent {
            return Err(GradienceProgramError::WinnerNoSubmission.into());
        }
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
    if judge_stake.judge != judge_bytes {
        return Err(GradienceProgramError::NotTaskJudge.into());
    }
    judge_stake.cooldown_until = clock
        .unix_timestamp
        .checked_add(UNSTAKE_COOLDOWN)
        .ok_or(GradienceProgramError::Overflow)?;

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

    let token_flow = if let Some(token_accounts) = token_path_accounts {
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
        verify_token_account(
            token_accounts.winner_token_account,
            kind,
            token_accounts.mint.address(),
            ix.accounts.winner_account.address(),
        )?;
        verify_token_account(
            token_accounts.judge_token_account,
            kind,
            token_accounts.mint.address(),
            ix.accounts.judge.address(),
        )?;
        verify_token_account(
            token_accounts.poster_token_account,
            kind,
            token_accounts.mint.address(),
            ix.accounts.poster_account.address(),
        )?;

        create_associated_token_account_if_needed(
            ix.accounts.judge,
            token_accounts.treasury_ata,
            ix.accounts.treasury,
            token_accounts.mint,
            token_accounts.token_program,
            token_accounts.associated_token_program,
            ix.accounts.system_program,
        )?;

        Some((token_accounts, kind, decimals))
    } else {
        None
    };

    let reward = task.reward;
    let is_low_score = ix.data.score < MIN_SCORE;

    // Fee calculation: 95% Agent / 3% Judge / 2% Protocol
    // 
    // Implementation note: We use subtraction for agent_payout instead of
    // direct percentage (reward * 9500 / 10000) to ensure zero precision loss.
    // This guarantees: agent_payout + judge_fee + protocol_fee == reward
    // 
    // Example with reward = 100 lamports:
    //   judge_fee = 100 * 300 / 10000 = 3
    //   protocol_fee = 100 * 200 / 10000 = 2
    //   agent_payout = 100 - 3 - 2 = 95  ✅ Exact match
    //
    // If we used direct percentage:
    //   agent_payout = 100 * 9500 / 10000 = 95  ✅ Same result
    //   
    // But with indivisible amounts:
    //   reward = 1 lamport
    //   judge_fee = 1 * 300 / 10000 = 0
    //   protocol_fee = 1 * 200 / 10000 = 0
    //   agent_payout = 1 - 0 - 0 = 1  ✅ No dust loss

    let judge_fee = if is_low_score {
        0
    } else {
        reward
            .checked_mul(JUDGE_FEE_BPS as u64)
            .ok_or(GradienceProgramError::Overflow)?
            / BPS_DENOMINATOR
    };
    let protocol_fee = if is_low_score {
        0
    } else {
        reward
            .checked_mul(PROTOCOL_FEE_BPS as u64)
            .ok_or(GradienceProgramError::Overflow)?
            / BPS_DENOMINATOR
    };
    let agent_payout = if is_low_score {
        0
    } else {
        // Use subtraction to ensure exact sum (avoid rounding errors)
        reward
            .checked_sub(judge_fee)
            .ok_or(GradienceProgramError::Overflow)?
            .checked_sub(protocol_fee)
            .ok_or(GradienceProgramError::Overflow)?
    };

    if let Some((token_accounts, kind, decimals)) = token_flow {
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

        if is_low_score {
            transfer_from_escrow_token(
                &transfer_ctx,
                token_accounts.poster_token_account,
                reward,
            )?;
        } else {
            transfer_from_escrow_token(
                &transfer_ctx,
                token_accounts.winner_token_account,
                agent_payout,
            )?;
            transfer_from_escrow_token(
                &transfer_ctx,
                token_accounts.judge_token_account,
                judge_fee,
            )?;
            transfer_from_escrow_token(
                &transfer_ctx,
                token_accounts.treasury_ata,
                protocol_fee,
            )?;
        }

        let mut total_stake_returned = winner_application.stake_amount;
        transfer_from_escrow_token(
            &transfer_ctx,
            token_accounts.winner_token_account,
            winner_application.stake_amount,
        )?;

        for pair in ix.accounts.remaining_accounts.chunks_exact(2) {
            let [application_account, agent_account] = pair else {
                return Err(ProgramError::NotEnoughAccountKeys);
            };
            verify_writable(agent_account)?;
            verify_owned_by(application_account, program_id)?;
            let application = parse_application(application_account)?;
            if application.task_id != task.task_id {
                return Err(ProgramError::InvalidAccountData);
            }
            if application.agent == selected_agent {
                return Err(ProgramError::InvalidAccountData);
            }
            let agent_address = Address::new_from_array(application.agent);
            let expected_agent_ata = derive_associated_token_address(
                &agent_address,
                token_accounts.mint.address(),
                token_accounts.token_program.address(),
            );
            if agent_account.address() != &expected_agent_ata {
                return Err(ProgramError::InvalidAccountData);
            }
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

            transfer_from_escrow_token(
                &transfer_ctx,
                agent_account,
                application.stake_amount,
            )?;
            total_stake_returned = total_stake_returned
                .checked_add(application.stake_amount)
                .ok_or(GradienceProgramError::Overflow)?;
        }

        let total_deducted = reward
            .checked_add(total_stake_returned)
            .ok_or(GradienceProgramError::Overflow)?;
        escrow.amount = escrow
            .amount
            .checked_sub(total_deducted)
            .ok_or(GradienceProgramError::Overflow)?;
    } else {
        if is_low_score {
            transfer_program_lamports(ix.accounts.escrow, ix.accounts.poster_account, reward)?;
        } else {
            transfer_program_lamports(ix.accounts.escrow, ix.accounts.winner_account, agent_payout)?;
            transfer_program_lamports(ix.accounts.escrow, ix.accounts.judge, judge_fee)?;
            transfer_program_lamports(ix.accounts.escrow, ix.accounts.treasury, protocol_fee)?;
        }

        let mut total_stake_returned = winner_application.stake_amount;
        transfer_program_lamports(
            ix.accounts.escrow,
            ix.accounts.winner_account,
            winner_application.stake_amount,
        )?;

        for pair in ix.accounts.remaining_accounts.chunks_exact(2) {
            let [application_account, agent_account] = pair else {
                return Err(ProgramError::NotEnoughAccountKeys);
            };
            verify_writable(agent_account)?;
            verify_owned_by(application_account, program_id)?;
            let application = parse_application(application_account)?;
            if application.task_id != task.task_id {
                return Err(ProgramError::InvalidAccountData);
            }
            if application.agent == selected_agent {
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

            transfer_program_lamports(ix.accounts.escrow, agent_account, application.stake_amount)?;
            total_stake_returned = total_stake_returned
                .checked_add(application.stake_amount)
                .ok_or(GradienceProgramError::Overflow)?;
        }

        let total_deducted = reward
            .checked_add(total_stake_returned)
            .ok_or(GradienceProgramError::Overflow)?;
        escrow.amount = escrow
            .amount
            .checked_sub(total_deducted)
            .ok_or(GradienceProgramError::Overflow)?;
    }

    if is_low_score {
        task.state = TaskState::Refunded;
        task.winner = None;
    } else {
        let mut winner_reputation = parse_reputation(ix.accounts.winner_reputation)?;
        update_reputation(
            &mut winner_reputation,
            selected_agent,
            task.category,
            ix.data.score,
            agent_payout,
        )?;

        {
            let mut reputation_data = ix.accounts.winner_reputation.try_borrow_mut()?;
            reputation_data[0] = REPUTATION_DISCRIMINATOR;
            reputation_data[1] = ACCOUNT_VERSION_V1;
            winner_reputation
                .serialize(&mut &mut reputation_data[2..])
                .map_err(|_| ProgramError::InvalidAccountData)?;
        }

        task.state = TaskState::Completed;
        task.winner = Some(selected_agent);
    }

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

    {
        let mut stake_data = ix.accounts.judge_stake.try_borrow_mut()?;
        stake_data[0] = STAKE_DISCRIMINATOR;
        stake_data[1] = ACCOUNT_VERSION_V1;
        judge_stake
            .serialize(&mut &mut stake_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    if is_low_score {
        let event = TaskRefundedEvent {
            task_id: task.task_id,
            reason: TASK_REFUND_REASON_LOW_SCORE,
            amount: reward,
        };
        emit_event(
            program_id,
            ix.accounts.event_authority,
            ix.accounts.program,
            &event.to_bytes(),
        )?;
    } else {
        let event = TaskJudgedEvent {
            task_id: task.task_id,
            winner: selected_agent,
            score: ix.data.score,
            agent_payout,
            judge_fee,
            protocol_fee,
        };
        emit_event(
            program_id,
            ix.accounts.event_authority,
            ix.accounts.program,
            &event.to_bytes(),
        )?;
    }

    Ok(())
}
