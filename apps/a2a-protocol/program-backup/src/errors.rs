use pinocchio::error::ProgramError;
use thiserror::Error;

#[derive(Clone, Debug, Eq, PartialEq, Error)]
#[repr(u32)]
pub enum A2AProtocolError {
    #[error("Invalid account version")]
    InvalidVersion = 8100,
    #[error("Unauthorized operation")]
    Unauthorized = 8101,
    #[error("Invalid state transition")]
    InvalidStateTransition = 8102,
    #[error("Invalid signature")]
    InvalidSignature = 8103,
    #[error("Nonce replay")]
    NonceReplay = 8104,
    #[error("Message too large")]
    MessageTooLarge = 8105,
    #[error("Channel insufficient deposit")]
    ChannelInsufficientDeposit = 8106,
    #[error("Dispute window closed")]
    DisputeWindowClosed = 8107,
    #[error("Bid window closed")]
    BidWindowClosed = 8108,
    #[error("Invalid bid stake")]
    InvalidBidStake = 8109,
    #[error("Subtask already assigned")]
    SubtaskAlreadyAssigned = 8110,
    #[error("Subtask not assigned")]
    SubtaskNotAssigned = 8111,
    #[error("Settlement amount invalid")]
    SettlementAmountInvalid = 8112,
    #[error("Deadline invalid")]
    DeadlineInvalid = 8113,
    #[error("Hash is empty")]
    HashEmpty = 8114,
}

impl From<A2AProtocolError> for ProgramError {
    fn from(value: A2AProtocolError) -> Self {
        ProgramError::Custom(value as u32)
    }
}
