//! AgentM Core State Accounts

use borsh::{BorshDeserialize, BorshSerialize};

/// User account - stores basic user info
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct User {
    /// Account discriminator
    pub discriminator: [u8; 8],
    /// User version
    pub version: u8,
    /// Owner public key
    pub owner: [u8; 32],
    /// Username (unique)
    pub username: String,
    /// Registration timestamp
    pub created_at: i64,
    /// Last updated timestamp
    pub updated_at: i64,
    /// Is active
    pub is_active: bool,
    /// Number of agents owned
    pub agent_count: u8,
}

impl User {
    pub const DISCRIMINATOR: [u8; 8] = *b"USER____";
    
    pub fn size() -> usize {
        8 +     // discriminator
        1 +     // version
        32 +    // owner
        4 + 32 + // username (len + max)
        8 +     // created_at
        8 +     // updated_at
        1 +     // is_active
        1       // agent_count
    }
}

/// Profile account - stores user profile data
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Profile {
    /// Account discriminator
    pub discriminator: [u8; 8],
    /// Profile version
    pub version: u8,
    /// User public key
    pub user: [u8; 32],
    /// Display name
    pub display_name: String,
    /// Bio
    pub bio: String,
    /// Avatar URL
    pub avatar_url: String,
    /// Last updated
    pub updated_at: i64,
}

impl Profile {
    pub const DISCRIMINATOR: [u8; 8] = *b"PROFILE_";
    
    pub fn size() -> usize {
        8 +     // discriminator
        1 +     // version
        32 +    // user
        4 + 64 + // display_name
        4 + 256 + // bio
        4 + 128 + // avatar_url
        8       // updated_at
    }
}

/// Social Graph account - stores follow relationships
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct SocialGraph {
    /// Account discriminator
    pub discriminator: [u8; 8],
    /// Graph version
    pub version: u8,
    /// User public key
    pub user: [u8; 32],
    /// Following count
    pub following_count: u32,
    /// Followers count
    pub followers_count: u32,
    /// Following list (max 1000)
    pub following: Vec<[u8; 32]>,
}

impl SocialGraph {
    pub const DISCRIMINATOR: [u8; 8] = *b"SOCIAL__";
    
    pub fn size() -> usize {
        8 +     // discriminator
        1 +     // version
        32 +    // user
        4 +     // following_count
        4 +     // followers_count
        4 + (32 * 1000) // following vec (max 1000)
    }
}

/// Message account - stores direct messages
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Message {
    /// Account discriminator
    pub discriminator: [u8; 8],
    /// Message version
    pub version: u8,
    /// Sender public key
    pub sender: [u8; 32],
    /// Recipient public key
    pub recipient: [u8; 32],
    /// Message content
    pub content: String,
    /// Timestamp
    pub timestamp: i64,
    /// Message nonce (for ordering)
    pub nonce: u64,
}

impl Message {
    pub const DISCRIMINATOR: [u8; 8] = *b"MESSAGE_";
    
    pub fn size() -> usize {
        8 +     // discriminator
        1 +     // version
        32 +    // sender
        32 +    // recipient
        4 + 1024 + // content
        8 +     // timestamp
        8       // nonce
    }
}

/// Agent account - stores AI agent configuration
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Agent {
    /// Account discriminator
    pub discriminator: [u8; 8],
    /// Agent version
    pub version: u8,
    /// Owner public key
    pub owner: [u8; 32],
    /// Agent public key
    pub pubkey: [u8; 32],
    /// Agent name
    pub name: String,
    /// Agent description
    pub description: String,
    /// Agent type
    pub agent_type: AgentType,
    /// Configuration data
    pub config: Vec<u8>,
    /// Is active
    pub is_active: bool,
    /// Created at
    pub created_at: i64,
    /// Updated at
    pub updated_at: i64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq)]
pub enum AgentType {
    TaskExecutor = 0,
    SocialAgent = 1,
    TradingAgent = 2,
    Custom = 3,
}

impl Agent {
    pub const DISCRIMINATOR: [u8; 8] = *b"AGENT___";
    
    pub fn size() -> usize {
        8 +     // discriminator
        1 +     // version
        32 +    // owner
        32 +    // pubkey
        4 + 64 + // name
        4 + 512 + // description
        1 +     // agent_type
        4 + 1024 + // config
        1 +     // is_active
        8 +     // created_at
        8       // updated_at
    }
}

/// Program Config account
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct ProgramConfig {
    /// Account discriminator
    pub discriminator: [u8; 8],
    /// Config version
    pub version: u8,
    /// Admin public key
    pub admin: [u8; 32],
    /// Total users registered
    pub total_users: u64,
    /// Total agents created
    pub total_agents: u64,
    /// Is registration enabled
    pub registration_enabled: bool,
}

impl ProgramConfig {
    pub const DISCRIMINATOR: [u8; 8] = *b"CONFIG__";
    
    pub fn size() -> usize {
        8 +     // discriminator
        1 +     // version
        32 +    // admin
        8 +     // total_users
        8 +     // total_agents
        1       // registration_enabled
    }
}
