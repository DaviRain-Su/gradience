use pinocchio::error::ProgramError;

use crate::{require_len, traits::InstructionData};

/// Instruction data for Initialize.
///
/// Layout:
/// - upgrade_authority: [u8; 32]
/// - min_judge_stake:   u64 (LE)
pub struct InitializeData {
    pub upgrade_authority: [u8; 32],
    pub min_judge_stake: u64,
}

impl<'a> TryFrom<&'a [u8]> for InitializeData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        require_len!(data, Self::LEN);

        let mut upgrade_authority = [0u8; 32];
        upgrade_authority.copy_from_slice(&data[0..32]);

        let mut min_judge_stake_bytes = [0u8; 8];
        min_judge_stake_bytes.copy_from_slice(&data[32..40]);

        Ok(Self {
            upgrade_authority,
            min_judge_stake: u64::from_le_bytes(min_judge_stake_bytes),
        })
    }
}

impl<'a> InstructionData<'a> for InitializeData {
    const LEN: usize = 40;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initialize_data_try_from_valid() {
        let mut data = [0u8; 40];
        data[0..32].copy_from_slice(&[7u8; 32]);
        data[32..40].copy_from_slice(&1_000_000_000u64.to_le_bytes());

        let parsed = InitializeData::try_from(&data[..]).unwrap();
        assert_eq!(parsed.upgrade_authority, [7u8; 32]);
        assert_eq!(parsed.min_judge_stake, 1_000_000_000);
    }

    #[test]
    fn test_initialize_data_try_from_too_short() {
        let data = [0u8; 39];
        let parsed = InitializeData::try_from(&data[..]);
        assert!(matches!(parsed, Err(ProgramError::InvalidInstructionData)));
    }
}
