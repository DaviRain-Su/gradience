use pinocchio::{account::AccountView, error::ProgramError};

use crate::{
    traits::InstructionAccounts,
    utils::{
        verify_current_program, verify_empty, verify_event_authority, verify_signer,
        verify_system_account, verify_system_program, verify_writable,
    },
};

/// Accounts for the PostTask instruction (SOL path).
///
/// 0. `[signer, writable]` poster
/// 1. `[writable]` config PDA
/// 2. `[writable]` task PDA (new)
/// 3. `[writable]` escrow PDA (new)
/// 4. `[]` judge_pool PDA (required for pool mode; ignored in designated mode)
/// 5. `[]` system_program
/// 6. `[]` event_authority PDA
/// 7. `[]` gradience_program
pub struct PostTaskAccounts<'a> {
    pub poster: &'a AccountView,
    pub config: &'a AccountView,
    pub task: &'a AccountView,
    pub escrow: &'a AccountView,
    pub judge_pool: &'a AccountView,
    pub system_program: &'a AccountView,
    pub event_authority: &'a AccountView,
    pub program: &'a AccountView,
}

impl<'a> TryFrom<&'a [AccountView]> for PostTaskAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        let [
            poster,
            config,
            task,
            escrow,
            judge_pool,
            system_program,
            event_authority,
            program,
        ] = accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        verify_signer(poster)?;
        verify_writable(poster)?;

        verify_writable(config)?;

        verify_writable(task)?;
        verify_empty(task)?;
        verify_system_account(task)?;

        verify_writable(escrow)?;
        verify_empty(escrow)?;
        verify_system_account(escrow)?;

        verify_system_program(system_program)?;
        verify_event_authority(event_authority)?;
        verify_current_program(program)?;

        Ok(Self {
            poster,
            config,
            task,
            escrow,
            judge_pool,
            system_program,
            event_authority,
            program,
        })
    }
}

impl<'a> InstructionAccounts<'a> for PostTaskAccounts<'a> {}
