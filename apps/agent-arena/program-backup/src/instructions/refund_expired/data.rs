use pinocchio::error::ProgramError;

use crate::traits::InstructionData;

/// Instruction data for RefundExpired.
pub struct RefundExpiredData;

impl<'a> TryFrom<&'a [u8]> for RefundExpiredData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        if !data.is_empty() {
            return Err(ProgramError::InvalidInstructionData);
        }
        Ok(Self)
    }
}

impl<'a> InstructionData<'a> for RefundExpiredData {
    const LEN: usize = 0;
}
