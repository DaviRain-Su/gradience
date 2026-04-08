use pinocchio::{account::AccountView, error::ProgramError};

use crate::traits::InstructionAccounts;

/// Accounts for ReceiveVrfRandomness.
///
/// 0. `[signer]` program_identity — MagicBlock VRF program identity PDA
/// 1. `[writable]` vrf_result — Gradience VRF result PDA for the task
pub struct ReceiveVrfRandomnessAccounts<'a> {
    pub program_identity: &'a AccountView,
    pub vrf_result: &'a AccountView,
}

impl<'a> TryFrom<&'a [AccountView]> for ReceiveVrfRandomnessAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        let [program_identity, vrf_result] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !program_identity.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }

        Ok(Self {
            program_identity,
            vrf_result,
        })
    }
}

impl<'a> InstructionAccounts<'a> for ReceiveVrfRandomnessAccounts<'a> {}
