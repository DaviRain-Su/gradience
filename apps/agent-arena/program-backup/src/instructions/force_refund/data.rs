use pinocchio::error::ProgramError;

use crate::traits::InstructionData;

/// Instruction data for ForceRefund.
pub struct ForceRefundData;

impl<'a> TryFrom<&'a [u8]> for ForceRefundData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        if !data.is_empty() {
            return Err(ProgramError::InvalidInstructionData);
        }
        Ok(Self)
    }
}

impl<'a> InstructionData<'a> for ForceRefundData {
    const LEN: usize = 0;
}
