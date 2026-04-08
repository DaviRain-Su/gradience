use alloc::vec::Vec;
use pinocchio::{
    account::AccountView,
    cpi::{invoke_signed, Seed, Signer},
    error::ProgramError,
    instruction::{InstructionAccount, InstructionView},
    Address, ProgramResult,
};

use crate::{
    instructions::CreateTaskPermission,
    state::{ACCOUNT_VERSION_V1, TASK_DISCRIMINATOR},
    utils::verify_current_program_account,
};

const TASK_SEED: &[u8] = b"task";
const PERMISSION_SEED: &[u8] = b"permission:";
const CREATE_PERMISSION_DISCRIMINATOR: &[u8] = &[0, 0, 0, 0, 0, 0, 0, 0];
const PERMISSION_PROGRAM_ID: [u8; 32] = [
    0x88, 0xa1, 0x0a, 0xc4, 0x21, 0x98, 0x01, 0xd6, 0xf6, 0x6a, 0x1d, 0x3c, 0x06, 0x98, 0xc0,
    0x66, 0xa9, 0xaf, 0xd4, 0xd9, 0xb4, 0xfc, 0xe7, 0x47, 0x97, 0x8d, 0xd1, 0x05, 0xa8, 0xd4,
    0x67, 0x52,
];
const TASK_ID_OFFSET: usize = 2;
const TASK_BUMP_OFFSET: usize = 2 + 315 - 1; // ACCOUNT_HEADER_LEN + TASK_DATA_LEN - bump_size

#[inline(always)]
fn read_task_id_and_bump(task_account: &AccountView) -> Result<(u64, u8), ProgramError> {
    let data = task_account.try_borrow()?;
    if data.len() < TASK_BUMP_OFFSET + 1 {
        return Err(ProgramError::InvalidAccountData);
    }
    if data[0] != TASK_DISCRIMINATOR || data[1] != ACCOUNT_VERSION_V1 {
        return Err(ProgramError::InvalidAccountData);
    }
    let task_id = u64::from_le_bytes(
        data[TASK_ID_OFFSET..TASK_ID_OFFSET + 8]
            .try_into()
            .map_err(|_| ProgramError::InvalidAccountData)?,
    );
    let bump = data[TASK_BUMP_OFFSET];
    Ok((task_id, bump))
}

#[inline(always)]
fn verify_task_pda(
    task_account: &AccountView,
    program_id: &Address,
    task_id: u64,
    bump: u8,
) -> Result<(), ProgramError> {
    let task_id_bytes = task_id.to_le_bytes();
    let (expected, _) = Address::find_program_address(
        &[TASK_SEED, task_id_bytes.as_ref()],
        program_id,
    );
    if task_account.address() != &expected {
        return Err(ProgramError::InvalidSeeds);
    }

    // Validate bump matches derived one
    let (_, derived_bump) = Address::find_program_address(
        &[TASK_SEED, task_id_bytes.as_ref()],
        program_id,
    );
    if bump != derived_bump {
        return Err(ProgramError::InvalidSeeds);
    }
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
fn serialize_members_args(members: &Option<Vec<crate::instructions::create_task_permission::Member>>) -> Vec<u8> {
    let mut buf = Vec::new();
    match members {
        None => buf.push(0),
        Some(list) => {
            buf.push(1);
            buf.extend_from_slice(&(list.len() as u32).to_le_bytes());
            for m in list {
                buf.push(m.flags);
                buf.extend_from_slice(&m.pubkey);
            }
        }
    }
    buf
}

pub fn process_create_task_permission(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let ix = CreateTaskPermission::try_from((instruction_data, accounts))?;

    verify_current_program_account(ix.accounts.task)?;

    let (task_id, bump) = read_task_id_and_bump(ix.accounts.task)?;
    verify_task_pda(ix.accounts.task, program_id, task_id, bump)?;
    verify_permission_pda(ix.accounts.permission, ix.accounts.task.address())?;

    // Verify permission_program address matches MagicBlock Permission Program
    let permission_program_addr = Address::new_from_array(PERMISSION_PROGRAM_ID);
    if ix.accounts.permission_program.address() != &permission_program_addr {
        return Err(ProgramError::IncorrectProgramId);
    }

    // Build CPI instruction data: discriminator + MembersArgs
    let members_buf = serialize_members_args(&ix.data.members);
    let mut cpi_data = Vec::with_capacity(CREATE_PERMISSION_DISCRIMINATOR.len() + members_buf.len());
    cpi_data.extend_from_slice(CREATE_PERMISSION_DISCRIMINATOR);
    cpi_data.extend_from_slice(&members_buf);

    // CPI accounts for create_permission (matching SDK layout):
    // 0. permissionedAccount [signer, readonly]
    // 1. permission [writable]
    // 2. payer [signer, writable]
    // 3. system_program [readonly]
    let cpi_accounts = [
        InstructionAccount::readonly_signer(ix.accounts.task.address()),
        InstructionAccount::writable(ix.accounts.permission.address()),
        InstructionAccount::writable_signer(ix.accounts.payer.address()),
        InstructionAccount::readonly(ix.accounts.system_program.address()),
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
        &[
            ix.accounts.task,
            ix.accounts.permission,
            ix.accounts.payer,
            ix.accounts.system_program,
        ],
        &[signer],
    )
}
