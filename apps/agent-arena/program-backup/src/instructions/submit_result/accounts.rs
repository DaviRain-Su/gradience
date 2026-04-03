use pinocchio::{account::AccountView, error::ProgramError};

use crate::{
    traits::InstructionAccounts,
    utils::{
        verify_current_program, verify_event_authority, verify_signer, verify_system_program,
        verify_writable,
    },
};

/// Accounts for SubmitResult.
///
/// 0. `[signer, writable]` agent
/// 1. `[writable]` task PDA
/// 2. `[]` application PDA
/// 3. `[writable]` submission PDA (new or existing)
/// 4. `[]` system_program
/// 5. `[]` event_authority PDA
/// 6. `[]` gradience_program
pub struct SubmitResultAccounts<'a> {
    pub agent: &'a AccountView,
    pub task: &'a AccountView,
    pub application: &'a AccountView,
    pub submission: &'a AccountView,
    pub system_program: &'a AccountView,
    pub event_authority: &'a AccountView,
    pub program: &'a AccountView,
}

impl<'a> TryFrom<&'a [AccountView]> for SubmitResultAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        let [agent, task, application, submission, system_program, event_authority, program] =
            accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        verify_signer(agent)?;
        verify_writable(agent)?;
        verify_writable(task)?;
        verify_writable(submission)?;

        verify_system_program(system_program)?;
        verify_event_authority(event_authority)?;
        verify_current_program(program)?;

        Ok(Self {
            agent,
            task,
            application,
            submission,
            system_program,
            event_authority,
            program,
        })
    }
}

impl<'a> InstructionAccounts<'a> for SubmitResultAccounts<'a> {}
