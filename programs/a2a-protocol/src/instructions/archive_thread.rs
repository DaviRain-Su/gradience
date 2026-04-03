use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{account::AccountView, error::ProgramError, Address, ProgramResult};

use crate::{
    errors::A2AProtocolError,
    state::{
        MessageThread, ThreadStatus, MESSAGE_THREAD_DISCRIMINATOR,
    },
    utils::{read_borsh_account, verify_owner, verify_signer, verify_writable, write_borsh_account},
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct ArchiveThreadData {
    pub thread_id: u64,
}

pub fn process_archive_thread(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = ArchiveThreadData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let [actor, thread] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    verify_signer(actor)?;
    verify_writable(thread)?;
    verify_owner(thread, program_id)?;

    let mut thread_state: MessageThread = read_borsh_account(thread, MESSAGE_THREAD_DISCRIMINATOR)?;
    if thread_state.thread_id != data.thread_id {
        return Err(ProgramError::InvalidAccountData);
    }
    let actor_bytes = actor.address().to_bytes();
    if thread_state.creator != actor_bytes
        && thread_state.counterparty != actor_bytes
        && !thread_state.counterparty.iter().all(|v| *v == 0)
    {
        return Err(A2AProtocolError::Unauthorized.into());
    }
    if thread_state.status == ThreadStatus::Archived {
        return Err(A2AProtocolError::InvalidStateTransition.into());
    }

    thread_state.status = ThreadStatus::Archived;
    write_borsh_account(thread, MESSAGE_THREAD_DISCRIMINATOR, &thread_state)
}
