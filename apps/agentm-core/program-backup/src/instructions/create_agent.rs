//! Create agent instruction

use borsh::BorshDeserialize;
use pinocchio::{account::AccountView, error::ProgramError, Address};

use crate::{
    constants::*,
    errors::AgentMError,
    state::{Agent, AgentType},
};

#[derive(BorshDeserialize)]
struct CreateAgentData {
    name: String,
    description: String,
    agent_type: u8,
    config: Vec<u8>,
    created_at: i64,
}

pub fn create_agent(
    _program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> Result<(), ProgramError> {
    let accounts_iter = &mut accounts.iter();
    let owner = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;
    let agent_account = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;

    if !owner.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let parsed = parse_agent_data(data)?;
    if parsed.name.len() > MAX_AGENT_NAME_LEN {
        return Err(AgentMError::AgentNameTooLong.into());
    }
    if parsed.description.len() > MAX_AGENT_DESCRIPTION_LEN
        || parsed.config.len() > MAX_AGENT_CONFIG_LEN
    {
        return Err(AgentMError::InvalidAgentData.into());
    }
    let agent_type = parse_agent_type(parsed.agent_type)?;

    let agent = Agent {
        discriminator: Agent::DISCRIMINATOR,
        version: 1,
        owner: crate::addr_to_bytes(owner.address()),
        pubkey: crate::addr_to_bytes(agent_account.address()),
        name: parsed.name,
        description: parsed.description,
        agent_type,
        config: parsed.config,
        is_active: true,
        created_at: parsed.created_at,
        updated_at: parsed.created_at,
    };

    let mut agent_data = agent_account.try_borrow_mut()?;
    let serialized = borsh::to_vec(&agent).map_err(|_| ProgramError::InvalidAccountData)?;
    if agent_data.len() < serialized.len() {
        return Err(ProgramError::AccountDataTooSmall);
    }
    agent_data[..serialized.len()].copy_from_slice(&serialized);

    Ok(())
}

fn parse_agent_data(data: &[u8]) -> Result<CreateAgentData, ProgramError> {
    if let Ok(parsed) = CreateAgentData::try_from_slice(data) {
        return Ok(parsed);
    }

    let name = String::from_utf8(data.to_vec()).map_err(|_| AgentMError::InvalidAgentData)?;
    Ok(CreateAgentData {
        name,
        description: String::new(),
        agent_type: AgentType::Custom as u8,
        config: Vec::new(),
        created_at: 0,
    })
}

fn parse_agent_type(value: u8) -> Result<AgentType, ProgramError> {
    match value {
        0 => Ok(AgentType::TaskExecutor),
        1 => Ok(AgentType::SocialAgent),
        2 => Ok(AgentType::TradingAgent),
        3 => Ok(AgentType::Custom),
        _ => Err(AgentMError::InvalidAgentData.into()),
    }
}
