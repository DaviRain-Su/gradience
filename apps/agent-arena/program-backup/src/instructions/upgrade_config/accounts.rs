use pinocchio::{account::AccountView, error::ProgramError};

use crate::{
    traits::InstructionAccounts,
    utils::{verify_signer, verify_writable},
};

/// Accounts for UpgradeConfig.
///
/// 0. `[signer]` authority
/// 1. `[writable]` config
pub struct UpgradeConfigAccounts<'a> {
    pub authority: &'a AccountView,
    pub config: &'a AccountView,
}

impl<'a> TryFrom<&'a [AccountView]> for UpgradeConfigAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        let [authority, config] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        verify_signer(authority)?;
        verify_writable(config)?;

        Ok(Self { authority, config })
    }
}

impl<'a> InstructionAccounts<'a> for UpgradeConfigAccounts<'a> {}
