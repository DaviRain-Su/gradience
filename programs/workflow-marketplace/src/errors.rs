use pinocchio::error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorkflowError {
    #[error("Workflow not found")]
    WorkflowNotFound,
    
    #[error("Workflow already exists")]
    WorkflowAlreadyExists,
    
    #[error("Invalid pricing model")]
    InvalidPricingModel,
    
    #[error("Not purchased")]
    NotPurchased,
    
    #[error("Already reviewed")]
    AlreadyReviewed,
    
    #[error("Invalid rating (must be 1-5)")]
    InvalidRating,
    
    #[error("Workflow inactive")]
    WorkflowInactive,
    
    #[error("Unauthorized")]
    Unauthorized,
    
    #[error("Has purchases, cannot delete")]
    HasPurchases,
}

impl From<WorkflowError> for ProgramError {
    fn from(e: WorkflowError) -> Self {
        ProgramError::Custom(e as u32 + 6000)
    }
}
