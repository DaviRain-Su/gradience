//! AgentM Core Errors

use pinocchio::program_error::ProgramError;

#[derive(Clone, Debug)]
pub enum AgentMError {
    // General errors (0-9)
    InvalidInstruction = 0,
    Unauthorized = 1,
    AccountAlreadyInitialized = 2,
    AccountNotInitialized = 3,
    
    // User errors (10-19)
    UserAlreadyRegistered = 10,
    UserNotRegistered = 11,
    InvalidUsername = 12,
    UsernameTooLong = 13,
    DisplayNameTooLong = 14,
    BioTooLong = 15,
    
    // Social graph errors (20-29)
    AlreadyFollowing = 20,
    NotFollowing = 21,
    FollowLimitReached = 22,
    FollowerLimitReached = 23,
    CannotFollowSelf = 24,
    
    // Message errors (30-39)
    MessageTooLong = 30,
    InvalidRecipient = 31,
    
    // Agent errors (40-49)
    AgentAlreadyExists = 40,
    AgentNotFound = 41,
    InvalidAgentName = 42,
    AgentNameTooLong = 43,
    AgentDescriptionTooLong = 44,
    MaxAgentsReached = 45,
}

impl From<AgentMError> for ProgramError {
    fn from(e: AgentMError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
