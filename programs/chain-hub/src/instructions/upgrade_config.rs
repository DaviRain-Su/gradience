use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{account::AccountView, error::ProgramError, Address, ProgramResult};

use crate::{
    constants::CONFIG_SEED,
    errors::ChainHubError,
    state::{ProgramConfig, PROGRAM_CONFIG_DISCRIMINATOR},
    utils::{is_zero_pubkey, read_borsh_account, verify_signer, verify_writable, write_borsh_account},
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct UpgradeConfigData {
    pub new_upgrade_authority: [u8; 32],
    pub new_agent_layer_program: [u8; 32],
}

pub fn process_upgrade_config(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = UpgradeConfigData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    let [authority, config_account] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    verify_signer(authority)?;
    verify_writable(config_account)?;

    if is_zero_pubkey(&data.new_upgrade_authority) || is_zero_pubkey(&data.new_agent_layer_program) {
        return Err(ChainHubError::ZeroAuthority.into());
    }

    let (config_pda, _) = Address::find_program_address(&[CONFIG_SEED], program_id);
    if config_account.address() != &config_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let mut config: ProgramConfig = read_borsh_account(config_account, PROGRAM_CONFIG_DISCRIMINATOR)?;
    if authority.address().to_bytes() != config.upgrade_authority {
        return Err(ChainHubError::NotUpgradeAuthority.into());
    }

    config.upgrade_authority = data.new_upgrade_authority;
    config.agent_layer_program = data.new_agent_layer_program;
    write_borsh_account(config_account, PROGRAM_CONFIG_DISCRIMINATOR, &config)?;
    Ok(())
}
