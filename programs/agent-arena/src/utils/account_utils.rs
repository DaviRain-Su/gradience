//! Account validation utilities.

use crate::ID as GRADIENCE_PROGRAM_ID;
use borsh::BorshDeserialize;
use pinocchio::{account::AccountView, address::Address, error::ProgramError};

/// Verify account is writable, returning an error if it is not.
///
/// # Arguments
/// * `account` - The account to verify.
///
/// # Returns
/// * `Result<(), ProgramError>` - The result of the operation
#[inline(always)]
pub fn verify_writable(account: &AccountView) -> Result<(), ProgramError> {
    if !account.is_writable() {
        return Err(ProgramError::Immutable);
    }
    Ok(())
}

/// Verify account is read-only, returning an error if it is writable.
///
/// # Arguments
/// * `account` - The account to verify.
///
/// # Returns
/// * `Result<(), ProgramError>` - The result of the operation
#[inline(always)]
pub fn verify_readonly(account: &AccountView) -> Result<(), ProgramError> {
    if account.is_writable() {
        return Err(ProgramError::InvalidArgument);
    }
    Ok(())
}

/// Verify account is a signer, returning an error if it is not.
///
/// # Arguments
/// * `account` - The account to verify.
///
/// # Returns
/// * `Result<(), ProgramError>` - The result of the operation
#[inline(always)]
pub fn verify_signer(account: &AccountView) -> Result<(), ProgramError> {
    if !account.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    Ok(())
}

/// Verify account's owner, returning an error if it is not the expected owner.
///
/// # Arguments
/// * `account` - The account to verify.
/// * `owner` - The expected owner.
///
/// # Returns
/// * `Result<(), ProgramError>` - The result of the operation
#[inline(always)]
pub fn verify_owned_by(account: &AccountView, owner: &Address) -> Result<(), ProgramError> {
    if !account.owned_by(owner) {
        return Err(ProgramError::InvalidAccountOwner);
    }

    Ok(())
}

/// Verify account is a system account, returning an error if it is not.
///
/// # Arguments
/// * `account` - The account to verify.
///
/// # Returns
/// * `Result<(), ProgramError>` - The result of the operation
#[inline(always)]
pub fn verify_system_account(account: &AccountView) -> Result<(), ProgramError> {
    verify_owned_by(account, &pinocchio_system::ID)
}

/// Verify account is the current program, returning an error if it is not.
///
/// # Arguments
/// * `account` - The account to verify.
///
/// # Returns
/// * `Result<(), ProgramError>` - The result of the operation
#[inline(always)]
pub fn verify_current_program_account(account: &AccountView) -> Result<(), ProgramError> {
    verify_owned_by(account, &GRADIENCE_PROGRAM_ID)
}

/// Verify account data is empty, returning an error if it is not.
///
/// # Arguments
/// * `account` - The account to verify.
///
/// # Returns
/// * `Result<(), ProgramError>` - The result of the operation
#[inline(always)]
pub fn verify_empty(account: &AccountView) -> Result<(), ProgramError> {
    if account.data_len() != 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }
    Ok(())
}

/// Borsh-deserialize from a potentially padded account data slice.
///
/// Many protocol accounts reserve max-size buffers (for future growth or variable fields),
/// so trailing zero bytes are expected and must be tolerated by deserialization.
#[inline(always)]
pub fn borsh_deserialize_padded<T: BorshDeserialize>(data: &[u8]) -> Result<T, ProgramError> {
    let mut cursor = data;
    T::deserialize(&mut cursor).map_err(|_| ProgramError::InvalidAccountData)
}
