use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView, cpi::Seed, error::ProgramError, sysvars::clock::Clock,
    sysvars::Sysvar, Address, ProgramResult,
};

use crate::{
    constants::SUBTASK_SEED,
    errors::A2AProtocolError,
    state::{
        SubtaskOrder, SubtaskStatus, SUBTASK_ORDER_DISCRIMINATOR, SUBTASK_ORDER_LEN,
    },
    utils::{
        create_pda_account, is_zero_pubkey, verify_signer, verify_system_program, verify_writable,
        write_borsh_account,
    },
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct CreateSubtaskOrderData {
    pub parent_task_id: u64,
    pub subtask_id: u32,
    pub budget: u64,
    pub bid_deadline: i64,
    pub execute_deadline: i64,
    pub requirement_hash: [u8; 32],
    pub escrow_channel_id: u64,
}

pub fn process_create_subtask_order(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = CreateSubtaskOrderData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    if data.parent_task_id == 0 || data.subtask_id == 0 || data.budget == 0 {
        return Err(A2AProtocolError::DeadlineInvalid.into());
    }
    if data.bid_deadline <= 0 || data.execute_deadline <= data.bid_deadline {
        return Err(A2AProtocolError::DeadlineInvalid.into());
    }
    let clock = Clock::get()?;
    if data.bid_deadline <= clock.unix_timestamp {
        return Err(A2AProtocolError::BidWindowClosed.into());
    }

    if is_zero_pubkey(&data.requirement_hash) {
        return Err(A2AProtocolError::HashEmpty.into());
    }

    let [requester, subtask, system_program] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    verify_signer(requester)?;
    verify_writable(requester)?;
    verify_writable(subtask)?;
    verify_system_program(system_program)?;

    if subtask.data_len() > 0 || subtask.lamports() > 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let parent_task_id_bytes = data.parent_task_id.to_le_bytes();
    let subtask_id_bytes = data.subtask_id.to_le_bytes();
    let (subtask_pda, subtask_bump) = Address::find_program_address(
        &[SUBTASK_SEED, parent_task_id_bytes.as_ref(), subtask_id_bytes.as_ref()],
        program_id,
    );
    if subtask.address() != &subtask_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let subtask_bump_seed = [subtask_bump];
    create_pda_account(
        requester,
        SUBTASK_ORDER_LEN,
        program_id,
        subtask,
        [
            Seed::from(SUBTASK_SEED),
            Seed::from(parent_task_id_bytes.as_ref()),
            Seed::from(subtask_id_bytes.as_ref()),
            Seed::from(subtask_bump_seed.as_slice()),
        ],
    )?;

    write_borsh_account(
        subtask,
        SUBTASK_ORDER_DISCRIMINATOR,
        &SubtaskOrder {
            parent_task_id: data.parent_task_id,
            subtask_id: data.subtask_id,
            requester: requester.address().to_bytes(),
            selected_agent: [0u8; 32],
            budget: data.budget,
            bid_deadline: data.bid_deadline,
            execute_deadline: data.execute_deadline,
            requirement_hash: data.requirement_hash,
            delivery_hash: [0u8; 32],
            escrow_channel_id: data.escrow_channel_id,
            status: SubtaskStatus::Bidding,
            bump: subtask_bump,
        },
    )
}
