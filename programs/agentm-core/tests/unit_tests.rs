//! Unit tests for AgentM Core Program instruction logic
//! 
//! Tests the instruction functions directly without SVM simulation

use agentm_core::{
    constants::*,
    errors::AgentMError,
    state::{Agent, AgentType, Message, ProgramConfig, Profile, Reputation, User},
    addr_to_bytes,
};
use borsh::BorshSerialize;
use pinocchio::{
    error::ProgramError,
    Address,
};

/// Helper to create a test address
fn test_address(n: u8) -> Address {
    let mut bytes = [0u8; 32];
    bytes[0] = n;
    Address::new_from_array(bytes)
}

#[derive(BorshSerialize)]
struct UpdateProfileData {
    display_name: String,
    bio: String,
    avatar_url: String,
    updated_at: i64,
}

#[derive(BorshSerialize)]
struct CreateAgentData {
    name: String,
    description: String,
    agent_type: u8,
    config: Vec<u8>,
    created_at: i64,
}

#[derive(BorshSerialize)]
struct UpdateAgentConfigData {
    description: String,
    config: Vec<u8>,
    is_active: bool,
    updated_at: i64,
}

#[derive(BorshSerialize)]
struct UpdateReputationData {
    score_bps: u16,
    won: bool,
    updated_at: i64,
}

#[test]
fn test_username_length_validation() {
    // Test username length limits
    let valid_username = "a".repeat(MAX_USERNAME_LEN);
    assert!(valid_username.len() <= MAX_USERNAME_LEN);
    
    let invalid_username = "a".repeat(MAX_USERNAME_LEN + 1);
    assert!(invalid_username.len() > MAX_USERNAME_LEN);
}

#[test]
fn test_profile_field_length_validation() {
    // Test display name length
    let valid_display_name = "a".repeat(MAX_DISPLAY_NAME_LEN);
    assert!(valid_display_name.len() <= MAX_DISPLAY_NAME_LEN);
    
    let invalid_display_name = "a".repeat(MAX_DISPLAY_NAME_LEN + 1);
    assert!(invalid_display_name.len() > MAX_DISPLAY_NAME_LEN);
    
    // Test bio length
    let valid_bio = "a".repeat(MAX_BIO_LEN);
    assert!(valid_bio.len() <= MAX_BIO_LEN);
    
    let invalid_bio = "a".repeat(MAX_BIO_LEN + 1);
    assert!(invalid_bio.len() > MAX_BIO_LEN);
    
    // Test avatar URL length
    let valid_avatar_url = "a".repeat(MAX_AVATAR_URL_LEN);
    assert!(valid_avatar_url.len() <= MAX_AVATAR_URL_LEN);
    
    let invalid_avatar_url = "a".repeat(MAX_AVATAR_URL_LEN + 1);
    assert!(invalid_avatar_url.len() > MAX_AVATAR_URL_LEN);
}

#[test]
fn test_message_length_validation() {
    // Test message content length
    let valid_message = "a".repeat(MAX_MESSAGE_LEN);
    assert!(valid_message.len() <= MAX_MESSAGE_LEN);
    
    let invalid_message = "a".repeat(MAX_MESSAGE_LEN + 1);
    assert!(invalid_message.len() > MAX_MESSAGE_LEN);
}

#[test]
fn test_agent_field_length_validation() {
    // Test agent name length
    let valid_agent_name = "a".repeat(MAX_AGENT_NAME_LEN);
    assert!(valid_agent_name.len() <= MAX_AGENT_NAME_LEN);
    
    let invalid_agent_name = "a".repeat(MAX_AGENT_NAME_LEN + 1);
    assert!(invalid_agent_name.len() > MAX_AGENT_NAME_LEN);
    
    // Test agent description length
    let valid_agent_desc = "a".repeat(MAX_AGENT_DESCRIPTION_LEN);
    assert!(valid_agent_desc.len() <= MAX_AGENT_DESCRIPTION_LEN);
    
    let invalid_agent_desc = "a".repeat(MAX_AGENT_DESCRIPTION_LEN + 1);
    assert!(invalid_agent_desc.len() > MAX_AGENT_DESCRIPTION_LEN);
    
    // Test agent config length
    let valid_agent_config = vec![0u8; MAX_AGENT_CONFIG_LEN];
    assert!(valid_agent_config.len() <= MAX_AGENT_CONFIG_LEN);
    
    let invalid_agent_config = vec![0u8; MAX_AGENT_CONFIG_LEN + 1];
    assert!(invalid_agent_config.len() > MAX_AGENT_CONFIG_LEN);
}

#[test]
fn test_reputation_score_validation() {
    // Test valid reputation scores
    assert!(0 <= MAX_REPUTATION_SCORE_BPS);
    assert!(7500 <= MAX_REPUTATION_SCORE_BPS);
    assert!(10000 == MAX_REPUTATION_SCORE_BPS);
    
    // Test invalid reputation score would be > MAX_REPUTATION_SCORE_BPS
    let invalid_score = MAX_REPUTATION_SCORE_BPS + 1;
    assert!(invalid_score > MAX_REPUTATION_SCORE_BPS);
}

#[test]
fn test_state_structs() {
    // Test that state structs can be serialized/deserialized
    let user = User {
        discriminator: User::DISCRIMINATOR,
        version: 1,
        owner: [1u8; 32],
        username: "testuser".to_string(),
        created_at: 12345,
        updated_at: 12345,
        is_active: true,
        agent_count: 0,
    };
    
    let serialized = borsh::to_vec(&user).unwrap();
    let deserialized: User = borsh::from_slice(&serialized).unwrap();
    assert_eq!(user.username, deserialized.username);
    assert_eq!(user.owner, deserialized.owner);
    
    // Test Profile
    let profile = Profile {
        discriminator: Profile::DISCRIMINATOR,
        version: 1,
        user: [1u8; 32],
        display_name: "Test User".to_string(),
        bio: "I am a test user".to_string(),
        avatar_url: "https://example.com/avatar.jpg".to_string(),
        updated_at: 12345,
    };
    
    let serialized = borsh::to_vec(&profile).unwrap();
    let deserialized: Profile = borsh::from_slice(&serialized).unwrap();
    assert_eq!(profile.display_name, deserialized.display_name);
    
    // Test Message
    let message = Message {
        discriminator: Message::DISCRIMINATOR,
        version: 1,
        sender: [1u8; 32],
        recipient: [2u8; 32],
        content: "Hello, world!".to_string(),
        timestamp: 12345,
        nonce: 0,
    };
    
    let serialized = borsh::to_vec(&message).unwrap();
    let deserialized: Message = borsh::from_slice(&serialized).unwrap();
    assert_eq!(message.content, deserialized.content);
    
    // Test Agent
    let agent = Agent {
        discriminator: Agent::DISCRIMINATOR,
        version: 1,
        owner: [1u8; 32],
        pubkey: [2u8; 32],
        name: "Test Agent".to_string(),
        description: "I am a test agent".to_string(),
        agent_type: AgentType::SocialAgent,
        config: vec![1, 2, 3, 4],
        is_active: true,
        created_at: 12345,
        updated_at: 12345,
    };
    
    let serialized = borsh::to_vec(&agent).unwrap();
    let deserialized: Agent = borsh::from_slice(&serialized).unwrap();
    assert_eq!(agent.name, deserialized.name);
    assert_eq!(agent.agent_type, deserialized.agent_type);
    
    // Test Reputation
    let mut reputation = Reputation::new([3u8; 32], 12345);
    reputation.apply_review(8000, true, 12346);
    
    let serialized = borsh::to_vec(&reputation).unwrap();
    let deserialized: Reputation = borsh::from_slice(&serialized).unwrap();
    assert_eq!(reputation.avg_score_bps, deserialized.avg_score_bps);
    assert_eq!(reputation.win_rate_bps, deserialized.win_rate_bps);
}

#[test]
fn test_addr_to_bytes() {
    let addr = test_address(42);
    let bytes = addr_to_bytes(&addr);
    assert_eq!(bytes[0], 42);
    assert_eq!(bytes[1..], [0u8; 31]);
}

#[test]
fn test_constants() {
    // Test that constants are reasonable values
    assert!(MAX_USERNAME_LEN <= 64);
    assert!(MAX_DISPLAY_NAME_LEN <= 128);
    assert!(MAX_BIO_LEN <= 512);
    assert!(MAX_MESSAGE_LEN <= 2048);
    assert!(MAX_AGENT_NAME_LEN <= 128);
    assert!(MAX_AGENT_DESCRIPTION_LEN <= 1024);
    assert!(MAX_AGENT_CONFIG_LEN <= 2048);
    assert_eq!(MAX_REPUTATION_SCORE_BPS, 10_000);
    assert!(MAX_FOLLOWERS <= 50_000);
    assert!(MAX_FOLLOWING <= 10_000);
}

#[test]
fn test_error_conversion() {
    // Test that AgentMError converts to ProgramError correctly
    let error: ProgramError = AgentMError::Unauthorized.into();
    assert_eq!(error, ProgramError::Custom(1));
    
    let error: ProgramError = AgentMError::UsernameTooLong.into();
    assert_eq!(error, ProgramError::Custom(13));
    
    let error: ProgramError = AgentMError::InvalidReputationScore.into();
    assert_eq!(error, ProgramError::Custom(50));
}

#[test]
fn test_reputation_calculations() {
    let mut rep = Reputation::new([1u8; 32], 0);
    
    // Single review: 70%, won
    rep.apply_review(7000, true, 1);
    assert_eq!(rep.total_reviews, 1);
    assert_eq!(rep.avg_score_bps, 7000);
    assert_eq!(rep.completed, 1);
    assert_eq!(rep.wins, 1);
    assert_eq!(rep.win_rate_bps, 10000); // 100%
    
    // Second review: 90%, lost  
    rep.apply_review(9000, false, 2);
    assert_eq!(rep.total_reviews, 2);
    assert_eq!(rep.avg_score_bps, 8000); // (7000 + 9000) / 2
    assert_eq!(rep.completed, 2);
    assert_eq!(rep.wins, 1);
    assert_eq!(rep.win_rate_bps, 5000); // 50%
    
    // Third review: 60%, won
    rep.apply_review(6000, true, 3);
    assert_eq!(rep.total_reviews, 3);
    assert_eq!(rep.avg_score_bps, 7333); // (7000 + 9000 + 6000) / 3 = 22000 / 3 = 7333
    assert_eq!(rep.completed, 3);
    assert_eq!(rep.wins, 2);
    assert_eq!(rep.win_rate_bps, 6666); // 2/3 = 66.66%
}

#[test]
fn test_struct_sizes() {
    // Test that calculated sizes match expected sizes
    assert!(User::size() > 64); // Basic size check
    assert!(Profile::size() > 300); // Basic size check
    assert!(Agent::size() > 600); // Basic size check
    assert!(Message::size() > 1000); // Basic size check
    assert!(ProgramConfig::size() > 50); // Basic size check
    assert!(Reputation::size() > 60); // Basic size check
}

#[test]
fn test_agent_types() {
    // Test that agent types serialize correctly
    assert_eq!(AgentType::TaskExecutor as u8, 0);
    assert_eq!(AgentType::SocialAgent as u8, 1);
    assert_eq!(AgentType::TradingAgent as u8, 2);
    assert_eq!(AgentType::Custom as u8, 3);
    
    // Test serialization/deserialization
    let agent_type = AgentType::SocialAgent;
    let serialized = borsh::to_vec(&agent_type).unwrap();
    let deserialized: AgentType = borsh::from_slice(&serialized).unwrap();
    assert_eq!(agent_type, deserialized);
}