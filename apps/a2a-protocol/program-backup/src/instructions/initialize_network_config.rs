use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{account::AccountView, cpi::Seed, error::ProgramError, Address, ProgramResult};

use crate::{
    constants::{MAX_MESSAGE_BYTES_HARD_CAP, NETWORK_CONFIG_SEED},
    errors::A2AProtocolError,
    state::{
        NetworkConfig, NETWORK_CONFIG_DISCRIMINATOR, NETWORK_CONFIG_LEN,
    },
    utils::{
        create_pda_account, is_zero_pubkey, verify_signer, verify_system_program, verify_writable,
        write_borsh_account,
    },
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct InitializeNetworkConfigData {
    pub arbitration_authority: [u8; 32],
    pub min_channel_deposit: u64,
    pub min_bid_stake: u64,
    pub max_message_bytes: u32,
    pub max_dispute_slots: u64,
}

pub fn process_initialize_network_config(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = InitializeNetworkConfigData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    if is_zero_pubkey(&data.arbitration_authority) {
        return Err(A2AProtocolError::Unauthorized.into());
    }
    if data.min_channel_deposit == 0 || data.max_dispute_slots == 0 {
        return Err(A2AProtocolError::DeadlineInvalid.into());
    }
    if data.max_message_bytes == 0 || data.max_message_bytes > MAX_MESSAGE_BYTES_HARD_CAP {
        return Err(A2AProtocolError::MessageTooLarge.into());
    }

    let [authority, config, system_program] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    verify_signer(authority)?;
    verify_writable(authority)?;
    verify_writable(config)?;
    verify_system_program(system_program)?;

    if config.data_len() > 0 || config.lamports() > 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let (config_pda, config_bump) = Address::find_program_address(&[NETWORK_CONFIG_SEED], program_id);
    if config.address() != &config_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let config_bump_seed = [config_bump];
    create_pda_account(
        authority,
        NETWORK_CONFIG_LEN,
        program_id,
        config,
        [
            Seed::from(NETWORK_CONFIG_SEED),
            Seed::from(config_bump_seed.as_slice()),
        ],
    )?;

    write_borsh_account(
        config,
        NETWORK_CONFIG_DISCRIMINATOR,
        &NetworkConfig {
            upgrade_authority: authority.address().to_bytes(),
            arbitration_authority: data.arbitration_authority,
            min_channel_deposit: data.min_channel_deposit,
            min_bid_stake: data.min_bid_stake,
            max_message_bytes: data.max_message_bytes,
            max_dispute_slots: data.max_dispute_slots,
            bump: config_bump,
        },
    )?;
    Ok(())
}
