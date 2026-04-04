use pinocchio::{account::AccountView, error::ProgramError};

use crate::{
    traits::InstructionAccounts,
    utils::{
        verify_current_program, verify_event_authority, verify_signer, verify_system_program,
        verify_writable,
    },
};

/// Accounts for UnstakeJudge.
///
/// Fixed accounts:
/// 0. `[signer, writable]` judge
/// 1. `[writable]` stake
/// 2. `[]` system_program
/// 3. `[]` event_authority
/// 4. `[]` gradience_program
///
/// Remaining accounts:
/// - `[writable] judge_pool` x N (N = stake.category_count)
pub struct UnstakeJudgeAccounts<'a> {
    pub judge: &'a AccountView,
    pub stake: &'a AccountView,
    pub system_program: &'a AccountView,
    pub event_authority: &'a AccountView,
    pub program: &'a AccountView,
    pub remaining_accounts: &'a [AccountView],
}

impl<'a> TryFrom<&'a [AccountView]> for UnstakeJudgeAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        if accounts.len() < 5 {
            return Err(ProgramError::NotEnoughAccountKeys);
        }

        let [judge, stake, system_program, event_authority, program, remaining_accounts @ ..] =
            accounts
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
            stake,
            system_program,
            event_authority,
            program,
            remaining_accounts,
        })
    }
}

impl<'a> InstructionAccounts<'a> for UnstakeJudgeAccounts<'a> {}
