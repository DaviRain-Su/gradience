use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{account::AccountView, cpi::Seed, error::ProgramError, Address, ProgramResult};

use crate::{
    constants::THREAD_SEED,
    errors::A2AProtocolError,
    state::{
        MessageThread, ThreadStatus, MESSAGE_THREAD_DISCRIMINATOR, MESSAGE_THREAD_LEN,
    },
    utils::{create_pda_account, is_zero_pubkey, verify_signer, verify_system_program, verify_writable, write_borsh_account},
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct CreateThreadData {
    pub thread_id: u64,
    pub counterparty: [u8; 32],
    pub policy_hash: [u8; 32],
}

pub fn process_create_thread(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = CreateThreadData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    if data.thread_id == 0 {
        return Err(A2AProtocolError::InvalidStateTransition.into());
    }
    if is_zero_pubkey(&data.policy_hash) {
        return Err(A2AProtocolError::HashEmpty.into());
    }

    let [creator, thread, system_program] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    verify_signer(creator)?;
    verify_writable(creator)?;
    verify_writable(thread)?;
    verify_system_program(system_program)?;

    if thread.data_len() > 0 || thread.lamports() > 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let thread_id_bytes = data.thread_id.to_le_bytes();
    let (thread_pda, thread_bump) = Address::find_program_address(
        &[
            THREAD_SEED,
            creator.address().as_ref(),
            data.counterparty.as_ref(),
            thread_id_bytes.as_ref(),
        ],
        program_id,
    );
    if thread.address() != &thread_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let thread_bump_seed = [thread_bump];
    create_pda_account(
        creator,
        MESSAGE_THREAD_LEN,
        program_id,
        thread,
        [
            Seed::from(THREAD_SEED),
            Seed::from(creator.address().as_ref()),
            Seed::from(data.counterparty.as_ref()),
            Seed::from(thread_id_bytes.as_ref()),
            Seed::from(thread_bump_seed.as_slice()),
        ],
    )?;

    write_borsh_account(
        thread,
        MESSAGE_THREAD_DISCRIMINATOR,
        &MessageThread {
            thread_id: data.thread_id,
            creator: creator.address().to_bytes(),
            counterparty: data.counterparty,
            policy_hash: data.policy_hash,
            message_count: 0,
            latest_message_slot: 0,
            status: ThreadStatus::Active,
            bump: thread_bump,
        },
    )
}
