use pinocchio::{account::AccountView, error::ProgramError};

use crate::traits::InstructionAccounts;

/// Accounts for UpdateReputationFromEvm.
pub struct UpdateReputationFromEvmAccounts<'a> {
    pub relayer: &'a AccountView,
    pub agent: &'a AccountView,
    pub reputation: &'a AccountView,
    pub evm_authority: &'a AccountView,
    pub system_program: &'a AccountView,
}

impl<'a> TryFrom<&'a [AccountView]> for UpdateReputationFromEvmAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        let [relayer, agent, reputation, evm_authority, system_program] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !relayer.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }

        Ok(Self {
            relayer,
            agent,
            reputation,
            evm_authority,
            system_program,
        })
    }
}

impl<'a> InstructionAccounts<'a> for UpdateReputationFromEvmAccounts<'a> {}
