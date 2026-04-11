use pinocchio::{account::AccountView, error::ProgramError};

use crate::traits::InstructionAccounts;

/// Accounts for InitializeEvmAuthority.
pub struct InitializeEvmAuthorityAccounts<'a> {
    pub owner: &'a AccountView,
    pub evm_authority: &'a AccountView,
    pub system_program: &'a AccountView,
}

impl<'a> TryFrom<&'a [AccountView]> for InitializeEvmAuthorityAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        let [owner, evm_authority, system_program] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !owner.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }

        Ok(Self {
            owner,
            evm_authority,
            system_program,
        })
    }
}

impl<'a> InstructionAccounts<'a> for InitializeEvmAuthorityAccounts<'a> {}
