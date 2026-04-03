use pinocchio::{account::AccountView, address::Address, error::ProgramError};
use pinocchio::{
    cpi::{Seed, Signer},
    sysvars::{rent::Rent, Sysvar},
    ProgramResult,
};
use pinocchio_system::instructions::CreateAccount;

/// Create a PDA account
pub fn create_pda_account<const N: usize>(
    payer: &AccountView,
    space: usize,
    owner: &Address,
    pda_account: &AccountView,
    pda_signer_seeds: [Seed; N],
) -> ProgramResult {
    let rent = Rent::get()?;

    let required_lamports = rent.try_minimum_balance(space)?.max(1);

    let signers = [Signer::from(&pda_signer_seeds)];

    if pda_account.lamports() > 0 {
        Err(ProgramError::AccountAlreadyInitialized)
    } else {
        CreateAccount {
            from: payer,
            to: pda_account,
            lamports: required_lamports,
            space: space as u64,
            owner,
        }
        .invoke_signed(&signers)
    }
}

/// Helper to convert Address to bytes
#[inline(always)]
pub fn address_to_bytes(address: &Address) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(address.as_ref());
    bytes
}
