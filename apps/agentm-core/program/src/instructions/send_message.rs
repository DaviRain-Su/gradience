//! Send message instruction

use pinocchio::{account::AccountView, error::ProgramError, Address};

use crate::{constants::*, errors::AgentMError, state::Message};

pub fn send_message(
    _program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> Result<(), ProgramError> {
    let accounts_iter = &mut accounts.iter();
    let sender = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;
    let recipient = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;
    let message_account = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;

    if !sender.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let content = String::from_utf8(data.to_vec()).unwrap_or_default();
    if content.len() > MAX_MESSAGE_LEN {
        return Err(AgentMError::MessageTooLong.into());
    }

    let message = Message {
        discriminator: Message::DISCRIMINATOR,
        version: 1,
        sender: crate::addr_to_bytes(sender.address()),
        recipient: crate::addr_to_bytes(recipient.address()),
        content,
        timestamp: 0,
        nonce: 0,
    };

    let mut msg_data = message_account.try_borrow_mut()?;
    let serialized = borsh::to_vec(&message).map_err(|_| ProgramError::InvalidAccountData)?;
    if msg_data.len() < serialized.len() {
        return Err(ProgramError::AccountDataTooSmall);
    }
    msg_data[..serialized.len()].copy_from_slice(&serialized);

    Ok(())
}
