use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{account::AccountView, cpi::Seed, error::ProgramError, Address, ProgramResult};

use crate::{
    constants::MESSAGE_ENVELOPE_SEED,
    errors::A2AProtocolError,
    state::{
        MessageEnvelope, MessageThread, ThreadStatus, MESSAGE_ENVELOPE_DISCRIMINATOR,
        MESSAGE_ENVELOPE_LEN, MESSAGE_THREAD_DISCRIMINATOR,
    },
    utils::{
        create_pda_account, is_zero_pubkey, read_borsh_account, verify_owner, verify_signer,
        verify_system_program, verify_writable, write_borsh_account,
    },
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct PostMessageData {
    pub thread_id: u64,
    pub sequence: u32,
    pub to_agent: [u8; 32],
    pub message_type: u8,
    pub codec: u8,
    pub nonce: u64,
    pub created_at: i64,
    pub body_hash: [u8; 32],
    pub sig_r: [u8; 32],
    pub sig_s: [u8; 32],
    pub payment_microlamports: u64,
    pub flags: u16,
}

pub fn process_post_message(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = PostMessageData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let [sender, thread, envelope, system_program] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    verify_signer(sender)?;
    verify_writable(sender)?;
    verify_writable(thread)?;
    verify_writable(envelope)?;
    verify_system_program(system_program)?;
    verify_owner(thread, program_id)?;

    if data.sequence == 0 || data.nonce == 0 {
        return Err(A2AProtocolError::NonceReplay.into());
    }
    if is_zero_pubkey(&data.body_hash) {
        return Err(A2AProtocolError::HashEmpty.into());
    }
    if is_zero_pubkey(&data.sig_r) || is_zero_pubkey(&data.sig_s) {
        return Err(A2AProtocolError::InvalidSignature.into());
    }

    let mut thread_state: MessageThread = read_borsh_account(thread, MESSAGE_THREAD_DISCRIMINATOR)?;
    if thread_state.thread_id != data.thread_id {
        return Err(ProgramError::InvalidAccountData);
    }
    if thread_state.status != ThreadStatus::Active {
        return Err(A2AProtocolError::InvalidStateTransition.into());
    }
    let sender_bytes = sender.address().to_bytes();
    if thread_state.creator != sender_bytes
        && (thread_state.counterparty == [0u8; 32] || thread_state.counterparty != sender_bytes)
    {
        return Err(A2AProtocolError::Unauthorized.into());
    }
    let expected_sequence = thread_state
        .message_count
        .checked_add(1)
        .ok_or(A2AProtocolError::InvalidStateTransition)?;
    if data.sequence != expected_sequence {
        return Err(A2AProtocolError::InvalidStateTransition.into());
    }
    if envelope.data_len() > 0 || envelope.lamports() > 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let thread_id_bytes = data.thread_id.to_le_bytes();
    let sequence_bytes = data.sequence.to_le_bytes();
    let (envelope_pda, envelope_bump) = Address::find_program_address(
        &[MESSAGE_ENVELOPE_SEED, thread_id_bytes.as_ref(), sequence_bytes.as_ref()],
        program_id,
    );
    if envelope.address() != &envelope_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let envelope_bump_seed = [envelope_bump];
    create_pda_account(
        sender,
        MESSAGE_ENVELOPE_LEN,
        program_id,
        envelope,
        [
            Seed::from(MESSAGE_ENVELOPE_SEED),
            Seed::from(thread_id_bytes.as_ref()),
            Seed::from(sequence_bytes.as_ref()),
            Seed::from(envelope_bump_seed.as_slice()),
        ],
    )?;

    write_borsh_account(
        envelope,
        MESSAGE_ENVELOPE_DISCRIMINATOR,
        &MessageEnvelope {
            thread_id: data.thread_id,
            sequence: data.sequence,
            from_agent: sender_bytes,
            to_agent: data.to_agent,
            message_type: data.message_type,
            codec: data.codec,
            nonce: data.nonce,
            created_at: data.created_at,
            body_hash: data.body_hash,
            sig_r: data.sig_r,
            sig_s: data.sig_s,
            payment_microlamports: data.payment_microlamports,
            flags: data.flags,
            bump: envelope_bump,
        },
    )?;

    thread_state.message_count = data.sequence;
    thread_state.latest_message_slot = if data.created_at > 0 {
        data.created_at as u64
    } else {
        0
    };
    write_borsh_account(thread, MESSAGE_THREAD_DISCRIMINATOR, &thread_state)
}
