use borsh::BorshSerialize;
use pinocchio::{account::AccountView, cpi::Seed, error::ProgramError, sysvars::{clock::Clock, Sysvar}, Address, ProgramResult};

use crate::{
    instructions::BindIdentity,
    state::{ACCOUNT_VERSION_V1, IDENTITY_BINDING_DISCRIMINATOR, IDENTITY_BINDING_LEN, IdentityBinding},
    utils::{create_pda_account, verify_writable},
};

const IDENTITY_BINDING_SEED: &[u8] = b"identity_binding";

#[inline(always)]
fn verify_pda(account: &AccountView, seeds: &[&[u8]], program_id: &Address) -> Result<u8, ProgramError> {
    let (pda, bump) = Address::find_program_address(seeds, program_id);
    if account.address() != &pda {
        return Err(ProgramError::InvalidSeeds);
    }
    Ok(bump)
}

pub fn process_bind_identity(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let ix = BindIdentity::try_from((instruction_data, accounts))?;

    verify_writable(ix.accounts.identity_binding)?;

    let owner_bytes = address_to_bytes(ix.accounts.owner.address());
    let bump = verify_pda(
        ix.accounts.identity_binding,
        &[IDENTITY_BINDING_SEED, &owner_bytes],
        program_id,
    )?;

    let clock = Clock::get()?;

    let binding = IdentityBinding {
        owner: owner_bytes,
        evm_address: ix.data.evm_address,
        sol_signature: ix.data.sol_signature,
        evm_signature: ix.data.evm_signature,
        verified: false,
        updated_at: clock.unix_timestamp,
        bump,
    };

    // Create or resize the identity_binding account
    let required_len = IDENTITY_BINDING_LEN;
    let current_len = ix.accounts.identity_binding.data_len();

    if current_len == 0 {
        // Create PDA account
        let owner_bytes = address_to_bytes(ix.accounts.owner.address());
        let bump_seed = [binding.bump];
        create_pda_account(
            ix.accounts.owner,
            required_len,
            program_id,
            ix.accounts.identity_binding,
            [
                Seed::from(IDENTITY_BINDING_SEED),
                Seed::from(owner_bytes.as_slice()),
                Seed::from(bump_seed.as_slice()),
            ],
        )?;
    } else if current_len < required_len {
        return Err(ProgramError::AccountDataTooSmall);
    }

    // Write data
    {
        let mut data = ix.accounts.identity_binding.try_borrow_mut()?;
        if data.len() < required_len {
            return Err(ProgramError::AccountDataTooSmall);
        }
        data[0] = IDENTITY_BINDING_DISCRIMINATOR;
        data[1] = ACCOUNT_VERSION_V1;
        binding.serialize(&mut &mut data[2..]).map_err(|_| ProgramError::InvalidAccountData)?;
    }

    Ok(())
}

fn address_to_bytes(address: &Address) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(address.as_ref());
    bytes
}
