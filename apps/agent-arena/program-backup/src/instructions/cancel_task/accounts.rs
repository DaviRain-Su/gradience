use pinocchio::{account::AccountView, error::ProgramError};

use crate::{
    traits::InstructionAccounts,
    utils::{
        verify_current_program, verify_event_authority, verify_signer, verify_system_program,
        verify_writable,
    },
};

/// Accounts for CancelTask.
///
/// Fixed accounts:
/// 0. `[signer, writable]` poster
/// 1. `[writable]` task PDA
/// 2. `[writable]` escrow PDA
/// 3. `[writable]` treasury PDA
/// 4. `[]` system_program
/// 5. `[]` event_authority PDA
/// 6. `[]` gradience_program
/// 7. `[writable, optional]` poster_token_account (SPL path)
/// 8. `[writable, optional]` escrow_ata (SPL path)
/// 9. `[writable, optional]` treasury_ata (SPL path)
/// 10. `[optional]` mint account (SPL path)
/// 11. `[optional]` token_program (SPL path)
/// 12. `[optional]` associated_token_program (SPL path)
///
/// Remaining accounts (optional): `[application_pda, agent_account]` pairs.
pub struct CancelTaskAccounts<'a> {
    pub poster: &'a AccountView,
    pub task: &'a AccountView,
    pub escrow: &'a AccountView,
    pub treasury: &'a AccountView,
    pub system_program: &'a AccountView,
    pub event_authority: &'a AccountView,
    pub program: &'a AccountView,
    pub poster_token_account: Option<&'a AccountView>,
    pub escrow_ata: Option<&'a AccountView>,
    pub treasury_ata: Option<&'a AccountView>,
    pub mint: Option<&'a AccountView>,
    pub token_program: Option<&'a AccountView>,
    pub associated_token_program: Option<&'a AccountView>,
    pub remaining_accounts: &'a [AccountView],
}

#[derive(Clone, Copy)]
pub struct CancelTaskTokenAccounts<'a> {
    pub poster_token_account: &'a AccountView,
    pub escrow_ata: &'a AccountView,
    pub treasury_ata: &'a AccountView,
    pub mint: &'a AccountView,
    pub token_program: &'a AccountView,
    pub associated_token_program: &'a AccountView,
}

impl<'a> CancelTaskAccounts<'a> {
    #[inline(always)]
    pub fn token_path_accounts(&self) -> Option<CancelTaskTokenAccounts<'a>> {
        Some(CancelTaskTokenAccounts {
            poster_token_account: self.poster_token_account?,
            escrow_ata: self.escrow_ata?,
            treasury_ata: self.treasury_ata?,
            mint: self.mint?,
            token_program: self.token_program?,
            associated_token_program: self.associated_token_program?,
        })
    }
}

impl<'a> TryFrom<&'a [AccountView]> for CancelTaskAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        if accounts.len() < 7 {
            return Err(ProgramError::NotEnoughAccountKeys);
        }

        let (
            poster,
            task,
            escrow,
            treasury,
            system_program,
            event_authority,
            program,
            poster_token_account,
            escrow_ata,
            treasury_ata,
            mint,
            token_program,
            associated_token_program,
            remaining_accounts,
        ) = if accounts.len() >= 13 && (accounts.len() - 13).is_multiple_of(2) {
            let [
                poster,
                task,
                escrow,
                treasury,
                system_program,
                event_authority,
                program,
                poster_token_account,
                escrow_ata,
                treasury_ata,
                mint,
                token_program,
                associated_token_program,
                remaining_accounts @ ..,
            ] = accounts
            else {
                return Err(ProgramError::NotEnoughAccountKeys);
            };
            (
                poster,
                task,
                escrow,
                treasury,
                system_program,
                event_authority,
                program,
                Some(poster_token_account),
                Some(escrow_ata),
                Some(treasury_ata),
                Some(mint),
                Some(token_program),
                Some(associated_token_program),
                remaining_accounts,
            )
        } else if (accounts.len() - 7).is_multiple_of(2) {
            let [
                poster,
                task,
                escrow,
                treasury,
                system_program,
                event_authority,
                program,
                remaining_accounts @ ..,
            ] = accounts
            else {
                return Err(ProgramError::NotEnoughAccountKeys);
            };
            (
                poster,
                task,
                escrow,
                treasury,
                system_program,
                event_authority,
                program,
                None,
                None,
                None,
                None,
                None,
                None,
                remaining_accounts,
            )
        } else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        verify_signer(poster)?;
        verify_writable(poster)?;
        verify_writable(task)?;
        verify_writable(escrow)?;
        verify_writable(treasury)?;

        verify_system_program(system_program)?;
        verify_event_authority(event_authority)?;
        verify_current_program(program)?;

        if !remaining_accounts.len().is_multiple_of(2) {
            return Err(ProgramError::NotEnoughAccountKeys);
        }

        if let Some(account) = poster_token_account {
            verify_writable(account)?;
        }
        if let Some(account) = escrow_ata {
            verify_writable(account)?;
        }
        if let Some(account) = treasury_ata {
            verify_writable(account)?;
        }

        Ok(Self {
            poster,
            task,
            escrow,
            treasury,
            system_program,
            event_authority,
            program,
            poster_token_account,
            escrow_ata,
            treasury_ata,
            mint,
            token_program,
            associated_token_program,
            remaining_accounts,
        })
    }
}

impl<'a> InstructionAccounts<'a> for CancelTaskAccounts<'a> {}
