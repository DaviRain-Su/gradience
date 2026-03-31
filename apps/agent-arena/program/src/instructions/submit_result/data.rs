use alloc::string::String;
use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::error::ProgramError;

use crate::{state::RuntimeEnv, traits::InstructionData};

/// Instruction data for SubmitResult.
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct SubmitResultData {
    pub result_ref: String,
    pub trace_ref: String,
    pub runtime_env: RuntimeEnv,
}

impl<'a> TryFrom<&'a [u8]> for SubmitResultData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        Self::try_from_slice(data).map_err(|_| ProgramError::InvalidInstructionData)
    }
}

impl<'a> InstructionData<'a> for SubmitResultData {
    const LEN: usize = usize::MAX;
}

#[cfg(test)]
mod tests {
    use alloc::vec::Vec;

    use super::*;

    #[test]
    fn test_submit_result_data_roundtrip() {
        let source = SubmitResultData {
            result_ref: String::from("ar://result"),
            trace_ref: String::from("ar://trace"),
            runtime_env: RuntimeEnv {
                provider: String::from("openrouter"),
                model: String::from("gpt-4o-mini"),
                runtime: String::from("linux"),
                version: String::from("1.0.0"),
            },
        };

        let mut bytes = Vec::new();
        source.serialize(&mut bytes).unwrap();

        let parsed = SubmitResultData::try_from(bytes.as_slice()).unwrap();
        assert_eq!(parsed, source);
    }
}
