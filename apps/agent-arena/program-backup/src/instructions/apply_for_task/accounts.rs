use pinocchio::{account::AccountView, error::ProgramError};

use crate::{
    traits::InstructionAccounts,
    utils::{
        verify_current_program, verify_empty, verify_event_authority, verify_signer,
        verify_system_account, verify_system_program, verify_writable,
    },
};

/// Accounts for the ApplyForTask instruction.
///
/// 0. `[signer, writable]` agent
/// 1. `[]` task PDA (read-only; submission_count is incremented in submit_result)
/// 2. `[writable]` escrow PDA
/// 3. `[writable]` application PDA (new)
/// 4. `[writable]` reputation PDA (new or existing)
/// 5. `[]` system_program
/// 6. `[]` event_authority PDA
/// 7. `[]` gradience_program
/// 8. `[writable, optional]` agent_token_account (required when staking SPL)
/// 9. `[writable, optional]` escrow_ata (required when staking SPL)
/// 10. `[optional]` mint account (required when staking SPL)
/// 11. `[optional]` token_program (required when staking SPL)
pub struct ApplyForTaskAccounts<'a> {
    pub agent: &'a AccountView,
    pub task: &'a AccountView,
    pub escrow: &'a AccountView,
    pub application: &'a AccountView,
    pub reputation: &'a AccountView,
    pub system_program: &'a AccountView,
    pub event_authority: &'a AccountView,
    pub program: &'a AccountView,
    pub agent_token_account: Option<&'a AccountView>,
    pub escrow_ata: Option<&'a AccountView>,
    pub mint: Option<&'a AccountView>,
    pub token_program: Option<&'a AccountView>,
}

#[derive(Clone, Copy)]
pub struct ApplyForTaskTokenAccounts<'a> {
    pub agent_token_account: &'a AccountView,
    pub escrow_ata: &'a AccountView,
    pub mint: &'a AccountView,
    pub token_program: &'a AccountView,
}

impl<'a> ApplyForTaskAccounts<'a> {
    #[inline(always)]
    pub fn token_path_accounts(&self) -> Option<ApplyForTaskTokenAccounts<'a>> {
        Some(ApplyForTaskTokenAccounts {
            agent_token_account: self.agent_token_account?,
            escrow_ata: self.escrow_ata?,
            mint: self.mint?,
            token_program: self.token_program?,
        })
    }
}

impl<'a> TryFrom<&'a [AccountView]> for ApplyForTaskAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        let (
            agent,
            task,
            escrow,
            application,
            reputation,
            system_program,
            event_authority,
            program,
            agent_token_account,
            escrow_ata,
            mint,
            token_program,
        ) = match accounts {
            [agent, task, escrow, application, reputation, system_program, event_authority, program] => (
                agent,
                task,
                escrow,
                application,
                reputation,
                system_program,
                event_authority,
                program,
                None,
                None,
                None,
                None,
            ),
            [
                agent,
                task,
                escrow,
                application,
                reputation,
                system_program,
                event_authority,
                program,
                agent_token_account,
                escrow_ata,
                mint,
                token_program,
            ] => (
                agent,
                task,
                escrow,
                application,
                reputation,
                system_program,
                event_authority,
                program,
                Some(agent_token_account),
                Some(escrow_ata),
                Some(mint),
                Some(token_program),
            ),
            _ => return Err(ProgramError::NotEnoughAccountKeys),
        };

        verify_signer(agent)?;
        verify_writable(agent)?;

        verify_writable(escrow)?;

        verify_writable(application)?;
        verify_empty(application)?;
        verify_system_account(application)?;

        verify_writable(reputation)?;

        verify_system_program(system_program)?;
        verify_event_authority(event_authority)?;
        verify_current_program(program)?;

        if let Some(agent_token_account) = agent_token_account {
            verify_writable(agent_token_account)?;
        }
        if let Some(escrow_ata) = escrow_ata {
            verify_writable(escrow_ata)?;
        }

        Ok(Self {
            agent,
            task,
            escrow,
            application,
            reputation,
            system_program,
            event_authority,
            program,
            agent_token_account,
            escrow_ata,
            mint,
            token_program,
        })
    }
}

impl<'a> InstructionAccounts<'a> for ApplyForTaskAccounts<'a> {}
