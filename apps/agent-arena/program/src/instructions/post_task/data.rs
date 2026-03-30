use alloc::string::String;
use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::error::ProgramError;

use crate::traits::InstructionData;

/// Instruction data for PostTask.
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct PostTaskData {
    pub eval_ref: String,
    pub deadline: i64,
    pub judge_deadline: i64,
    pub judge_mode: u8, // 0 = designated, 1 = pool
    pub judge: [u8; 32],
    pub category: u8,
    pub min_stake: u64,
    pub reward: u64,
}

impl<'a> TryFrom<&'a [u8]> for PostTaskData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        Self::try_from_slice(data).map_err(|_| ProgramError::InvalidInstructionData)
    }
}

impl<'a> InstructionData<'a> for PostTaskData {
    const LEN: usize = 0;
}

#[cfg(test)]
mod tests {
    use alloc::vec::Vec;

    use super::*;

    #[test]
    fn test_post_task_data_roundtrip() {
        let source = PostTaskData {
            eval_ref: "ar://abc".into(),
            deadline: 1000,
            judge_deadline: 2000,
            judge_mode: 0,
            judge: [9u8; 32],
            category: 1,
            min_stake: 123,
            reward: 456,
        };

        let mut bytes = Vec::new();
        source.serialize(&mut bytes).unwrap();
        let decoded = PostTaskData::try_from(bytes.as_slice()).unwrap();
        assert_eq!(decoded, source);
    }
}
