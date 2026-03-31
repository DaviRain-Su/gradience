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
    #[error("Skill is not active")]
    SkillNotActive = 7007,
    #[error("Protocol is not active")]
    ProtocolNotActive = 7008,
    #[error("Invalid protocol id")]
    InvalidProtocolId = 7009,
    #[error("Invalid protocol endpoint")]
    InvalidProtocolEndpoint = 7010,
    #[error("Invalid protocol docs uri")]
    InvalidProtocolDocsUri = 7011,
    #[error("Invalid protocol program id")]
    InvalidProtocolProgramId = 7012,
    #[error("Invalid protocol idl reference")]
    InvalidProtocolIdlRef = 7013,
    #[error("Invalid capability mask")]
    InvalidCapabilityMask = 7014,
    #[error("Invalid auth mode")]
    InvalidAuthMode = 7015,
    #[error("Invalid protocol type")]
    InvalidProtocolType = 7016,
    #[error("Invalid trust model")]
    InvalidTrustModel = 7017,
    #[error("Invalid delegation state transition")]
    InvalidDelegationState = 7018,
    #[error("Delegation task expired")]
    DelegationExpired = 7019,
    #[error("Invalid max executions")]
    InvalidMaxExecutions = 7020,
    #[error("Unauthorized agent operation")]
    UnauthorizedAgent = 7021,
    #[error("Unauthorized requester operation")]
    UnauthorizedRequester = 7022,
    #[error("Unauthorized judge operation")]
    UnauthorizedJudge = 7023,
    #[error("Delegation protocol mismatch")]
    ProtocolMismatch = 7024,
    #[error("Invalid policy hash")]
    InvalidPolicyHash = 7025,
}

impl From<ChainHubError> for ProgramError {
    fn from(value: ChainHubError) -> Self {
        ProgramError::Custom(value as u32)
    }
}
