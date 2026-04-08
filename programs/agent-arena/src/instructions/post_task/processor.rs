use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView,
    cpi::{invoke_signed, Seed, Signer},
    error::ProgramError,
    instruction::{InstructionAccount, InstructionView},
    sysvars::clock::Clock,
    sysvars::slot_hashes::SlotHashes,
    sysvars::Sysvar,
    Address, ProgramResult,
};
use pinocchio_token::instructions::TransferChecked as SplTransferChecked;
use pinocchio_token_2022::instructions::TransferChecked as Token2022TransferChecked;
use pinocchio_system::instructions::Transfer;
use const_crypto::sha2::Sha256;

use crate::{
    constants::{MAX_CATEGORIES, MAX_REF_LEN},
    errors::GradienceProgramError,
    events::TaskCreatedEvent,
    instructions::PostTask,
    state::{
        ACCOUNT_VERSION_V1, ESCROW_DISCRIMINATOR, ESCROW_LEN, JUDGE_POOL_DISCRIMINATOR,
        PROGRAM_CONFIG_DISCRIMINATOR, TASK_DISCRIMINATOR, TASK_LEN, Escrow, JudgeMode, JudgePool,
        ProgramConfig, Task, TaskState,
    },
    traits::EventSerialize,
    utils::{
        borsh_deserialize_padded, create_associated_token_account_if_needed, create_pda_account, emit_event,
        token_program_kind as resolve_token_program_kind, validate_mint_and_get_decimals,
        verify_owned_by, verify_token_account, TokenProgramKind,
    },
};

const CONFIG_SEED: &[u8] = b"config";
const TASK_SEED: &[u8] = b"task";
const ESCROW_SEED: &[u8] = b"escrow";
const PERMISSION_SEED: &[u8] = b"permission:";
const CREATE_PERMISSION_DISCRIMINATOR: &[u8] = &[0, 0, 0, 0, 0, 0, 0, 0];
const PERMISSION_PROGRAM_ID: [u8; 32] = [
    0x88, 0xa1, 0x0a, 0xc4, 0x21, 0x98, 0x01, 0xd6, 0xf6, 0x6a, 0x1d, 0x3c, 0x06, 0x98, 0xc0,
    0x66, 0xa9, 0xaf, 0xd4, 0xd9, 0xb4, 0xfc, 0xe7, 0x47, 0x97, 0x8d, 0xd1, 0x05, 0xa8, 0xd4,
    0x67, 0x52,
];

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

    const JUDGE_POOL_MIN_LEN: usize = 2 + 1 + 4 + 4 + 1; // header + category + total_weight + vec_len + bump
    if judge_pool_account.data_len() < JUDGE_POOL_MIN_LEN {
        return Err(GradienceProgramError::JudgePoolEmpty.into());
    }

    let data = judge_pool_account.try_borrow()?;
    if data[0] != JUDGE_POOL_DISCRIMINATOR || data[1] != ACCOUNT_VERSION_V1 {
        return Err(ProgramError::InvalidAccountData);
    }

    let pool: JudgePool = borsh_deserialize_padded(&data[2..])?;
    if pool.category != category || pool.entries.is_empty() || pool.total_weight == 0 {
        return Err(GradienceProgramError::JudgePoolEmpty.into());
    }

    let recent_hash = {
        let slot_hashes = SlotHashes::fetch()?;
        let first = slot_hashes
            .entries()
            .first()
            .ok_or(ProgramError::InvalidAccountData)?;
        first.hash
    };

    let seed = Sha256::new()
        .update(&recent_hash)
        .update(&task_id.to_le_bytes())
        .update(&slot.to_le_bytes())
        .finalize();

    let mut point_bytes = [0u8; 8];
    point_bytes.copy_from_slice(&seed[0..8]);
    let point = u64::from_le_bytes(point_bytes) % (pool.total_weight as u64);

    let mut cumulative: u64 = 0;
    for entry in &pool.entries {
        cumulative = cumulative.saturating_add(entry.weight as u64);
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

    let is_sol_path = ix.data.mint == [0u8; 32];
    let token_path_accounts = ix.accounts.token_path_accounts();
    if is_sol_path && token_path_accounts.is_some() {
        return Err(ProgramError::InvalidInstructionData);
    }
    if !is_sol_path && token_path_accounts.is_none() {
        return Err(ProgramError::NotEnoughAccountKeys);
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

    let token_flow = if let Some(token_accounts) = token_path_accounts {
        if address_to_bytes(token_accounts.mint.address()) != ix.data.mint {
            return Err(ProgramError::InvalidInstructionData);
        }

        let kind = resolve_token_program_kind(token_accounts.token_program)?;
        let decimals = validate_mint_and_get_decimals(token_accounts.mint, kind)?;
        verify_token_account(
            token_accounts.poster_token_account,
            kind,
            token_accounts.mint.address(),
            ix.accounts.poster.address(),
        )?;

        Some((token_accounts, kind, decimals))
    } else {
        None
    };

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
        mint: ix.data.mint,
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
        mint: ix.data.mint,
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

    if let Some((token_accounts, kind, decimals)) = token_flow {
        create_associated_token_account_if_needed(
            ix.accounts.poster,
            token_accounts.escrow_ata,
            ix.accounts.escrow,
            token_accounts.mint,
            token_accounts.token_program,
            token_accounts.associated_token_program,
            ix.accounts.system_program,
        )?;

        match kind {
            TokenProgramKind::Spl => SplTransferChecked {
                from: token_accounts.poster_token_account,
                mint: token_accounts.mint,
                to: token_accounts.escrow_ata,
                authority: ix.accounts.poster,
                amount: ix.data.reward,
                decimals,
            }
            .invoke()?,
            TokenProgramKind::Token2022 => Token2022TransferChecked {
                from: token_accounts.poster_token_account,
                mint: token_accounts.mint,
                to: token_accounts.escrow_ata,
                authority: ix.accounts.poster,
                amount: ix.data.reward,
                decimals,
                token_program: token_accounts.token_program.address(),
            }
            .invoke()?,
        }
    } else {
        Transfer {
            from: ix.accounts.poster,
            to: ix.accounts.escrow,
            lamports: ix.data.reward,
        }
        .invoke()?;
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

    // Create MagicBlock Permission PDA for the task via CPI
    create_task_permission_cpi(
        program_id,
        ix.accounts.task,
        ix.accounts.permission,
        ix.accounts.poster,
        ix.accounts.system_program,
        ix.accounts.permission_program,
        task_id,
        task_bump,
    )?;

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

#[inline(always)]
fn verify_permission_pda(
    permission_account: &AccountView,
    task_address: &Address,
) -> Result<(), ProgramError> {
    let permission_program = Address::new_from_array(PERMISSION_PROGRAM_ID);
    let (expected, _) = Address::find_program_address(
        &[PERMISSION_SEED, task_address.as_ref()],
        &permission_program,
    );
    if permission_account.address() != &expected {
        return Err(ProgramError::InvalidSeeds);
    }
    Ok(())
}

#[inline(always)]
fn create_task_permission_cpi(
    _program_id: &Address,
    task_account: &AccountView,
    permission_account: &AccountView,
    payer: &AccountView,
    system_program: &AccountView,
    permission_program: &AccountView,
    task_id: u64,
    bump: u8,
) -> ProgramResult {
    verify_permission_pda(permission_account, task_account.address())?;

    let permission_program_addr = Address::new_from_array(PERMISSION_PROGRAM_ID);
    if permission_program.address() != &permission_program_addr {
        return Err(ProgramError::IncorrectProgramId);
    }

    // MembersArgs with members = null (1 byte discriminant = 0)
    let cpi_data = [CREATE_PERMISSION_DISCRIMINATOR, &[0u8]].concat();

    let cpi_accounts = [
        InstructionAccount::readonly_signer(task_account.address()),
        InstructionAccount::writable(permission_account.address()),
        InstructionAccount::writable_signer(payer.address()),
        InstructionAccount::readonly(system_program.address()),
    ];

    let instruction = InstructionView {
        program_id: &permission_program_addr,
        accounts: &cpi_accounts,
        data: &cpi_data,
    };

    let task_id_bytes = task_id.to_le_bytes();
    let bump_seed = [bump];
    let signer_seeds: [Seed; 3] = [
        Seed::from(TASK_SEED),
        Seed::from(task_id_bytes.as_ref()),
        Seed::from(&bump_seed),
    ];
    let signer = Signer::from(&signer_seeds);

    invoke_signed(
        &instruction,
        &[task_account, permission_account, payer, system_program],
        &[signer],
    )
}
