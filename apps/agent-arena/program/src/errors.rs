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

    /// (6002) Task has already been completed or refunded
    #[error("Task is already closed")]
    TaskAlreadyClosed = 6002,

    /// (6003) Task has no submissions; cannot judge
    #[error("No submissions for task")]
    NoSubmissions = 6003,

    /// (6004) Agent has already submitted a result for this task
    #[error("Agent already applied for this task")]
    AlreadyApplied = 6004,

    /// (6005) Task has submissions; cannot cancel
    #[error("Task has submissions and cannot be cancelled")]
    HasSubmissions = 6005,

    /// (6006) Deadline has not yet passed; operation requires expired deadline
    #[error("Deadline has not passed yet")]
    DeadlineNotPassed = 6006,

    // ── Permission errors (6010–6014) ─────────────────────────────────────────

    /// (6010) Caller is not the task's designated judge
    #[error("Caller is not the task judge")]
    NotTaskJudge = 6010,

    /// (6011) Caller is not the task poster
    #[error("Caller is not the task poster")]
    NotTaskPoster = 6011,

    /// (6012) Caller is not the program's upgrade authority
    #[error("Caller is not the upgrade authority")]
    NotUpgradeAuthority = 6012,

    /// (6013) Agent has not applied for this task
    #[error("Agent has not applied for this task")]
    AgentNotApplied = 6013,

    /// (6014) Self-evaluation attempted in a restricted context
    #[error("Self-evaluation not permitted here")]
    SelfEvalNotPermitted = 6014,

    // ── Staking errors (6020–6025) ────────────────────────────────────────────

    /// (6020) Stake amount is below the required minimum
    #[error("Stake amount is below the required minimum")]
    InsufficientStake = 6020,

    /// (6021) Judge stake is below the protocol minimum
    #[error("Judge stake is below the protocol minimum")]
    InsufficientJudgeStake = 6021,

    /// (6022) Unstake cooldown period has not yet expired
    #[error("Unstake cooldown has not expired")]
    CooldownNotExpired = 6022,

    /// (6023) JudgePool has reached the maximum number of judges (200)
    #[error("JudgePool is full")]
    JudgePoolFull = 6023,

    /// (6024) No judges are available in the pool for this category
    #[error("JudgePool is empty for this category")]
    JudgePoolEmpty = 6024,

    /// (6025) Judge is already registered in the pool
    #[error("Judge already registered in pool")]
    JudgeAlreadyRegistered = 6025,

    // ── Validation errors (6030–6039) ─────────────────────────────────────────

    /// (6030) Task reward is zero
    #[error("Task reward cannot be zero")]
    ZeroReward = 6030,

    /// (6031) A required reference string (result_ref / reason_ref / etc.) exceeds max length
    #[error("Reference string exceeds maximum length")]
    RefTooLong = 6031,

    /// (6032) RuntimeEnv field is invalid (empty, too long, or malformed)
    #[error("RuntimeEnv field is invalid")]
    InvalidRuntimeEnv = 6032,

    /// (6033) Mint has unsupported extensions (Transfer Hook or Confidential Transfer)
    #[error("Mint extension is not supported")]
    UnsupportedMintExtension = 6033,

    /// (6034) PDA seeds do not produce the expected address
    #[error("PDA derivation failed")]
    InvalidPda = 6034,

    /// (6035) Score is outside the valid range 0–100
    #[error("Score is out of valid range")]
    InvalidScore = 6035,

    /// (6036) Evaluation CID is empty or malformed
    #[error("Evaluation CID is invalid")]
    InvalidEvaluationCid = 6036,

    /// (6037) Force-refund delay period has not yet elapsed
    #[error("Force-refund delay has not elapsed")]
    ForceRefundDelayNotPassed = 6037,

    /// (6038) Task category is not recognised
    #[error("Unknown task category")]
    UnknownCategory = 6038,

    /// (6039) Judge deadline has not passed (used in two-step force_refund check)
    #[error("Judge deadline has not passed yet")]
    JudgeDeadlineNotPassed = 6039,

    // ── Arithmetic error (6040) ───────────────────────────────────────────────

    /// (6040) Integer overflow or underflow in fee calculation
    #[error("Arithmetic overflow")]
    ArithmeticOverflow = 6040,

    // ── Token error (6041) ────────────────────────────────────────────────────

    /// (6041) Token transfer or ATA operation failed
    #[error("Token operation failed")]
    TokenOperationFailed = 6041,
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
        assert_eq!(GradienceProgramError::TaskAlreadyClosed as u32, 6002);
        assert_eq!(GradienceProgramError::NoSubmissions as u32, 6003);
        assert_eq!(GradienceProgramError::AlreadyApplied as u32, 6004);
        assert_eq!(GradienceProgramError::HasSubmissions as u32, 6005);
        assert_eq!(GradienceProgramError::DeadlineNotPassed as u32, 6006);
    }

    #[test]
    fn test_error_codes_permission_group() {
        assert_eq!(GradienceProgramError::NotTaskJudge as u32, 6010);
        assert_eq!(GradienceProgramError::NotTaskPoster as u32, 6011);
        assert_eq!(GradienceProgramError::NotUpgradeAuthority as u32, 6012);
        assert_eq!(GradienceProgramError::AgentNotApplied as u32, 6013);
        assert_eq!(GradienceProgramError::SelfEvalNotPermitted as u32, 6014);
    }

    #[test]
    fn test_error_codes_staking_group() {
        assert_eq!(GradienceProgramError::InsufficientStake as u32, 6020);
        assert_eq!(GradienceProgramError::InsufficientJudgeStake as u32, 6021);
        assert_eq!(GradienceProgramError::CooldownNotExpired as u32, 6022);
        assert_eq!(GradienceProgramError::JudgePoolFull as u32, 6023);
        assert_eq!(GradienceProgramError::JudgePoolEmpty as u32, 6024);
        assert_eq!(GradienceProgramError::JudgeAlreadyRegistered as u32, 6025);
    }

    #[test]
    fn test_error_codes_validation_group() {
        assert_eq!(GradienceProgramError::ZeroReward as u32, 6030);
        assert_eq!(GradienceProgramError::RefTooLong as u32, 6031);
        assert_eq!(GradienceProgramError::InvalidRuntimeEnv as u32, 6032);
        assert_eq!(GradienceProgramError::UnsupportedMintExtension as u32, 6033);
        assert_eq!(GradienceProgramError::InvalidPda as u32, 6034);
        assert_eq!(GradienceProgramError::InvalidScore as u32, 6035);
        assert_eq!(GradienceProgramError::InvalidEvaluationCid as u32, 6036);
        assert_eq!(GradienceProgramError::ForceRefundDelayNotPassed as u32, 6037);
        assert_eq!(GradienceProgramError::UnknownCategory as u32, 6038);
        assert_eq!(GradienceProgramError::JudgeDeadlineNotPassed as u32, 6039);
    }

    #[test]
    fn test_error_codes_misc() {
        assert_eq!(GradienceProgramError::ArithmeticOverflow as u32, 6040);
        assert_eq!(GradienceProgramError::TokenOperationFailed as u32, 6041);
    }

    #[test]
    fn test_program_error_conversion() {
        let err: ProgramError = GradienceProgramError::TaskNotOpen.into();
        assert_eq!(err, ProgramError::Custom(6000));

        let err: ProgramError = GradienceProgramError::TokenOperationFailed.into();
        assert_eq!(err, ProgramError::Custom(6041));
    }
}
