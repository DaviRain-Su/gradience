use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView, error::ProgramError, sysvars::clock::Clock, sysvars::Sysvar, Address,
    ProgramResult,
};

use crate::{
    errors::A2AProtocolError,
    state::{SubtaskOrder, SubtaskStatus, SUBTASK_ORDER_DISCRIMINATOR},
    utils::{
        is_zero_pubkey, read_borsh_account, verify_owner, verify_signer, verify_writable,
        write_borsh_account,
    },
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct SubmitSubtaskDeliveryData {
    pub parent_task_id: u64,
    pub subtask_id: u32,
    pub delivery_hash: [u8; 32],
}

pub fn process_submit_subtask_delivery(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = SubmitSubtaskDeliveryData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    if is_zero_pubkey(&data.delivery_hash) {
        return Err(A2AProtocolError::HashEmpty.into());
    }

    let [selected_agent, subtask] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    verify_signer(selected_agent)?;
    verify_writable(subtask)?;
    verify_owner(subtask, program_id)?;

    let mut subtask_state: SubtaskOrder = read_borsh_account(subtask, SUBTASK_ORDER_DISCRIMINATOR)?;
    if subtask_state.parent_task_id != data.parent_task_id || subtask_state.subtask_id != data.subtask_id {
        return Err(ProgramError::InvalidAccountData);
    }
    if subtask_state.status != SubtaskStatus::Assigned {
        return Err(A2AProtocolError::InvalidStateTransition.into());
    }
    let clock = Clock::get()?;
    if clock.unix_timestamp > subtask_state.execute_deadline {
        return Err(A2AProtocolError::DeadlineInvalid.into());
    }
    if subtask_state.selected_agent != selected_agent.address().to_bytes() {
        return Err(A2AProtocolError::SubtaskNotAssigned.into());
    }

    subtask_state.delivery_hash = data.delivery_hash;
    subtask_state.status = SubtaskStatus::Delivered;
    write_borsh_account(subtask, SUBTASK_ORDER_DISCRIMINATOR, &subtask_state)
}
