use codama::CodamaErrors;
use pinocchio::error::ProgramError;
use thiserror::Error;

/// All errors returned by the Gradience Protocol.
///
/// Error code ranges (intentional gaps between groups for future expansion):
///   6000–6006  Task state errors
///   6010–6014  Permission errors
///   6020–6025  Staking errors
///   6030–6039  Validation errors
///   6040       Arithmetic error
///   6041       Token error
#[derive(Clone, Debug, Eq, PartialEq, Error, CodamaErrors)]
#[repr(u32)]
pub enum GradienceProgramError {
    // ── Task state errors (6000–6006) ────────────────────────────────────────

    /// (6000) Task is not in the Open state
    #[error("Task is not open")]
    TaskNotOpen = 6000,

    /// (6001) Task deadline has already passed
    #[error("Task deadline has passed")]
    DeadlinePassed = 6001,

    /// (6002) Judge deadline has not yet passed
    #[error("Judge deadline has not passed")]
    JudgeDeadlineNotPassed = 6002,

    /// (6003) Force-refund delay period has not elapsed
    #[error("Force-refund delay has not elapsed")]
    ForceRefundDelayNotPassed = 6003,

    /// (6004) Task already has submissions and cannot be cancelled
    #[error("Task has submissions and cannot be cancelled")]
    HasSubmissions = 6004,

    /// (6005) No submissions for this task
    #[error("No submissions for task")]
    NoSubmissions = 6005,

    /// (6006) Deadline has not yet passed; operation requires expired deadline
    #[error("Deadline has not passed yet")]
    DeadlineNotPassed = 6006,

    // ── Permission errors (6010–6014) ─────────────────────────────────────────

    /// (6010) Caller is not the task poster
    #[error("Caller is not the task poster")]
    NotTaskPoster = 6010,

    /// (6011) Caller is not the task's designated judge
    #[error("Caller is not the task judge")]
    NotTaskJudge = 6011,

    /// (6012) Caller is not the program's upgrade authority
    #[error("Caller is not the upgrade authority")]
    NotUpgradeAuthority = 6012,

    /// (6013) Agent has not applied for this task
    #[error("Agent has not applied for this task")]
    AgentNotApplied = 6013,

    /// (6014) Winner does not have a submission for this task
    #[error("Winner has no submission for this task")]
    WinnerNoSubmission = 6014,

    // ── Staking errors (6020–6025) ────────────────────────────────────────────

    /// (6020) Agent stake amount is below the required minimum
    #[error("Agent stake amount is below the required minimum")]
    InsufficientAgentStake = 6020,

    /// (6021) Judge stake is below the protocol minimum
    #[error("Judge stake is below the protocol minimum")]
    InsufficientJudgeStake = 6021,

    /// (6022) Agent has already applied for this task
    #[error("Agent already applied for this task")]
    AlreadyApplied = 6022,

    /// (6023) Judge is already registered in the pool
    #[error("Judge already in pool")]
    AlreadyInPool = 6023,

    /// (6024) Unstake cooldown period has not yet expired
    #[error("Unstake cooldown has not expired")]
    CooldownNotExpired = 6024,

    /// (6025) JudgePool has reached the maximum number of judges
    #[error("JudgePool is full")]
    JudgePoolFull = 6025,

    // ── Validation errors (6030–6039) ─────────────────────────────────────────

    /// (6030) Score is outside the valid range 0–100
    #[error("Score is out of valid range")]
    InvalidScore = 6030,

    /// (6031) Task category is invalid
    #[error("Invalid task category")]
    InvalidCategory = 6031,

    /// (6032) Reference field is empty
    #[error("Reference field is empty")]
    EmptyRef = 6032,

    /// (6033) RuntimeEnv field is invalid (empty, too long, or malformed)
    #[error("RuntimeEnv field is invalid")]
    InvalidRuntimeEnv = 6033,

    /// (6034) A reference string exceeds max length
    #[error("Reference string exceeds maximum length")]
    RefTooLong = 6034,

    /// (6035) Categories list is invalid (empty or duplicate)
    #[error("Invalid categories list")]
    InvalidCategories = 6035,

    /// (6036) JudgePool is empty for this category
    #[error("JudgePool is empty for this category")]
    JudgePoolEmpty = 6036,

    /// (6037) Task reward is zero
    #[error("Task reward cannot be zero")]
    ZeroReward = 6037,

    /// (6038) Deadline must be in the future
    #[error("Invalid deadline")]
    InvalidDeadline = 6038,

    /// (6039) Judge deadline must be after task deadline
    #[error("Invalid judge deadline")]
    InvalidJudgeDeadline = 6039,

    // ── Arithmetic error (6040) ───────────────────────────────────────────────

    /// (6040) Integer overflow or underflow in fee calculation
    #[error("Arithmetic overflow")]
    Overflow = 6040,

    // ── Token error (6041) ────────────────────────────────────────────────────

    /// (6041) Unsupported Token-2022 extension
    #[error("Mint extension is not supported")]
    UnsupportedMintExtension = 6041,

    // ── VRF errors (6050–6051) ────────────────────────────────────────────────

    /// (6050) VRF result account has not been initialized by the daemon
    #[error("VRF result account not initialized")]
    VrfResultAccountNotInitialized = 6050,

    /// (6051) EVM sync nonce is too old (replay protection)
    #[error("EVM sync nonce too old")]
    EvmNonceTooOld = 6051,

    /// (6052) Relayer is not authorized
    #[error("Unauthorized relayer")]
    UnauthorizedRelayer = 6052,

    /// (6053) Invalid relayer signature
    #[error("Invalid relayer signature")]
    InvalidRelayerSignature = 6053,

    /// (6054) EvmAuthority account not initialized
    #[error("EVM authority not initialized")]
    EvmAuthorityNotInitialized = 6054,
}

impl From<GradienceProgramError> for ProgramError {
    fn from(e: GradienceProgramError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_codes_state_group() {
        assert_eq!(GradienceProgramError::TaskNotOpen as u32, 6000);
        assert_eq!(GradienceProgramError::DeadlinePassed as u32, 6001);
        assert_eq!(GradienceProgramError::JudgeDeadlineNotPassed as u32, 6002);
        assert_eq!(GradienceProgramError::ForceRefundDelayNotPassed as u32, 6003);
        assert_eq!(GradienceProgramError::HasSubmissions as u32, 6004);
        assert_eq!(GradienceProgramError::NoSubmissions as u32, 6005);
        assert_eq!(GradienceProgramError::DeadlineNotPassed as u32, 6006);
    }

    #[test]
    fn test_error_codes_permission_group() {
        assert_eq!(GradienceProgramError::NotTaskPoster as u32, 6010);
        assert_eq!(GradienceProgramError::NotTaskJudge as u32, 6011);
        assert_eq!(GradienceProgramError::NotUpgradeAuthority as u32, 6012);
        assert_eq!(GradienceProgramError::AgentNotApplied as u32, 6013);
        assert_eq!(GradienceProgramError::WinnerNoSubmission as u32, 6014);
    }

    #[test]
    fn test_error_codes_staking_group() {
        assert_eq!(GradienceProgramError::InsufficientAgentStake as u32, 6020);
        assert_eq!(GradienceProgramError::InsufficientJudgeStake as u32, 6021);
        assert_eq!(GradienceProgramError::AlreadyApplied as u32, 6022);
        assert_eq!(GradienceProgramError::AlreadyInPool as u32, 6023);
        assert_eq!(GradienceProgramError::CooldownNotExpired as u32, 6024);
        assert_eq!(GradienceProgramError::JudgePoolFull as u32, 6025);
    }

    #[test]
    fn test_error_codes_validation_group() {
        assert_eq!(GradienceProgramError::InvalidScore as u32, 6030);
        assert_eq!(GradienceProgramError::InvalidCategory as u32, 6031);
        assert_eq!(GradienceProgramError::EmptyRef as u32, 6032);
        assert_eq!(GradienceProgramError::InvalidRuntimeEnv as u32, 6033);
        assert_eq!(GradienceProgramError::RefTooLong as u32, 6034);
        assert_eq!(GradienceProgramError::InvalidCategories as u32, 6035);
        assert_eq!(GradienceProgramError::JudgePoolEmpty as u32, 6036);
        assert_eq!(GradienceProgramError::ZeroReward as u32, 6037);
        assert_eq!(GradienceProgramError::InvalidDeadline as u32, 6038);
        assert_eq!(GradienceProgramError::InvalidJudgeDeadline as u32, 6039);
    }

    #[test]
    fn test_error_codes_misc() {
        assert_eq!(GradienceProgramError::Overflow as u32, 6040);
        assert_eq!(GradienceProgramError::UnsupportedMintExtension as u32, 6041);
    }

    #[test]
    fn test_vrf_error_code() {
        assert_eq!(GradienceProgramError::VrfResultAccountNotInitialized as u32, 6050);
    }

    #[test]
    fn test_evm_error_codes() {
        assert_eq!(GradienceProgramError::EvmNonceTooOld as u32, 6051);
        assert_eq!(GradienceProgramError::UnauthorizedRelayer as u32, 6052);
        assert_eq!(GradienceProgramError::InvalidRelayerSignature as u32, 6053);
        assert_eq!(GradienceProgramError::EvmAuthorityNotInitialized as u32, 6054);
    }

    #[test]
    fn test_program_error_conversion() {
        let err: ProgramError = GradienceProgramError::TaskNotOpen.into();
        assert_eq!(err, ProgramError::Custom(6000));

        let err: ProgramError = GradienceProgramError::UnsupportedMintExtension.into();
        assert_eq!(err, ProgramError::Custom(6041));

        let err: ProgramError = GradienceProgramError::VrfResultAccountNotInitialized.into();
        assert_eq!(err, ProgramError::Custom(6050));
    }
}
