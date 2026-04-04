use pinocchio::{account::AccountView, error::ProgramError};

use crate::{
    traits::InstructionAccounts,
    utils::{
        verify_current_program, verify_event_authority, verify_signer, verify_system_program,
        verify_writable,
    },
};

/// Accounts for ForceRefund.
///
/// Fixed SOL accounts:
/// 0. `[signer, writable]` anyone
/// 1. `[writable]` poster_account
/// 2. `[writable]` most_active_agent
/// 3. `[]` config
/// 4. `[writable]` task
/// 5. `[writable]` escrow
/// 6. `[writable]` judge_stake
/// 7. `[writable]` judge_account
/// 8. `[]` judge_reputation
/// 9. `[writable]` treasury
/// 10. `[]` system_program
/// 11. `[]` event_authority
/// 12. `[]` gradience_program
///
/// Optional SPL accounts:
/// 13. `[writable]` poster_token_account
/// 14. `[writable]` most_active_agent_token_account
/// 15. `[writable]` escrow_ata
/// 16. `[writable]` treasury_ata
/// 17. `[]` mint
/// 18. `[]` token_program
/// 19. `[]` associated_token_program
///
/// Remaining accounts:
/// - First `judge_stake.category_count` accounts are judge pool PDAs.
/// - Rest are `[application_pda, agent_account]` pairs for stake refunds.
pub struct ForceRefundAccounts<'a> {
    pub anyone: &'a AccountView,
    pub poster_account: &'a AccountView,
    pub most_active_agent: &'a AccountView,
    pub config: &'a AccountView,
    pub task: &'a AccountView,
    pub escrow: &'a AccountView,
    pub judge_stake: &'a AccountView,
    pub judge_account: &'a AccountView,
    pub judge_reputation: &'a AccountView,
    pub treasury: &'a AccountView,
    pub system_program: &'a AccountView,
    pub event_authority: &'a AccountView,
    pub program: &'a AccountView,
    pub poster_token_account: Option<&'a AccountView>,
    pub most_active_agent_token_account: Option<&'a AccountView>,
    pub escrow_ata: Option<&'a AccountView>,
    pub treasury_ata: Option<&'a AccountView>,
    pub mint: Option<&'a AccountView>,
    pub token_program: Option<&'a AccountView>,
    pub associated_token_program: Option<&'a AccountView>,
    pub remaining_accounts: &'a [AccountView],
}

#[derive(Clone, Copy)]
pub struct ForceRefundTokenAccounts<'a> {
    pub poster_token_account: &'a AccountView,
    pub most_active_agent_token_account: &'a AccountView,
    pub escrow_ata: &'a AccountView,
    pub treasury_ata: &'a AccountView,
    pub mint: &'a AccountView,
    pub token_program: &'a AccountView,
    pub associated_token_program: &'a AccountView,
}

impl<'a> ForceRefundAccounts<'a> {
    #[inline(always)]
    pub fn token_path_accounts(&self) -> Option<ForceRefundTokenAccounts<'a>> {
        Some(ForceRefundTokenAccounts {
            poster_token_account: self.poster_token_account?,
            most_active_agent_token_account: self.most_active_agent_token_account?,
            escrow_ata: self.escrow_ata?,
            treasury_ata: self.treasury_ata?,
            mint: self.mint?,
            token_program: self.token_program?,
            associated_token_program: self.associated_token_program?,
        })
    }
}

impl<'a> TryFrom<&'a [AccountView]> for ForceRefundAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        if accounts.len() < 13 {
            return Err(ProgramError::NotEnoughAccountKeys);
        }

        let has_token_block = accounts.len() >= 20
            && (accounts[18].address() == &pinocchio_token::ID
                || accounts[18].address() == &pinocchio_token_2022::ID)
            && accounts[19].address() == &pinocchio_associated_token_account::ID;

        let (
            anyone,
            poster_account,
            most_active_agent,
            config,
            task,
            escrow,
            judge_stake,
            judge_account,
            judge_reputation,
            treasury,
            system_program,
            event_authority,
            program,
            poster_token_account,
            most_active_agent_token_account,
            escrow_ata,
            treasury_ata,
            mint,
            token_program,
            associated_token_program,
            remaining_accounts,
        ) = if has_token_block {
            let [
                anyone,
                poster_account,
                most_active_agent,
                config,
                task,
                escrow,
                judge_stake,
                judge_account,
                judge_reputation,
                treasury,
                system_program,
                event_authority,
                program,
                poster_token_account,
                most_active_agent_token_account,
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
                anyone,
                poster_account,
                most_active_agent,
                config,
                task,
                escrow,
                judge_stake,
                judge_account,
                judge_reputation,
                treasury,
                system_program,
                event_authority,
                program,
                Some(poster_token_account),
                Some(most_active_agent_token_account),
                Some(escrow_ata),
                Some(treasury_ata),
                Some(mint),
                Some(token_program),
                Some(associated_token_program),
                remaining_accounts,
            )
        } else {
            let [
                anyone,
                poster_account,
                most_active_agent,
                config,
                task,
                escrow,
                judge_stake,
                judge_account,
                judge_reputation,
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
                anyone,
                poster_account,
                most_active_agent,
                config,
                task,
                escrow,
                judge_stake,
                judge_account,
                judge_reputation,
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
                remaining_accounts,
            )
        };

        verify_signer(anyone)?;
        verify_writable(anyone)?;
        verify_writable(poster_account)?;
        verify_writable(most_active_agent)?;
        verify_writable(task)?;
        verify_writable(escrow)?;
        verify_writable(judge_stake)?;
        verify_writable(judge_account)?;
        verify_writable(treasury)?;

        verify_system_program(system_program)?;
        verify_event_authority(event_authority)?;
        verify_current_program(program)?;

        if let Some(account) = poster_token_account {
            verify_writable(account)?;
        }
        if let Some(account) = most_active_agent_token_account {
            verify_writable(account)?;
        }
        if let Some(account) = escrow_ata {
            verify_writable(account)?;
        }
        if let Some(account) = treasury_ata {
            verify_writable(account)?;
        }

        Ok(Self {
            anyone,
            poster_account,
            most_active_agent,
            config,
            task,
            escrow,
            judge_stake,
            judge_account,
            judge_reputation,
            treasury,
            system_program,
            event_authority,
            program,
            poster_token_account,
            most_active_agent_token_account,
            escrow_ata,
            treasury_ata,
            mint,
            token_program,
            associated_token_program,
            remaining_accounts,
        })
    }
}

impl<'a> InstructionAccounts<'a> for ForceRefundAccounts<'a> {}
