use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::error::ProgramError;

use crate::traits::InstructionData;

/// Instruction data for UpgradeConfig.
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct UpgradeConfigData {
    pub new_treasury: Option<[u8; 32]>,
    pub new_min_judge_stake: Option<u64>,
}

impl<'a> TryFrom<&'a [u8]> for UpgradeConfigData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        Self::try_from_slice(data).map_err(|_| ProgramError::InvalidInstructionData)
    }
}

impl<'a> InstructionData<'a> for UpgradeConfigData {
    const LEN: usize = usize::MAX;
}

#[cfg(test)]
mod tests {
    use alloc::vec::Vec;

    use super::*;

    #[test]
    fn test_upgrade_config_data_roundtrip() {
        let source = UpgradeConfigData {
            new_treasury: Some([7u8; 32]),
            new_min_judge_stake: Some(2_000_000_000),
        };

        let mut bytes = Vec::new();
        source.serialize(&mut bytes).unwrap();
        let decoded = UpgradeConfigData::try_from(bytes.as_slice()).unwrap();
        assert_eq!(decoded, source);
    }
}
