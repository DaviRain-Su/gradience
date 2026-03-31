use pinocchio::error::ProgramError;
use thiserror::Error;

#[derive(Clone, Debug, Eq, PartialEq, Error)]
#[repr(u32)]
pub enum ChainHubError {
    #[error("Caller is not upgrade authority")]
    NotUpgradeAuthority = 7000,
    #[error("Invalid skill category")]
    InvalidSkillCategory = 7001,
    #[error("Skill name is invalid")]
    InvalidSkillName = 7002,
    #[error("Skill metadata URI is invalid")]
    InvalidSkillMetadataUri = 7003,
    #[error("Authority cannot be zero address")]
    ZeroAuthority = 7004,
    #[error("Skill account does not match requested skill")]
    SkillMismatch = 7005,
    #[error("JudgePool PDA shape mismatch")]
    InvalidJudgePoolShape = 7006,
}

impl From<ChainHubError> for ProgramError {
    fn from(value: ChainHubError) -> Self {
        ProgramError::Custom(value as u32)
    }
}
