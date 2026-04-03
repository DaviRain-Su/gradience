use pinocchio::error::ProgramError;

use crate::traits::InstructionData;

/// Instruction data for CancelTask.
pub struct CancelTaskData;

impl<'a> TryFrom<&'a [u8]> for CancelTaskData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        if !data.is_empty() {
            return Err(ProgramError::InvalidInstructionData);
        }
        Ok(Self)
    }
}

impl<'a> InstructionData<'a> for CancelTaskData {
    const LEN: usize = 0;
}
