use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{account::AccountView, cpi::Seed, error::ProgramError, Address, ProgramResult};
use pinocchio::{
    cpi::Signer,
    sysvars::{rent::Rent, Sysvar},
};
use pinocchio_system::instructions::CreateAccount;

pub fn verify_signer(account: &AccountView) -> Result<(), ProgramError> {
    if !account.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    Ok(())
}

pub fn verify_writable(account: &AccountView) -> Result<(), ProgramError> {
    if !account.is_writable() {
        return Err(ProgramError::Immutable);
    }
    Ok(())
}

pub fn verify_system_program(account: &AccountView) -> Result<(), ProgramError> {
    if account.address() != &pinocchio_system::ID {
        return Err(ProgramError::IncorrectProgramId);
    }
    Ok(())
}

pub fn verify_owner(account: &AccountView, expected_owner: &Address) -> Result<(), ProgramError> {
    let owner = unsafe { account.owner() };
    if owner != expected_owner {
        return Err(ProgramError::IllegalOwner);
    }
    Ok(())
}

pub fn create_pda_account<const N: usize>(
    payer: &AccountView,
    space: usize,
    owner: &Address,
    pda_account: &AccountView,
    pda_signer_seeds: [Seed; N],
) -> ProgramResult {
    let rent = Rent::get()?;
    let required_lamports = rent.try_minimum_balance(space).unwrap().max(1);
    let signers = [Signer::from(&pda_signer_seeds)];

    if pda_account.lamports() > 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    CreateAccount {
        from: payer,
        to: pda_account,
        lamports: required_lamports,
        space: space as u64,
        owner,
    }
    .invoke_signed(&signers)
}

pub fn read_borsh_account<T: BorshDeserialize>(
    account: &AccountView,
    discriminator: u8,
) -> Result<T, ProgramError> {
    let data = account.try_borrow()?;
    if data.len() < 2 {
        return Err(ProgramError::InvalidAccountData);
    }
    if data[0] != discriminator || data[1] != crate::state::ACCOUNT_VERSION_V1 {
        return Err(ProgramError::InvalidAccountData);
    }
    let mut payload = &data[2..];
    T::deserialize(&mut payload).map_err(|_| ProgramError::InvalidAccountData)
}

pub fn write_borsh_account<T: BorshSerialize>(
    account: &AccountView,
    discriminator: u8,
    value: &T,
) -> Result<(), ProgramError> {
    let mut data = account.try_borrow_mut()?;
    if data.len() < 2 {
        return Err(ProgramError::AccountDataTooSmall);
    }
    data[0] = discriminator;
    data[1] = crate::state::ACCOUNT_VERSION_V1;
    data[2..].fill(0);
    value
        .serialize(&mut &mut data[2..])
        .map_err(|_| ProgramError::InvalidAccountData)
}

#[inline(always)]
pub fn address_to_bytes(address: &Address) -> [u8; 32] {
    address.to_bytes()
}

#[inline(always)]
pub fn is_zero_pubkey(pubkey: &[u8; 32]) -> bool {
    pubkey.iter().all(|v| *v == 0)
}
