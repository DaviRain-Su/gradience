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
/// 8. `[writable, optional]` poster_token_account (required when mint != [0; 32])
/// 9. `[writable, optional]` escrow_ata (required when mint != [0; 32])
/// 10. `[optional]` mint account (required when mint != [0; 32])
/// 11. `[optional]` token_program (required when mint != [0; 32])
/// 12. `[optional]` associated_token_program (required when mint != [0; 32])
pub struct PostTaskAccounts<'a> {
    pub poster: &'a AccountView,
    pub config: &'a AccountView,
    pub task: &'a AccountView,
    pub escrow: &'a AccountView,
    pub judge_pool: &'a AccountView,
    pub system_program: &'a AccountView,
    pub event_authority: &'a AccountView,
    pub program: &'a AccountView,
    pub poster_token_account: Option<&'a AccountView>,
    pub escrow_ata: Option<&'a AccountView>,
    pub mint: Option<&'a AccountView>,
    pub token_program: Option<&'a AccountView>,
    pub associated_token_program: Option<&'a AccountView>,
}

#[derive(Clone, Copy)]
pub struct PostTaskTokenAccounts<'a> {
    pub poster_token_account: &'a AccountView,
    pub escrow_ata: &'a AccountView,
    pub mint: &'a AccountView,
    pub token_program: &'a AccountView,
    pub associated_token_program: &'a AccountView,
}

impl<'a> PostTaskAccounts<'a> {
    #[inline(always)]
    pub fn token_path_accounts(&self) -> Option<PostTaskTokenAccounts<'a>> {
        Some(PostTaskTokenAccounts {
            poster_token_account: self.poster_token_account?,
            escrow_ata: self.escrow_ata?,
            mint: self.mint?,
            token_program: self.token_program?,
            associated_token_program: self.associated_token_program?,
        })
    }
}

impl<'a> TryFrom<&'a [AccountView]> for PostTaskAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        let (
            poster,
            config,
            task,
            escrow,
            judge_pool,
            system_program,
            event_authority,
            program,
            poster_token_account,
            escrow_ata,
            mint,
            token_program,
            associated_token_program,
        ) = match accounts {
            [poster, config, task, escrow, judge_pool, system_program, event_authority, program] => (
                poster,
                config,
                task,
                escrow,
                judge_pool,
                system_program,
                event_authority,
                program,
                None,
                None,
                None,
                None,
                None,
            ),
            [
                poster,
                config,
                task,
                escrow,
                judge_pool,
                system_program,
                event_authority,
                program,
                poster_token_account,
                escrow_ata,
                mint,
                token_program,
                associated_token_program,
            ] => (
                poster,
                config,
                task,
                escrow,
                judge_pool,
                system_program,
                event_authority,
                program,
                Some(poster_token_account),
                Some(escrow_ata),
                Some(mint),
                Some(token_program),
                Some(associated_token_program),
            ),
            _ => return Err(ProgramError::NotEnoughAccountKeys),
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

        if let Some(poster_token_account) = poster_token_account {
            verify_writable(poster_token_account)?;
        }
        if let Some(escrow_ata) = escrow_ata {
            verify_writable(escrow_ata)?;
        }

        Ok(Self {
            poster,
            config,
            task,
            escrow,
            judge_pool,
            system_program,
            event_authority,
            program,
            poster_token_account,
            escrow_ata,
            mint,
            token_program,
            associated_token_program,
        })
    }
}

impl<'a> InstructionAccounts<'a> for PostTaskAccounts<'a> {}
