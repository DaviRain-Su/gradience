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
        1 // agent_count
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
        8 // updated_at
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
        8 // nonce
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
#[borsh(use_discriminant = true)]
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
        8 // updated_at
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
        1 // registration_enabled
    }
}

/// Reputation account - stores agent-level reputation aggregates
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Reputation {
    /// Account discriminator
    pub discriminator: [u8; 8],
    /// Reputation version
    pub version: u8,
    /// Agent public key
    pub agent: [u8; 32],
    /// Number of scored reviews
    pub total_reviews: u32,
    /// Sum of score basis points
    pub total_score_bps: u64,
    /// Average score basis points (0 - 10000)
    pub avg_score_bps: u16,
    /// Completed tasks
    pub completed: u32,
    /// Wins
    pub wins: u32,
    /// Win rate basis points (0 - 10000)
    pub win_rate_bps: u16,
    /// Last updated timestamp
    pub updated_at: i64,
}

impl Reputation {
    pub const DISCRIMINATOR: [u8; 8] = *b"REPUT___";

    pub fn size() -> usize {
        8 + // discriminator
        1 + // version
        32 + // agent
        4 + // total_reviews
        8 + // total_score_bps
        2 + // avg_score_bps
        4 + // completed
        4 + // wins
        2 + // win_rate_bps
        8 // updated_at
    }

    pub fn new(agent: [u8; 32], updated_at: i64) -> Self {
        Self {
            discriminator: Self::DISCRIMINATOR,
            version: 1,
            agent,
            total_reviews: 0,
            total_score_bps: 0,
            avg_score_bps: 0,
            completed: 0,
            wins: 0,
            win_rate_bps: 0,
            updated_at,
        }
    }

    pub fn apply_review(&mut self, score_bps: u16, won: bool, updated_at: i64) {
        self.total_reviews = self.total_reviews.saturating_add(1);
        self.total_score_bps = self.total_score_bps.saturating_add(score_bps as u64);
        self.completed = self.completed.saturating_add(1);
        if won {
            self.wins = self.wins.saturating_add(1);
        }
        self.avg_score_bps = (self.total_score_bps / self.total_reviews as u64) as u16;
        self.win_rate_bps = ((self.wins as u64 * 10_000) / self.completed as u64) as u16;
        self.updated_at = updated_at;
    }
}

#[cfg(test)]
mod tests {
    use super::Reputation;

    #[test]
    fn reputation_apply_review_updates_aggregates() {
        let mut rep = Reputation::new([1u8; 32], 0);

        rep.apply_review(7_000, false, 1);
        assert_eq!(rep.total_reviews, 1);
        assert_eq!(rep.avg_score_bps, 7_000);
        assert_eq!(rep.completed, 1);
        assert_eq!(rep.wins, 0);
        assert_eq!(rep.win_rate_bps, 0);

        rep.apply_review(9_000, true, 2);
        assert_eq!(rep.total_reviews, 2);
        assert_eq!(rep.avg_score_bps, 8_000);
        assert_eq!(rep.completed, 2);
        assert_eq!(rep.wins, 1);
        assert_eq!(rep.win_rate_bps, 5_000);
    }
}
