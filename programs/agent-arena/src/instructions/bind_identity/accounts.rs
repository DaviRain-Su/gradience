use pinocchio::{account::AccountView, error::ProgramError};

use crate::traits::InstructionAccounts;

/// Accounts for BindIdentity.
pub struct BindIdentityAccounts<'a> {
    pub owner: &'a AccountView,
    pub identity_binding: &'a AccountView,
    pub system_program: &'a AccountView,
}

impl<'a> TryFrom<&'a [AccountView]> for BindIdentityAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        let [owner, identity_binding, system_program] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !owner.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }

        Ok(Self {
            owner,
            identity_binding,
            system_program,
        })
    }
}

impl<'a> InstructionAccounts<'a> for BindIdentityAccounts<'a> {}
