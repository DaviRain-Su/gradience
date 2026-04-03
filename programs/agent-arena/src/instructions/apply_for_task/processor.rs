use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView, cpi::Seed, error::ProgramError, sysvars::clock::Clock, sysvars::Sysvar,
    Address, ProgramResult,
};
use pinocchio_system::instructions::Transfer;
use pinocchio_token::instructions::TransferChecked as SplTransferChecked;
use pinocchio_token_2022::instructions::TransferChecked as Token2022TransferChecked;

use crate::{
    constants::MAX_CATEGORIES,
    errors::GradienceProgramError,
    events::TaskAppliedEvent,
    instructions::ApplyForTask,
    state::{
        ACCOUNT_VERSION_V1, APPLICATION_DISCRIMINATOR, APPLICATION_LEN, ESCROW_DISCRIMINATOR,
        REPUTATION_DISCRIMINATOR, REPUTATION_LEN, TASK_DISCRIMINATOR, Application, CategoryStats,
        Escrow, Reputation, ReputationStats, Task, TaskState,
    },
    traits::EventSerialize,
    utils::{
        borsh_deserialize_padded, create_pda_account, emit_event, token_program_kind as resolve_token_program_kind,
        validate_mint_and_get_decimals, verify_owned_by, verify_system_account, verify_token_account,
        TokenProgramKind,
    },
};

const TASK_SEED: &[u8] = b"task";
const ESCROW_SEED: &[u8] = b"escrow";
const APPLICATION_SEED: &[u8] = b"application";
const REPUTATION_SEED: &[u8] = b"reputation";

#[inline(always)]
fn address_to_bytes(address: &Address) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(address.as_ref());
    bytes
}

#[inline(always)]
fn derive_task_pda(program_id: &Address, task_id: u64) -> (Address, [u8; 8]) {
    let task_id_bytes = task_id.to_le_bytes();
    let (pda, _) = Address::find_program_address(&[TASK_SEED, task_id_bytes.as_ref()], program_id);
    (pda, task_id_bytes)
}

#[inline(always)]
fn derive_escrow_pda(program_id: &Address, task_id_bytes: &[u8; 8]) -> Address {
    let (pda, _) = Address::find_program_address(&[ESCROW_SEED, task_id_bytes.as_ref()], program_id);
    pda
}

#[inline(always)]
fn derive_application_pda(
    program_id: &Address,
    task_id_bytes: &[u8; 8],
    agent: &Address,
) -> (Address, u8) {
    Address::find_program_address(
        &[APPLICATION_SEED, task_id_bytes.as_ref(), agent.as_ref()],
        program_id,
    )
}

#[inline(always)]
fn derive_reputation_pda(program_id: &Address, agent: &Address) -> (Address, u8) {
    Address::find_program_address(&[REPUTATION_SEED, agent.as_ref()], program_id)
}

fn init_reputation(agent: [u8; 32], bump: u8) -> Reputation {
    let mut by_category = [CategoryStats::default(); MAX_CATEGORIES];
    for (idx, stats) in by_category.iter_mut().enumerate() {
        stats.category = idx as u8;
    }

    Reputation {
        agent,
        global: ReputationStats::default(),
        by_category,
        bump,
    }
}

pub fn process_apply_for_task(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let ix = ApplyForTask::try_from((instruction_data, accounts))?;

    verify_owned_by(ix.accounts.task, program_id)?;
    verify_owned_by(ix.accounts.escrow, program_id)?;

    if ix.accounts.application.data_len() > 0 {
        return Err(GradienceProgramError::AlreadyApplied.into());
    }

    let clock = Clock::get()?;
    let task: Task = {
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
    if clock.unix_timestamp >= task.deadline {
        return Err(GradienceProgramError::DeadlinePassed.into());
    }
    // `submission_count` is intentionally not updated here; it is incremented in `submit_result`.

    let (expected_task_pda, task_id_bytes) = derive_task_pda(program_id, task.task_id);
    if ix.accounts.task.address() != &expected_task_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let expected_escrow_pda = derive_escrow_pda(program_id, &task_id_bytes);
    if ix.accounts.escrow.address() != &expected_escrow_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let (expected_application_pda, application_bump) =
        derive_application_pda(program_id, &task_id_bytes, ix.accounts.agent.address());
    if ix.accounts.application.address() != &expected_application_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let (expected_reputation_pda, reputation_bump) =
        derive_reputation_pda(program_id, ix.accounts.agent.address());
    if ix.accounts.reputation.address() != &expected_reputation_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let stake_amount = task.min_stake;
    let is_sol_path = task.mint == [0u8; 32];
    let token_path_accounts = ix.accounts.token_path_accounts();

    if is_sol_path {
        if token_path_accounts.is_some() {
            return Err(ProgramError::InvalidInstructionData);
        }
        if stake_amount > 0 && ix.accounts.agent.lamports() < stake_amount {
            return Err(GradienceProgramError::InsufficientAgentStake.into());
        }
    } else if stake_amount > 0 && token_path_accounts.is_none() {
        return Err(ProgramError::NotEnoughAccountKeys);
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
            token_accounts.agent_token_account,
            kind,
            token_accounts.mint.address(),
            ix.accounts.agent.address(),
        )?;
        verify_token_account(
            token_accounts.escrow_ata,
            kind,
            token_accounts.mint.address(),
            ix.accounts.escrow.address(),
        )?;

        if stake_amount > 0 {
            match kind {
                TokenProgramKind::Spl => {
                    let source = pinocchio_token::state::TokenAccount::from_account_view(
                        token_accounts.agent_token_account,
                    )?;
                    if source.amount() < stake_amount {
                        return Err(GradienceProgramError::InsufficientAgentStake.into());
                    }
                }
                TokenProgramKind::Token2022 => {
                    let source = pinocchio_token_2022::state::TokenAccount::from_account_view(
                        token_accounts.agent_token_account,
                    )?;
                    if source.amount() < stake_amount {
                        return Err(GradienceProgramError::InsufficientAgentStake.into());
                    }
                }
            }
        }

        Some((token_accounts, kind, decimals))
    } else {
        None
    };

    let application_bump_seed = [application_bump];
    create_pda_account(
        ix.accounts.agent,
        APPLICATION_LEN,
        program_id,
        ix.accounts.application,
        [
            Seed::from(APPLICATION_SEED),
            Seed::from(task_id_bytes.as_slice()),
            Seed::from(ix.accounts.agent.address().as_ref()),
            Seed::from(application_bump_seed.as_slice()),
        ],
    )?;

    let mut reputation = if ix.accounts.reputation.data_len() == 0 {
        verify_system_account(ix.accounts.reputation)?;
        let reputation_bump_seed = [reputation_bump];
        create_pda_account(
            ix.accounts.agent,
            REPUTATION_LEN,
            program_id,
            ix.accounts.reputation,
            [
                Seed::from(REPUTATION_SEED),
                Seed::from(ix.accounts.agent.address().as_ref()),
                Seed::from(reputation_bump_seed.as_slice()),
            ],
        )?;
        init_reputation(address_to_bytes(ix.accounts.agent.address()), reputation_bump)
    } else {
        verify_owned_by(ix.accounts.reputation, program_id)?;
        let data = ix.accounts.reputation.try_borrow()?;
        if data.len() < 2
            || data[0] != REPUTATION_DISCRIMINATOR
            || data[1] != ACCOUNT_VERSION_V1
        {
            return Err(ProgramError::InvalidAccountData);
        }
        let reputation =
            Reputation::try_from_slice(&data[2..]).map_err(|_| ProgramError::InvalidAccountData)?;
        if reputation.agent != address_to_bytes(ix.accounts.agent.address()) {
            return Err(ProgramError::InvalidAccountData);
        }
        reputation
    };

    if stake_amount > 0 {
        if let Some((token_accounts, kind, decimals)) = token_flow {
            match kind {
                TokenProgramKind::Spl => SplTransferChecked {
                    from: token_accounts.agent_token_account,
                    mint: token_accounts.mint,
                    to: token_accounts.escrow_ata,
                    authority: ix.accounts.agent,
                    amount: stake_amount,
                    decimals,
                }
                .invoke()?,
                TokenProgramKind::Token2022 => Token2022TransferChecked {
                    from: token_accounts.agent_token_account,
                    mint: token_accounts.mint,
                    to: token_accounts.escrow_ata,
                    authority: ix.accounts.agent,
                    amount: stake_amount,
                    decimals,
                    token_program: token_accounts.token_program.address(),
                }
                .invoke()?,
            }
        } else {
            Transfer {
                from: ix.accounts.agent,
                to: ix.accounts.escrow,
                lamports: stake_amount,
            }
            .invoke()?;
        }
    }

    let application = Application {
        task_id: task.task_id,
        agent: address_to_bytes(ix.accounts.agent.address()),
        stake_amount,
        applied_at: clock.unix_timestamp,
        bump: application_bump,
    };

    escrow.amount = escrow
        .amount
        .checked_add(stake_amount)
        .ok_or(GradienceProgramError::Overflow)?;

    reputation.global.total_applied = reputation
        .global
        .total_applied
        .checked_add(1)
        .ok_or(GradienceProgramError::Overflow)?;

    {
        let mut application_data = ix.accounts.application.try_borrow_mut()?;
        application_data[0] = APPLICATION_DISCRIMINATOR;
        application_data[1] = ACCOUNT_VERSION_V1;
        application
            .serialize(&mut &mut application_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
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
        let mut reputation_data = ix.accounts.reputation.try_borrow_mut()?;
        reputation_data[0] = REPUTATION_DISCRIMINATOR;
        reputation_data[1] = ACCOUNT_VERSION_V1;
        reputation
            .serialize(&mut &mut reputation_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    let event = TaskAppliedEvent {
        task_id: task.task_id,
        agent: address_to_bytes(ix.accounts.agent.address()),
        stake: stake_amount,
        slot: clock.slot,
    };
    emit_event(
        program_id,
        ix.accounts.event_authority,
        ix.accounts.program,
        &event.to_bytes(),
    )?;

    Ok(())
}
