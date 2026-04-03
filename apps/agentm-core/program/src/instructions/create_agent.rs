//! Create agent instruction
use pinocchio::{account_info::AccountInfo, program_error::ProgramError, pubkey::Pubkey};
use crate::{constants::*, errors::AgentMError, state::{Agent, AgentType}};

pub fn create_agent(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> Result<(), ProgramError> {
    let accounts_iter = &mut accounts.iter();
    let owner = accounts_iter.next().ok_or(ProgramError::NotEnoughAccountKeys)?;
    let agent_account = accounts_iter.next().ok_or(ProgramError::NotEnoughAccountKeys)?;
    
    if !owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    let name = String::from_utf8(data.to_vec()).unwrap_or_default();
    if name.len() > MAX_AGENT_NAME_LEN {
        return Err(AgentMError::AgentNameTooLong.into());
    }
    
    let agent = Agent {
        discriminator: Agent::DISCRIMINATOR,
        version: 1,
        owner: owner.key().to_bytes(),
        pubkey: agent_account.key().to_bytes(),
        name,
        description: String::new(),
        agent_type: AgentType::Custom,
        config: Vec::new(),
        is_active: true,
        created_at: 0,
        updated_at: 0,
    };
    
    let mut agent_data = agent_account.try_borrow_mut_data()?;
    let serialized = borsh::to_vec(&agent).map_err(|_| ProgramError::InvalidAccountData)?;
    agent_data[..serialized.len()].copy_from_slice(&serialized);
    
    Ok(())
}
