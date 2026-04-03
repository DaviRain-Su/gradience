use alloc::vec::Vec;
use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::error::ProgramError;

use crate::traits::InstructionData;

/// Instruction data for RegisterJudge.
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct RegisterJudgeData {
    pub categories: Vec<u8>,
    pub stake_amount: u64,
}

impl<'a> TryFrom<&'a [u8]> for RegisterJudgeData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        Self::try_from_slice(data).map_err(|_| ProgramError::InvalidInstructionData)
    }
}

impl<'a> InstructionData<'a> for RegisterJudgeData {
    const LEN: usize = usize::MAX;
}
