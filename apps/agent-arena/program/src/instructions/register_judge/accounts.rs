use pinocchio::{account::AccountView, error::ProgramError};

use crate::{
    traits::InstructionAccounts,
    utils::{
        verify_current_program, verify_event_authority, verify_signer, verify_system_program,
        verify_writable,
    },
};

/// Accounts for RegisterJudge.
///
/// Fixed accounts:
/// 0. `[signer, writable]` judge
/// 1. `[]` config
/// 2. `[writable]` stake
/// 3. `[]` reputation
/// 4. `[]` system_program
/// 5. `[]` event_authority
/// 6. `[]` gradience_program
///
/// Remaining accounts:
/// - `[writable] judge_pool` x N (N = categories.len())
pub struct RegisterJudgeAccounts<'a> {
    pub judge: &'a AccountView,
    pub config: &'a AccountView,
    pub stake: &'a AccountView,
    pub reputation: &'a AccountView,
    pub system_program: &'a AccountView,
    pub event_authority: &'a AccountView,
    pub program: &'a AccountView,
    pub remaining_accounts: &'a [AccountView],
}

impl<'a> TryFrom<&'a [AccountView]> for RegisterJudgeAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        if accounts.len() < 7 {
            return Err(ProgramError::NotEnoughAccountKeys);
        }

        let [
            judge,
            config,
            stake,
            reputation,
            system_program,
            event_authority,
            program,
            remaining_accounts @ ..,
        ] = accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        verify_signer(judge)?;
        verify_writable(judge)?;
        verify_writable(stake)?;
        verify_system_program(system_program)?;
        verify_event_authority(event_authority)?;
        verify_current_program(program)?;

        for account in remaining_accounts {
            verify_writable(account)?;
        }

        Ok(Self {
            judge,
            config,
            stake,
            reputation,
            system_program,
            event_authority,
            program,
            remaining_accounts,
        })
    }
}

impl<'a> InstructionAccounts<'a> for RegisterJudgeAccounts<'a> {}
