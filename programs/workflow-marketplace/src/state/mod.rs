use borsh::{BorshDeserialize, BorshSerialize};

/// Program config discriminator
pub const PROGRAM_CONFIG_DISCRIMINATOR: u8 = 0x00;

/// Treasury discriminator
pub const TREASURY_DISCRIMINATOR: u8 = 0x01;

/// Workflow metadata discriminator
pub const WORKFLOW_METADATA_DISCRIMINATOR: u8 = 0x02;

/// Workflow access discriminator
pub const WORKFLOW_ACCESS_DISCRIMINATOR: u8 = 0x03;

/// Workflow review discriminator
pub const WORKFLOW_REVIEW_DISCRIMINATOR: u8 = 0x04;

/// Program configuration
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct ProgramConfig {
    /// Treasury address (32 bytes)
    pub treasury: [u8; 32],
    /// Upgrade authority (32 bytes)
    pub upgrade_authority: [u8; 32],
    /// Protocol fee in bps (2 bytes)
    pub protocol_fee_bps: u16,
    /// Judge fee in bps (2 bytes)
    pub judge_fee_bps: u16,
    /// PDA bump (1 byte)
    pub bump: u8,
}

pub const PROGRAM_CONFIG_LEN: usize = 2 + 32 + 32 + 2 + 2 + 1; // discriminator + version + data

/// Treasury account
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Treasury {
    /// PDA bump
    pub bump: u8,
}

pub const TREASURY_LEN: usize = 2 + 1; // discriminator + version + bump

/// Workflow metadata
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct WorkflowMetadata {
    /// Workflow ID (32 bytes)
    pub workflow_id: [u8; 32],
    /// Author address (32 bytes)
    pub author: [u8; 32],
    /// Content hash (64 bytes)
    pub content_hash: [u8; 64],
    /// Version (16 bytes)
    pub version: [u8; 16],
    /// Pricing model (1 byte)
    pub pricing_model: u8,
    /// Price mint (32 bytes)
    pub price_mint: [u8; 32],
    /// Price amount (8 bytes)
    pub price_amount: u64,
    /// Creator share in bps (2 bytes)
    pub creator_share: u16,
    /// Total purchases (4 bytes)
    pub total_purchases: u32,
    /// Total executions (4 bytes)
    pub total_executions: u32,
    /// Average rating (2 bytes, 0-10000 where 10000 = 5.0)
    pub avg_rating: u16,
    /// Is public (1 byte)
    pub is_public: bool,
    /// Is active (1 byte)
    pub is_active: bool,
    /// Created at (8 bytes)
    pub created_at: i64,
    /// Updated at (8 bytes)
    pub updated_at: i64,
    /// PDA bump (1 byte)
    pub bump: u8,
}

pub const WORKFLOW_METADATA_LEN: usize = 2 + 32 + 32 + 64 + 16 + 1 + 32 + 8 + 2 + 4 + 4 + 2 + 1 + 1 + 8 + 8 + 1;

/// Workflow access (purchase record)
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct WorkflowAccess {
    /// Workflow ID (32 bytes)
    pub workflow_id: [u8; 32],
    /// User address (32 bytes)
    pub user: [u8; 32],
    /// Access type (1 byte)
    pub access_type: u8,
    /// Purchased at (8 bytes)
    pub purchased_at: i64,
    /// Expires at (8 bytes, 0 = never)
    pub expires_at: i64,
    /// Executions count (4 bytes)
    pub executions: u32,
    /// Max executions (4 bytes, 0 = unlimited)
    pub max_executions: u32,
    /// PDA bump (1 byte)
    pub bump: u8,
}

pub const WORKFLOW_ACCESS_LEN: usize = 2 + 32 + 32 + 1 + 8 + 8 + 4 + 4 + 1;

/// Workflow review
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct WorkflowReview {
    /// Workflow ID (32 bytes)
    pub workflow_id: [u8; 32],
    /// Reviewer address (32 bytes)
    pub reviewer: [u8; 32],
    /// Rating 1-5 (1 byte)
    pub rating: u8,
    /// Comment hash (32 bytes)
    pub comment_hash: [u8; 32],
    /// Created at (8 bytes)
    pub created_at: i64,
    /// Helpful votes (4 bytes)
    pub helpful_votes: u32,
    /// Verified purchase (1 byte)
    pub verified: bool,
    /// PDA bump (1 byte)
    pub bump: u8,
}

pub const WORKFLOW_REVIEW_LEN: usize = 2 + 32 + 32 + 1 + 32 + 8 + 4 + 1 + 1;

/// Pricing models
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PricingModel {
    Free = 0,
    OneTime = 1,
    Subscription = 2,
    PerUse = 3,
    RevenueShare = 4,
}

impl PricingModel {
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Self::Free),
            1 => Some(Self::OneTime),
            2 => Some(Self::Subscription),
            3 => Some(Self::PerUse),
            4 => Some(Self::RevenueShare),
            _ => None,
        }
    }
}
