use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{account::AccountView, error::ProgramError, Address, ProgramResult};

use crate::{
    errors::A2AProtocolError,
    state::{SubtaskOrder, SubtaskStatus, SUBTASK_ORDER_DISCRIMINATOR},
    utils::{read_borsh_account, verify_owner, verify_signer, verify_writable, write_borsh_account},
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct CancelSubtaskOrderData {
    pub parent_task_id: u64,
    pub subtask_id: u32,
}

pub fn process_cancel_subtask_order(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = CancelSubtaskOrderData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let [requester, subtask] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    verify_signer(requester)?;
    verify_writable(subtask)?;
    verify_owner(subtask, program_id)?;

    let mut subtask_state: SubtaskOrder = read_borsh_account(subtask, SUBTASK_ORDER_DISCRIMINATOR)?;
    if subtask_state.parent_task_id != data.parent_task_id || subtask_state.subtask_id != data.subtask_id {
        return Err(ProgramError::InvalidAccountData);
    }
    if subtask_state.requester != requester.address().to_bytes() {
        return Err(A2AProtocolError::Unauthorized.into());
    }
    if subtask_state.status != SubtaskStatus::Bidding && subtask_state.status != SubtaskStatus::Assigned {
        return Err(A2AProtocolError::InvalidStateTransition.into());
    }

    subtask_state.status = SubtaskStatus::Cancelled;
    write_borsh_account(subtask, SUBTASK_ORDER_DISCRIMINATOR, &subtask_state)
}
