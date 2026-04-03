use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView, error::ProgramError, sysvars::clock::Clock, sysvars::Sysvar, Address,
    ProgramResult,
};

use crate::{
    errors::A2AProtocolError,
    state::{
        BidStatus, SubtaskBid, SubtaskOrder, SubtaskStatus, SUBTASK_BID_DISCRIMINATOR,
        SUBTASK_ORDER_DISCRIMINATOR,
    },
    utils::{read_borsh_account, verify_owner, verify_signer, verify_writable, write_borsh_account},
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct AssignSubtaskBidData {
    pub parent_task_id: u64,
    pub subtask_id: u32,
    pub winner: [u8; 32],
}

pub fn process_assign_subtask_bid(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = AssignSubtaskBidData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let [requester, subtask, winning_bid] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    verify_signer(requester)?;
    verify_writable(subtask)?;
    verify_writable(winning_bid)?;
    verify_owner(subtask, program_id)?;
    verify_owner(winning_bid, program_id)?;

    let mut subtask_state: SubtaskOrder = read_borsh_account(subtask, SUBTASK_ORDER_DISCRIMINATOR)?;
    if subtask_state.parent_task_id != data.parent_task_id || subtask_state.subtask_id != data.subtask_id {
        return Err(ProgramError::InvalidAccountData);
    }
    if subtask_state.requester != requester.address().to_bytes() {
        return Err(A2AProtocolError::Unauthorized.into());
    }
    if subtask_state.status != SubtaskStatus::Bidding {
        return Err(A2AProtocolError::InvalidStateTransition.into());
    }
    let clock = Clock::get()?;
    if clock.unix_timestamp > subtask_state.execute_deadline {
        return Err(A2AProtocolError::DeadlineInvalid.into());
    }
    if subtask_state.selected_agent != [0u8; 32] {
        return Err(A2AProtocolError::SubtaskAlreadyAssigned.into());
    }

    let mut bid_state: SubtaskBid = read_borsh_account(winning_bid, SUBTASK_BID_DISCRIMINATOR)?;
    if bid_state.parent_task_id != data.parent_task_id || bid_state.subtask_id != data.subtask_id {
        return Err(ProgramError::InvalidAccountData);
    }
    if bid_state.bidder != data.winner {
        return Err(ProgramError::InvalidInstructionData);
    }
    if bid_state.status != BidStatus::Open {
        return Err(A2AProtocolError::InvalidStateTransition.into());
    }

    subtask_state.selected_agent = data.winner;
    subtask_state.status = SubtaskStatus::Assigned;
    bid_state.status = BidStatus::Won;
    write_borsh_account(subtask, SUBTASK_ORDER_DISCRIMINATOR, &subtask_state)?;
    write_borsh_account(winning_bid, SUBTASK_BID_DISCRIMINATOR, &bid_state)
}
