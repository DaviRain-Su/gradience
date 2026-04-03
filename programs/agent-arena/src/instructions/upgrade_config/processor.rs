use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{account::AccountView, error::ProgramError, Address, ProgramResult};

use crate::{
    errors::GradienceProgramError,
    instructions::UpgradeConfig,
    state::{ACCOUNT_VERSION_V1, PROGRAM_CONFIG_DISCRIMINATOR, ProgramConfig},
    utils::verify_owned_by,
};

const CONFIG_SEED: &[u8] = b"config";

#[inline(always)]
fn address_to_bytes(address: &Address) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(address.as_ref());
    bytes
}

pub fn process_upgrade_config(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let ix = UpgradeConfig::try_from((instruction_data, accounts))?;

    verify_owned_by(ix.accounts.config, program_id)?;

    let (config_pda, _) = Address::find_program_address(&[CONFIG_SEED], program_id);
    if ix.accounts.config.address() != &config_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let mut config = {
        let config_data = ix.accounts.config.try_borrow()?;
        if config_data.len() < 2
            || config_data[0] != PROGRAM_CONFIG_DISCRIMINATOR
            || config_data[1] != ACCOUNT_VERSION_V1
        {
            return Err(ProgramError::InvalidAccountData);
        }
        ProgramConfig::try_from_slice(&config_data[2..]).map_err(|_| ProgramError::InvalidAccountData)?
    };

    let authority = address_to_bytes(ix.accounts.authority.address());
    if authority != config.upgrade_authority {
        return Err(GradienceProgramError::NotUpgradeAuthority.into());
    }

    if let Some(new_treasury) = ix.data.new_treasury {
        config.treasury = new_treasury;
    }

    if let Some(new_min_judge_stake) = ix.data.new_min_judge_stake {
        if new_min_judge_stake == 0 {
            return Err(ProgramError::InvalidArgument);
        }
        config.min_judge_stake = new_min_judge_stake;
    }

    {
        let mut config_data = ix.accounts.config.try_borrow_mut()?;
        config_data[0] = PROGRAM_CONFIG_DISCRIMINATOR;
        config_data[1] = ACCOUNT_VERSION_V1;
        config
            .serialize(&mut &mut config_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    Ok(())
}
