use alloc::string::String;
use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{account::AccountView, cpi::Seed, error::ProgramError, Address, ProgramResult};

use crate::{
    constants::{
        CONFIG_SEED, MAX_PROTOCOL_DOCS_URI_LEN, MAX_PROTOCOL_ENDPOINT_LEN, MAX_PROTOCOL_ID_LEN,
        MAX_PROTOCOL_IDL_REF_LEN, PROTOCOL_ENTRY_SEED, PROTOCOL_REGISTRY_SEED,
    },
    errors::ChainHubError,
    state::{
        AuthMode, ProgramConfig, ProtocolEntry, ProtocolRegistry, ProtocolStatus, ProtocolTrustModel,
        ProtocolType, PROGRAM_CONFIG_DISCRIMINATOR, PROTOCOL_ENTRY_DISCRIMINATOR,
        PROTOCOL_ENTRY_LEN, PROTOCOL_REGISTRY_DISCRIMINATOR,
    },
    utils::{
        address_to_bytes, create_pda_account, is_zero_pubkey, read_borsh_account, verify_signer,
        verify_system_program, verify_writable, write_borsh_account,
    },
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct RegisterProtocolData {
    pub protocol_id: String,
    pub protocol_type: u8,
    pub trust_model: u8,
    pub auth_mode: u8,
    pub capabilities_mask: u64,
    pub endpoint: String,
    pub docs_uri: String,
    pub program_id: [u8; 32],
    pub idl_ref: String,
}

pub fn process_register_protocol(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = RegisterProtocolData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    let [authority, config_account, protocol_registry_account, protocol_entry_account, system_program] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    verify_signer(authority)?;
    verify_writable(config_account)?;
    verify_writable(protocol_registry_account)?;
    verify_writable(protocol_entry_account)?;
    verify_system_program(system_program)?;

    validate_protocol_id(&data.protocol_id)?;
    if data.capabilities_mask == 0 {
        return Err(ChainHubError::InvalidCapabilityMask.into());
    }
    if data.docs_uri.is_empty() || data.docs_uri.len() > MAX_PROTOCOL_DOCS_URI_LEN {
        return Err(ChainHubError::InvalidProtocolDocsUri.into());
    }

    let protocol_type = parse_protocol_type(data.protocol_type)?;
    let trust_model = parse_trust_model(data.trust_model)?;
    let auth_mode = parse_auth_mode(data.auth_mode)?;

    match protocol_type {
        ProtocolType::RestApi => {
            if data.endpoint.is_empty() || data.endpoint.len() > MAX_PROTOCOL_ENDPOINT_LEN {
                return Err(ChainHubError::InvalidProtocolEndpoint.into());
            }
            if !is_zero_pubkey(&data.program_id) {
                return Err(ChainHubError::InvalidProtocolProgramId.into());
            }
            if data.idl_ref.len() > MAX_PROTOCOL_IDL_REF_LEN {
                return Err(ChainHubError::InvalidProtocolIdlRef.into());
            }
        }
        ProtocolType::SolanaProgram => {
            if is_zero_pubkey(&data.program_id) {
                return Err(ChainHubError::InvalidProtocolProgramId.into());
            }
            if data.idl_ref.is_empty() || data.idl_ref.len() > MAX_PROTOCOL_IDL_REF_LEN {
                return Err(ChainHubError::InvalidProtocolIdlRef.into());
            }
            if data.endpoint.len() > MAX_PROTOCOL_ENDPOINT_LEN {
                return Err(ChainHubError::InvalidProtocolEndpoint.into());
            }
        }
    }

    let (config_pda, _) = Address::find_program_address(&[CONFIG_SEED], program_id);
    if config_account.address() != &config_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let (protocol_registry_pda, _) =
        Address::find_program_address(&[PROTOCOL_REGISTRY_SEED], program_id);
    if protocol_registry_account.address() != &protocol_registry_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let protocol_id_seed = data.protocol_id.as_bytes();
    let (protocol_pda, protocol_bump) =
        Address::find_program_address(&[PROTOCOL_ENTRY_SEED, protocol_id_seed], program_id);
    if protocol_entry_account.address() != &protocol_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let mut config: ProgramConfig = read_borsh_account(config_account, PROGRAM_CONFIG_DISCRIMINATOR)?;
    let mut registry: ProtocolRegistry =
        read_borsh_account(protocol_registry_account, PROTOCOL_REGISTRY_DISCRIMINATOR)?;

    let protocol_bump_seed = [protocol_bump];
    create_pda_account(
        authority,
        PROTOCOL_ENTRY_LEN,
        program_id,
        protocol_entry_account,
        [
            Seed::from(PROTOCOL_ENTRY_SEED),
            Seed::from(protocol_id_seed),
            Seed::from(protocol_bump_seed.as_slice()),
        ],
    )?;

    let protocol = ProtocolEntry {
        protocol_id: data.protocol_id,
        authority: address_to_bytes(authority.address()),
        protocol_type,
        trust_model,
        auth_mode,
        status: ProtocolStatus::Active,
        capabilities_mask: data.capabilities_mask,
        endpoint: data.endpoint,
        docs_uri: data.docs_uri,
        program_id: data.program_id,
        idl_ref: data.idl_ref,
        bump: protocol_bump,
    };

    config.protocol_count = config
        .protocol_count
        .checked_add(1)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    registry.total_registered = registry
        .total_registered
        .checked_add(1)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    registry.total_active = registry
        .total_active
        .checked_add(1)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    write_borsh_account(protocol_entry_account, PROTOCOL_ENTRY_DISCRIMINATOR, &protocol)?;
    write_borsh_account(config_account, PROGRAM_CONFIG_DISCRIMINATOR, &config)?;
    write_borsh_account(
        protocol_registry_account,
        PROTOCOL_REGISTRY_DISCRIMINATOR,
        &registry,
    )?;
    Ok(())
}

fn validate_protocol_id(protocol_id: &str) -> Result<(), ProgramError> {
    if protocol_id.is_empty() || protocol_id.len() > MAX_PROTOCOL_ID_LEN {
        return Err(ChainHubError::InvalidProtocolId.into());
    }
    Ok(())
}

fn parse_protocol_type(value: u8) -> Result<ProtocolType, ProgramError> {
    match value {
        0 => Ok(ProtocolType::RestApi),
        1 => Ok(ProtocolType::SolanaProgram),
        _ => Err(ChainHubError::InvalidProtocolType.into()),
    }
}

fn parse_trust_model(value: u8) -> Result<ProtocolTrustModel, ProgramError> {
    match value {
        0 => Ok(ProtocolTrustModel::CentralizedEnterprise),
        1 => Ok(ProtocolTrustModel::CentralizedCommunity),
        2 => Ok(ProtocolTrustModel::OnChainVerified),
        _ => Err(ChainHubError::InvalidTrustModel.into()),
    }
}

fn parse_auth_mode(value: u8) -> Result<AuthMode, ProgramError> {
    match value {
        0 => Ok(AuthMode::None),
        1 => Ok(AuthMode::KeyVault),
        _ => Err(ChainHubError::InvalidAuthMode.into()),
    }
}
