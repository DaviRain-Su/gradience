use pinocchio::error::ProgramError;

use crate::traits::InstructionData;

/// Parsed instruction data for ReceiveVrfRandomness.
///
/// The raw instruction_data passed to the processor is:
///   [randomness (32 bytes)] + [callback_args (borsh task_id: u64)]
pub struct ReceiveVrfRandomnessData {
    pub randomness: [u8; 32],
    pub task_id: u64,
}

impl<'a> TryFrom<&'a [u8]> for ReceiveVrfRandomnessData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        if data.len() < 32 + 8 {
            return Err(ProgramError::InvalidInstructionData);
        }

        let mut randomness = [0u8; 32];
        randomness.copy_from_slice(&data[..32]);

        let task_id = u64::from_le_bytes(
            data[32..40]
                .try_into()
                .map_err(|_| ProgramError::InvalidInstructionData)?,
        );

        Ok(Self {
            randomness,
            task_id,
        })
    }
}

impl<'a> InstructionData<'a> for ReceiveVrfRandomnessData {
    const LEN: usize = usize::MAX;
}
