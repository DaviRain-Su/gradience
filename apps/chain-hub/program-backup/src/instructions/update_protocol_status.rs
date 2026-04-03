use alloc::string::String;
use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{account::AccountView, error::ProgramError, Address, ProgramResult};

use crate::{
    constants::{CONFIG_SEED, MAX_PROTOCOL_ID_LEN, PROTOCOL_ENTRY_SEED, PROTOCOL_REGISTRY_SEED},
    errors::ChainHubError,
    state::{
        ProgramConfig, ProtocolEntry, ProtocolRegistry, ProtocolStatus, PROGRAM_CONFIG_DISCRIMINATOR,
        PROTOCOL_ENTRY_DISCRIMINATOR, PROTOCOL_REGISTRY_DISCRIMINATOR,
    },
    utils::{read_borsh_account, verify_signer, verify_writable, write_borsh_account},
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct UpdateProtocolStatusData {
    pub protocol_id: String,
    pub status: u8,
}

pub fn process_update_protocol_status(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = UpdateProtocolStatusData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    let [authority, config_account, protocol_registry_account, protocol_entry_account] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    verify_signer(authority)?;
    verify_writable(config_account)?;
    verify_writable(protocol_registry_account)?;
    verify_writable(protocol_entry_account)?;

    if data.protocol_id.is_empty() || data.protocol_id.len() > MAX_PROTOCOL_ID_LEN {
        return Err(ChainHubError::InvalidProtocolId.into());
    }
    let new_status = parse_status(data.status)?;

    let (config_pda, _) = Address::find_program_address(&[CONFIG_SEED], program_id);
    if config_account.address() != &config_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let (protocol_registry_pda, _) =
        Address::find_program_address(&[PROTOCOL_REGISTRY_SEED], program_id);
    if protocol_registry_account.address() != &protocol_registry_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let (protocol_pda, _) =
        Address::find_program_address(&[PROTOCOL_ENTRY_SEED, data.protocol_id.as_bytes()], program_id);
    if protocol_entry_account.address() != &protocol_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let config: ProgramConfig = read_borsh_account(config_account, PROGRAM_CONFIG_DISCRIMINATOR)?;
    if authority.address().to_bytes() != config.upgrade_authority {
        return Err(ChainHubError::NotUpgradeAuthority.into());
    }
    let mut registry: ProtocolRegistry =
        read_borsh_account(protocol_registry_account, PROTOCOL_REGISTRY_DISCRIMINATOR)?;
    let mut protocol: ProtocolEntry =
        read_borsh_account(protocol_entry_account, PROTOCOL_ENTRY_DISCRIMINATOR)?;

    if protocol.protocol_id != data.protocol_id {
        return Err(ChainHubError::ProtocolMismatch.into());
    }

    if protocol.status != new_status {
        match (protocol.status, new_status) {
            (ProtocolStatus::Active, ProtocolStatus::Paused) => {
                registry.total_active = registry
                    .total_active
                    .checked_sub(1)
                    .ok_or(ProgramError::ArithmeticOverflow)?;
            }
            (ProtocolStatus::Paused, ProtocolStatus::Active) => {
                registry.total_active = registry
                    .total_active
                    .checked_add(1)
                    .ok_or(ProgramError::ArithmeticOverflow)?;
            }
            _ => {}
        }
        protocol.status = new_status;
    }

    write_borsh_account(protocol_registry_account, PROTOCOL_REGISTRY_DISCRIMINATOR, &registry)?;
    write_borsh_account(protocol_entry_account, PROTOCOL_ENTRY_DISCRIMINATOR, &protocol)?;
    Ok(())
}

fn parse_status(value: u8) -> Result<ProtocolStatus, ProgramError> {
    match value {
        0 => Ok(ProtocolStatus::Active),
        1 => Ok(ProtocolStatus::Paused),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}
