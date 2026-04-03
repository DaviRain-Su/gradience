use pinocchio::{account::AccountView, error::ProgramError};

use crate::{
    traits::InstructionAccounts,
    utils::{verify_current_program, verify_event_authority, verify_signer, verify_system_program, verify_writable},
};

/// Accounts for JudgeAndPay (SOL path).
///
/// Fixed accounts:
/// 0. `[signer, writable]` judge
/// 1. `[writable]` task PDA
/// 2. `[writable]` escrow PDA
/// 3. `[writable]` poster_account
/// 4. `[writable]` winner_account
/// 5. `[]` winner_application PDA
/// 6. `[]` winner_submission PDA
/// 7. `[writable]` winner_reputation PDA
/// 8. `[writable]` judge_stake PDA
/// 9. `[writable]` treasury PDA
/// 10. `[]` system_program
/// 11. `[]` event_authority PDA
/// 12. `[]` gradience_program
/// 13. `[writable, optional]` judge_token_account (SPL path)
/// 14. `[writable, optional]` escrow_ata (SPL path)
/// 15. `[writable, optional]` winner_token_account (SPL path)
/// 16. `[writable, optional]` poster_token_account (SPL path)
/// 17. `[writable, optional]` treasury_ata (SPL path)
/// 18. `[optional]` mint account (SPL path)
/// 19. `[optional]` token_program (SPL path)
/// 20. `[optional]` associated_token_program (SPL path)
///
/// Remaining accounts (optional): `[application_pda, agent_system_account]` pairs for losers.
pub struct JudgeAndPayAccounts<'a> {
    pub judge: &'a AccountView,
    pub task: &'a AccountView,
    pub escrow: &'a AccountView,
    pub poster_account: &'a AccountView,
    pub winner_account: &'a AccountView,
    pub winner_application: &'a AccountView,
    pub winner_submission: &'a AccountView,
    pub winner_reputation: &'a AccountView,
    pub judge_stake: &'a AccountView,
    pub treasury: &'a AccountView,
    pub system_program: &'a AccountView,
    pub event_authority: &'a AccountView,
    pub program: &'a AccountView,
    pub judge_token_account: Option<&'a AccountView>,
    pub escrow_ata: Option<&'a AccountView>,
    pub winner_token_account: Option<&'a AccountView>,
    pub poster_token_account: Option<&'a AccountView>,
    pub treasury_ata: Option<&'a AccountView>,
    pub mint: Option<&'a AccountView>,
    pub token_program: Option<&'a AccountView>,
    pub associated_token_program: Option<&'a AccountView>,
    pub remaining_accounts: &'a [AccountView],
}

#[derive(Clone, Copy)]
pub struct JudgeAndPayTokenAccounts<'a> {
    pub judge_token_account: &'a AccountView,
    pub escrow_ata: &'a AccountView,
    pub winner_token_account: &'a AccountView,
    pub poster_token_account: &'a AccountView,
    pub treasury_ata: &'a AccountView,
    pub mint: &'a AccountView,
    pub token_program: &'a AccountView,
    pub associated_token_program: &'a AccountView,
}

impl<'a> JudgeAndPayAccounts<'a> {
    #[inline(always)]
    pub fn token_path_accounts(&self) -> Option<JudgeAndPayTokenAccounts<'a>> {
        Some(JudgeAndPayTokenAccounts {
            judge_token_account: self.judge_token_account?,
            escrow_ata: self.escrow_ata?,
            winner_token_account: self.winner_token_account?,
            poster_token_account: self.poster_token_account?,
            treasury_ata: self.treasury_ata?,
            mint: self.mint?,
            token_program: self.token_program?,
            associated_token_program: self.associated_token_program?,
        })
    }
}

impl<'a> TryFrom<&'a [AccountView]> for JudgeAndPayAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        if accounts.len() < 13 {
            return Err(ProgramError::NotEnoughAccountKeys);
        }

        let (
            judge,
            task,
            escrow,
            poster_account,
            winner_account,
            winner_application,
            winner_submission,
            winner_reputation,
            judge_stake,
            treasury,
            system_program,
            event_authority,
            program,
            judge_token_account,
            escrow_ata,
            winner_token_account,
            poster_token_account,
            treasury_ata,
            mint,
            token_program,
            associated_token_program,
            remaining_accounts,
        ) = if accounts.len() >= 21 && (accounts.len() - 21).is_multiple_of(2) {
            let [
                judge,
                task,
                escrow,
                poster_account,
                winner_account,
                winner_application,
                winner_submission,
                winner_reputation,
                judge_stake,
                treasury,
                system_program,
                event_authority,
                program,
                judge_token_account,
                escrow_ata,
                winner_token_account,
                poster_token_account,
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
                judge,
                task,
                escrow,
                poster_account,
                winner_account,
                winner_application,
                winner_submission,
                winner_reputation,
                judge_stake,
                treasury,
                system_program,
                event_authority,
                program,
                Some(judge_token_account),
                Some(escrow_ata),
                Some(winner_token_account),
                Some(poster_token_account),
                Some(treasury_ata),
                Some(mint),
                Some(token_program),
                Some(associated_token_program),
                remaining_accounts,
            )
        } else if (accounts.len() - 13).is_multiple_of(2) {
            let [
                judge,
                task,
                escrow,
                poster_account,
                winner_account,
                winner_application,
                winner_submission,
                winner_reputation,
                judge_stake,
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
                judge,
                task,
                escrow,
                poster_account,
                winner_account,
                winner_application,
                winner_submission,
                winner_reputation,
                judge_stake,
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
                None,
                None,
                remaining_accounts,
            )
        } else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        verify_signer(judge)?;
        verify_writable(judge)?;
        verify_writable(task)?;
        verify_writable(escrow)?;
        verify_writable(poster_account)?;
        verify_writable(winner_account)?;
        verify_writable(winner_reputation)?;
        verify_writable(judge_stake)?;
        verify_writable(treasury)?;

        verify_system_program(system_program)?;
        verify_event_authority(event_authority)?;
        verify_current_program(program)?;

        if !remaining_accounts.len().is_multiple_of(2) {
            return Err(ProgramError::NotEnoughAccountKeys);
        }

        if let Some(account) = judge_token_account {
            verify_writable(account)?;
        }
        if let Some(account) = escrow_ata {
            verify_writable(account)?;
        }
        if let Some(account) = winner_token_account {
            verify_writable(account)?;
        }
        if let Some(account) = poster_token_account {
            verify_writable(account)?;
        }
        if let Some(account) = treasury_ata {
            verify_writable(account)?;
        }

        Ok(Self {
            judge,
            task,
            escrow,
            poster_account,
            winner_account,
            winner_application,
            winner_submission,
            winner_reputation,
            judge_stake,
            treasury,
            system_program,
            event_authority,
            program,
            judge_token_account,
            escrow_ata,
            winner_token_account,
            poster_token_account,
            treasury_ata,
            mint,
            token_program,
            associated_token_program,
            remaining_accounts,
        })
    }
}

impl<'a> InstructionAccounts<'a> for JudgeAndPayAccounts<'a> {}
