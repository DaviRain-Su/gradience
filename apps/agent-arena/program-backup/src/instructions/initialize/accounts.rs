use pinocchio::{account::AccountView, error::ProgramError};

use crate::{
    traits::InstructionAccounts,
    utils::{verify_signer, verify_system_program, verify_writable},
};

/// Accounts for the Initialize instruction.
///
/// 0. `[signer, writable]` payer
/// 1. `[writable]` config PDA
/// 2. `[writable]` treasury PDA
/// 3. `[]` system_program
pub struct InitializeAccounts<'a> {
    pub payer: &'a AccountView,
    pub config: &'a AccountView,
    pub treasury: &'a AccountView,
    pub system_program: &'a AccountView,
}

impl<'a> TryFrom<&'a [AccountView]> for InitializeAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        let [payer, config, treasury, system_program] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        verify_signer(payer)?;
        verify_writable(payer)?;

        verify_writable(config)?;

        verify_writable(treasury)?;

        verify_system_program(system_program)?;

        Ok(Self {
            payer,
            config,
            treasury,
            system_program,
        })
    }
}

impl<'a> InstructionAccounts<'a> for InitializeAccounts<'a> {}
