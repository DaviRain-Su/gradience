//! Update agent config instruction

use borsh::BorshDeserialize;
use pinocchio::{account::AccountView, error::ProgramError, Address};

use crate::{constants::*, errors::AgentMError, state::Agent};

#[derive(BorshDeserialize)]
struct UpdateAgentConfigData {
    description: String,
    config: Vec<u8>,
    is_active: bool,
    updated_at: i64,
}

pub fn update_agent_config(
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

    let parsed =
        UpdateAgentConfigData::try_from_slice(data).map_err(|_| AgentMError::InvalidAgentData)?;
    if parsed.description.len() > MAX_AGENT_DESCRIPTION_LEN
        || parsed.config.len() > MAX_AGENT_CONFIG_LEN
    {
        return Err(AgentMError::InvalidAgentData.into());
    }

    let owner_bytes = crate::addr_to_bytes(owner.address());
    let mut agent_data = agent_account.try_borrow_mut()?;
    let mut agent_slice: &[u8] = &agent_data;
    let mut agent =
        Agent::deserialize(&mut agent_slice).map_err(|_| ProgramError::InvalidAccountData)?;
    if agent.discriminator != Agent::DISCRIMINATOR || agent.owner != owner_bytes {
        return Err(AgentMError::Unauthorized.into());
    }

    agent.description = parsed.description;
    agent.config = parsed.config;
    agent.is_active = parsed.is_active;
    agent.updated_at = parsed.updated_at;

    let serialized = borsh::to_vec(&agent).map_err(|_| ProgramError::InvalidAccountData)?;
    if agent_data.len() < serialized.len() {
        return Err(ProgramError::AccountDataTooSmall);
    }
    agent_data[..serialized.len()].copy_from_slice(&serialized);

    Ok(())
}
