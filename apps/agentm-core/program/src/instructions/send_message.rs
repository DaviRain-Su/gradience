//! Send message instruction
use pinocchio::{account_info::AccountInfo, program_error::ProgramError, pubkey::Pubkey};
use crate::{constants::*, errors::AgentMError, state::Message};

pub fn send_message(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> Result<(), ProgramError> {
    let accounts_iter = &mut accounts.iter();
    let sender = accounts_iter.next().ok_or(ProgramError::NotEnoughAccountKeys)?;
    let _recipient = accounts_iter.next().ok_or(ProgramError::NotEnoughAccountKeys)?;
    let message_account = accounts_iter.next().ok_or(ProgramError::NotEnoughAccountKeys)?;
    
    if !sender.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    let content = String::from_utf8(data.to_vec()).unwrap_or_default();
    if content.len() > MAX_MESSAGE_LEN {
        return Err(AgentMError::MessageTooLong.into());
    }
    
    let message = Message {
        discriminator: Message::DISCRIMINATOR,
        version: 1,
        sender: sender.key().to_bytes(),
        recipient: [0u8; 32], // Would be parsed from data
        content,
        timestamp: 0,
        nonce: 0,
    };
    
    let mut msg_data = message_account.try_borrow_mut_data()?;
    let serialized = borsh::to_vec(&message).map_err(|_| ProgramError::InvalidAccountData)?;
    msg_data[..serialized.len()].copy_from_slice(&serialized);
    
    Ok(())
}
