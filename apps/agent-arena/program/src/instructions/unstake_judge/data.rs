use pinocchio::error::ProgramError;

use crate::traits::InstructionData;

/// Instruction data for UnstakeJudge.
pub struct UnstakeJudgeData;

impl<'a> TryFrom<&'a [u8]> for UnstakeJudgeData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        if !data.is_empty() {
            return Err(ProgramError::InvalidInstructionData);
        }
        Ok(Self)
    }
}

impl<'a> InstructionData<'a> for UnstakeJudgeData {
    const LEN: usize = 0;
}
