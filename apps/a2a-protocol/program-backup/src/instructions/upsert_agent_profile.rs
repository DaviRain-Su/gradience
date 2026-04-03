use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{account::AccountView, cpi::Seed, error::ProgramError, Address, ProgramResult};

use crate::{
    constants::AGENT_PROFILE_SEED,
    errors::A2AProtocolError,
    state::{
        AgentProfile, AGENT_PROFILE_DISCRIMINATOR, AGENT_PROFILE_LEN,
        NETWORK_CONFIG_DISCRIMINATOR, NetworkConfig,
    },
    utils::{
        address_to_bytes, create_pda_account, read_borsh_account, verify_owner, verify_signer,
        verify_writable, write_borsh_account,
    },
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct UpsertAgentProfileData {
    pub capability_mask: u64,
    pub transport_flags: u16,
    pub metadata_uri_hash: [u8; 32],
    pub status: u8,
    pub heartbeat_slot: u64,
}

pub fn process_upsert_agent_profile(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = UpsertAgentProfileData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let [authority, profile, config, system_program] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    verify_signer(authority)?;
    verify_writable(authority)?;
    verify_writable(profile)?;
    verify_owner(config, program_id)?;
    let _config: NetworkConfig = read_borsh_account(config, NETWORK_CONFIG_DISCRIMINATOR)?;
    if system_program.address() != &pinocchio_system::ID {
        return Err(ProgramError::IncorrectProgramId);
    }

    if data.capability_mask == 0 {
        return Err(A2AProtocolError::Unauthorized.into());
    }

    let authority_bytes = address_to_bytes(authority.address());
    let (profile_pda, profile_bump) =
        Address::find_program_address(&[AGENT_PROFILE_SEED, authority.address().as_ref()], program_id);
    if profile.address() != &profile_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let current = if profile.data_len() == 0 {
        if profile.lamports() > 0 {
            return Err(ProgramError::InvalidAccountData);
        }
        let profile_bump_seed = [profile_bump];
        create_pda_account(
            authority,
            AGENT_PROFILE_LEN,
            program_id,
            profile,
            [
                Seed::from(AGENT_PROFILE_SEED),
                Seed::from(authority.address().as_ref()),
                Seed::from(profile_bump_seed.as_slice()),
            ],
        )?;
        AgentProfile {
            agent: authority_bytes,
            authority: authority_bytes,
            capability_mask: 0,
            transport_flags: 0,
            last_heartbeat_slot: 0,
            metadata_uri_hash: [0u8; 32],
            status: 0,
            bump: profile_bump,
        }
    } else {
        verify_owner(profile, program_id)?;
        let existing: AgentProfile = read_borsh_account(profile, AGENT_PROFILE_DISCRIMINATOR)?;
        if existing.authority != authority_bytes {
            return Err(A2AProtocolError::Unauthorized.into());
        }
        existing
    };

    if data.heartbeat_slot < current.last_heartbeat_slot {
        return Err(A2AProtocolError::InvalidStateTransition.into());
    }

    write_borsh_account(
        profile,
        AGENT_PROFILE_DISCRIMINATOR,
        &AgentProfile {
            agent: current.agent,
            authority: current.authority,
            capability_mask: data.capability_mask,
            transport_flags: data.transport_flags,
            last_heartbeat_slot: data.heartbeat_slot,
            metadata_uri_hash: data.metadata_uri_hash,
            status: data.status,
            bump: current.bump,
        },
    )
}
