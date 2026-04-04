use alloc::string::String;
use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::error::ProgramError;

use crate::traits::InstructionData;

/// Instruction data for JudgeAndPay.
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct JudgeAndPayData {
    pub winner: [u8; 32],
    pub score: u8,
    pub reason_ref: Option<String>,
}

impl<'a> TryFrom<&'a [u8]> for JudgeAndPayData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        Self::try_from_slice(data).map_err(|_| ProgramError::InvalidInstructionData)
    }
}

impl<'a> InstructionData<'a> for JudgeAndPayData {
    const LEN: usize = usize::MAX;
}
