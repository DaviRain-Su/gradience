use pinocchio::{account::AccountView, error::ProgramError};

use crate::{
    traits::InstructionAccounts,
    utils::{verify_signer, verify_system_program, verify_writable},
};

/// Accounts for CreateTaskPermission.
///
/// 0. `[signer]` task — Gradience task PDA (must sign via invoke_signed)
/// 1. `[writable]` permission — MagicBlock Permission PDA for task
/// 2. `[signer, writable]` payer — Pays for permission PDA rent
/// 3. `[]` system_program — System program
/// 4. `[]` permission_program — MagicBlock Permission Program (hardcoded)
pub struct CreateTaskPermissionAccounts<'a> {
    pub task: &'a AccountView,
    pub permission: &'a AccountView,
    pub payer: &'a AccountView,
    pub system_program: &'a AccountView,
    pub permission_program: &'a AccountView,
}

impl<'a> TryFrom<&'a [AccountView]> for CreateTaskPermissionAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        let [task, permission, payer, system_program, permission_program] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !task.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }
        verify_writable(permission)?;
        verify_signer(payer)?;
        verify_writable(payer)?;
        verify_system_program(system_program)?;

        Ok(Self {
            task,
            permission,
            payer,
            system_program,
            permission_program,
        })
    }
}

impl<'a> InstructionAccounts<'a> for CreateTaskPermissionAccounts<'a> {}
