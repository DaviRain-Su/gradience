use pinocchio::{account::AccountView, error::ProgramError};

use crate::{
    traits::InstructionAccounts,
    utils::{
        verify_current_program, verify_event_authority, verify_signer, verify_system_program,
        verify_writable,
    },
};

/// Accounts for RefundExpired.
///
/// SOL form:
/// 0. `[signer, writable]` anyone
/// 1. `[writable]` poster
/// 2. `[writable]` task
/// 3. `[writable]` escrow
/// 4. `[]` system_program
/// 5. `[]` event_authority
/// 6. `[]` gradience_program
/// + remaining `[application_pda, agent_system_account]` pairs
///
/// SPL form:
/// 0. `[signer, writable]` anyone
/// 1. `[writable]` task
/// 2. `[writable]` escrow
/// 3. `[]` system_program
/// 4. `[]` event_authority
/// 5. `[]` gradience_program
/// 6. `[writable]` poster_token_account
/// 7. `[writable]` escrow_ata
/// 8. `[]` mint
/// 9. `[]` token_program
/// + remaining `[application_pda, agent_token_account]` pairs
pub struct RefundExpiredAccounts<'a> {
    pub anyone: &'a AccountView,
    pub poster: Option<&'a AccountView>,
    pub task: &'a AccountView,
    pub escrow: &'a AccountView,
    pub system_program: &'a AccountView,
    pub event_authority: &'a AccountView,
    pub program: &'a AccountView,
    pub poster_token_account: Option<&'a AccountView>,
    pub escrow_ata: Option<&'a AccountView>,
    pub mint: Option<&'a AccountView>,
    pub token_program: Option<&'a AccountView>,
    pub remaining_accounts: &'a [AccountView],
}

#[derive(Clone, Copy)]
pub struct RefundExpiredTokenAccounts<'a> {
    pub poster_token_account: &'a AccountView,
    pub escrow_ata: &'a AccountView,
    pub mint: &'a AccountView,
    pub token_program: &'a AccountView,
}

impl<'a> RefundExpiredAccounts<'a> {
    #[inline(always)]
    pub fn token_path_accounts(&self) -> Option<RefundExpiredTokenAccounts<'a>> {
        Some(RefundExpiredTokenAccounts {
            poster_token_account: self.poster_token_account?,
            escrow_ata: self.escrow_ata?,
            mint: self.mint?,
            token_program: self.token_program?,
        })
    }
}

impl<'a> TryFrom<&'a [AccountView]> for RefundExpiredAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        if accounts.len() < 7 {
            return Err(ProgramError::NotEnoughAccountKeys);
        }

        let (
            anyone,
            poster,
            task,
            escrow,
            system_program,
            event_authority,
            program,
            poster_token_account,
            escrow_ata,
            mint,
            token_program,
            remaining_accounts,
        ) = if accounts.len() >= 10 && (accounts.len() - 10).is_multiple_of(2) {
            let [
                anyone,
                task,
                escrow,
                system_program,
                event_authority,
                program,
                poster_token_account,
                escrow_ata,
                mint,
                token_program,
                remaining_accounts @ ..,
            ] = accounts
            else {
                return Err(ProgramError::NotEnoughAccountKeys);
            };
            (
                anyone,
                None,
                task,
                escrow,
                system_program,
                event_authority,
                program,
                Some(poster_token_account),
                Some(escrow_ata),
                Some(mint),
                Some(token_program),
                remaining_accounts,
            )
        } else if (accounts.len() - 7).is_multiple_of(2) {
            let [
                anyone,
                poster,
                task,
                escrow,
                system_program,
                event_authority,
                program,
                remaining_accounts @ ..,
            ] = accounts
            else {
                return Err(ProgramError::NotEnoughAccountKeys);
            };
            (
                anyone,
                Some(poster),
                task,
                escrow,
                system_program,
                event_authority,
                program,
                None,
                None,
                None,
                None,
                remaining_accounts,
            )
        } else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        verify_signer(anyone)?;
        verify_writable(anyone)?;
        verify_writable(task)?;
        verify_writable(escrow)?;

        verify_system_program(system_program)?;
        verify_event_authority(event_authority)?;
        verify_current_program(program)?;

        if !remaining_accounts.len().is_multiple_of(2) {
            return Err(ProgramError::NotEnoughAccountKeys);
        }

        if let Some(poster) = poster {
            verify_writable(poster)?;
        }
        if let Some(poster_token_account) = poster_token_account {
            verify_writable(poster_token_account)?;
        }
        if let Some(escrow_ata) = escrow_ata {
            verify_writable(escrow_ata)?;
        }

        Ok(Self {
            anyone,
            poster,
            task,
            escrow,
            system_program,
            event_authority,
            program,
            poster_token_account,
            escrow_ata,
            mint,
            token_program,
            remaining_accounts,
        })
    }
}

impl<'a> InstructionAccounts<'a> for RefundExpiredAccounts<'a> {}
