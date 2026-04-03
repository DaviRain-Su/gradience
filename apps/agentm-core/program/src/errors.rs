//! AgentM Core Errors

use pinocchio::error::ProgramError;

#[derive(Clone, Debug)]
pub enum AgentMError {
    InvalidInstruction = 0,
    Unauthorized = 1,
    AccountAlreadyInitialized = 2,
    AccountNotInitialized = 3,
    UserAlreadyRegistered = 10,
    UserNotRegistered = 11,
    InvalidUsername = 12,
    UsernameTooLong = 13,
    DisplayNameTooLong = 14,
    BioTooLong = 15,
    InvalidProfileData = 16,
    AlreadyFollowing = 20,
    NotFollowing = 21,
    FollowLimitReached = 22,
    CannotFollowSelf = 24,
    MessageTooLong = 30,
    InvalidRecipient = 31,
    AgentAlreadyExists = 40,
    AgentNotFound = 41,
    AgentNameTooLong = 43,
    MaxAgentsReached = 45,
    InvalidAgentData = 46,
    InvalidReputationScore = 50,
    ReputationAccountMismatch = 51,
}

impl From<AgentMError> for ProgramError {
    fn from(e: AgentMError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
