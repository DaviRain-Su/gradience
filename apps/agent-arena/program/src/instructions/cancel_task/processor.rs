use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView, cpi::{Seed, Signer}, error::ProgramError, Address, ProgramResult,
};
use pinocchio_token::instructions::TransferChecked as SplTransferChecked;
use pinocchio_token_2022::instructions::TransferChecked as Token2022TransferChecked;

use crate::{
    constants::{BPS_DENOMINATOR, CANCEL_FEE_BPS},
    errors::GradienceProgramError,
    events::TaskCancelledEvent,
    instructions::CancelTask,
    state::{
        ACCOUNT_VERSION_V1, APPLICATION_DISCRIMINATOR, ESCROW_DISCRIMINATOR, TASK_DISCRIMINATOR,
        TREASURY_DISCRIMINATOR, Application, Escrow, Task, TaskState,
    },
    traits::EventSerialize,
    utils::{
        borsh_deserialize_padded, create_associated_token_account_if_needed, emit_event,
        token_program_kind as resolve_token_program_kind, validate_mint_and_get_decimals,
        verify_owned_by, verify_system_account, verify_token_account, verify_writable,
        TokenProgramKind,
    },
};

const TASK_SEED: &[u8] = b"task";
const ESCROW_SEED: &[u8] = b"escrow";
const APPLICATION_SEED: &[u8] = b"application";
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

pub fn process_cancel_task(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let ix = CancelTask::try_from((instruction_data, accounts))?;

    verify_owned_by(ix.accounts.task, program_id)?;
    verify_owned_by(ix.accounts.escrow, program_id)?;
    verify_owned_by(ix.accounts.treasury, program_id)?;

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
    if task.submission_count > 0 {
        return Err(GradienceProgramError::HasSubmissions.into());
    }

    let poster_bytes = address_to_bytes(ix.accounts.poster.address());
    if poster_bytes != task.poster {
        return Err(GradienceProgramError::NotTaskPoster.into());
    }

    let task_id_bytes = task.task_id.to_le_bytes();
    let (task_pda, _) = Address::find_program_address(&[TASK_SEED, task_id_bytes.as_ref()], program_id);
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

    let cancel_fee = task
        .reward
        .checked_mul(CANCEL_FEE_BPS as u64)
        .ok_or(GradienceProgramError::Overflow)?
        / BPS_DENOMINATOR;
    let poster_refund = task
        .reward
        .checked_sub(cancel_fee)
        .ok_or(GradienceProgramError::Overflow)?;

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

        create_associated_token_account_if_needed(
            ix.accounts.poster,
            token_accounts.poster_token_account,
            ix.accounts.poster,
            token_accounts.mint,
            token_accounts.token_program,
            token_accounts.associated_token_program,
            ix.accounts.system_program,
        )?;
        create_associated_token_account_if_needed(
            ix.accounts.poster,
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

        transfer_from_escrow_token(&transfer_ctx, token_accounts.poster_token_account, poster_refund)?;
        transfer_from_escrow_token(&transfer_ctx, token_accounts.treasury_ata, cancel_fee)?;

        let mut total_stake_returned = 0u64;
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

            transfer_from_escrow_token(&transfer_ctx, agent_account, application.stake_amount)?;
            total_stake_returned = total_stake_returned
                .checked_add(application.stake_amount)
                .ok_or(GradienceProgramError::Overflow)?;
        }

        let total_deducted = task
            .reward
            .checked_add(total_stake_returned)
            .ok_or(GradienceProgramError::Overflow)?;
        escrow.amount = escrow
            .amount
            .checked_sub(total_deducted)
            .ok_or(GradienceProgramError::Overflow)?;
    } else {
        transfer_program_lamports(ix.accounts.escrow, ix.accounts.poster, poster_refund)?;
        transfer_program_lamports(ix.accounts.escrow, ix.accounts.treasury, cancel_fee)?;

        let mut total_stake_returned = 0u64;
        for pair in ix.accounts.remaining_accounts.chunks_exact(2) {
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

            transfer_program_lamports(ix.accounts.escrow, agent_account, application.stake_amount)?;
            total_stake_returned = total_stake_returned
                .checked_add(application.stake_amount)
                .ok_or(GradienceProgramError::Overflow)?;
        }

        let total_deducted = task
            .reward
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

    let event = TaskCancelledEvent {
        task_id: task.task_id,
        poster: poster_bytes,
        refund_amount: poster_refund,
        protocol_fee: cancel_fee,
    };
    emit_event(
        program_id,
        ix.accounts.event_authority,
        ix.accounts.program,
        &event.to_bytes(),
    )?;

    Ok(())
}
