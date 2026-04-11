use alloc::vec;
use pinocchio::{account::AccountView, cpi::Seed, error::ProgramError, Address, ProgramResult};

use crate::{
    instructions::InitializeEvmAuthority,
    state::{
        ACCOUNT_VERSION_V1, EVM_AUTHORITY_DISCRIMINATOR, EVM_AUTHORITY_SEED,
        EvmAuthority,
    },
    utils::{create_pda_account, verify_system_account},
};

pub fn process_initialize_evm_authority(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let ix = InitializeEvmAuthority::try_from((instruction_data, accounts))?;

    let (evm_authority_pda, bump) =
        Address::find_program_address(&[EVM_AUTHORITY_SEED], program_id);

    if ix.accounts.evm_authority.address() != &evm_authority_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    verify_system_account(ix.accounts.evm_authority)?;

    let mut owner_bytes = [0u8; 32];
    owner_bytes.copy_from_slice(ix.accounts.owner.address().as_ref());
    let authority = EvmAuthority {
        owner: owner_bytes,
        relayers: ix.data.relayers.clone(),
        max_relayer_age_slots: ix.data.max_relayer_age_slots,
        bump,
    };

    let mut serialized = borsh::to_vec(&authority).map_err(|_| ProgramError::InvalidAccountData)?;
    let mut data = vec![ACCOUNT_VERSION_V1, EVM_AUTHORITY_DISCRIMINATOR];
    data.append(&mut serialized);

    let bump_seed = [bump];
    create_pda_account(
        ix.accounts.owner,
        data.len(),
        program_id,
        ix.accounts.evm_authority,
        [Seed::from(EVM_AUTHORITY_SEED), Seed::from(&bump_seed)],
    )?;

    ix.accounts.evm_authority.try_borrow_mut()?.copy_from_slice(&data);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{EVM_AUTHORITY_LEN, EvmAuthority};

    #[test]
    fn test_evm_authority_serialize() {
        let auth = EvmAuthority {
            owner: [1u8; 32],
            relayers: vec![[2u8; 32]; 8],
            max_relayer_age_slots: 100,
            bump: 255,
        };
        let bytes = borsh::to_vec(&auth).unwrap();
        assert_eq!(bytes.len() + 2, EVM_AUTHORITY_LEN);
    }
}
