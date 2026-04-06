//! Comprehensive tests for AgentM Core Program
//! 
//! Tests all 9 instructions with happy path and error cases

use agentm_core::{
    constants::*,
    state::{Agent, AgentType, Message, ProgramConfig, Profile, Reputation, User},
    addr_to_bytes,
};
use borsh::BorshSerialize;
use litesvm::LiteSVM;
use solana_sdk::{
    account::Account,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::Transaction,
};

const SYSTEM_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0u8; 32]);

const PROGRAM_ID: Pubkey = Pubkey::new_from_array([1u8; 32]);

/// Helper to create a test SVM instance with the program loaded
fn setup_test() -> (LiteSVM, Keypair) {
    let mut svm = LiteSVM::new();

    // Load the compiled program ELF
    svm.add_program_from_file(&PROGRAM_ID, "../target/deploy/agentm_core.so")
        .unwrap();

    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();

    (svm, payer)
}

/// Helper to create an instruction
fn create_instruction(
    program_id: Pubkey,
    discriminator: u8,
    accounts: Vec<AccountMeta>,
    data: Vec<u8>,
) -> Instruction {
    let mut instruction_data = vec![discriminator];
    instruction_data.extend_from_slice(&data);
    
    Instruction {
        program_id,
        accounts,
        data: instruction_data,
    }
}

/// Helper to execute an instruction and return the result
fn execute_instruction(
    svm: &mut LiteSVM,
    payer: &Keypair,
    instruction: Instruction,
) -> bool {
    let transaction = Transaction::new_signed_with_payer(
        &[instruction],
        Some(&payer.pubkey()),
        &[payer],
        svm.latest_blockhash(),
    );
    svm.send_transaction(transaction).is_ok()
}

/// Helper to execute an instruction with a custom fee payer.
/// Useful for testing missing-signature cases.
fn execute_instruction_with_payer(
    svm: &mut LiteSVM,
    payer: &Keypair,
    instruction: Instruction,
) -> bool {
    let transaction = Transaction::new_signed_with_payer(
        &[instruction],
        Some(&payer.pubkey()),
        &[payer],
        svm.latest_blockhash(),
    );
    svm.send_transaction(transaction).is_ok()
}

/// Helper to create an account with specified size and owner
fn create_account(svm: &mut LiteSVM, _payer: &Keypair, size: usize, owner: Pubkey) -> Pubkey {
    let account_keypair = Keypair::new();
    let account_pubkey = account_keypair.pubkey();
    
    let account = Account {
        lamports: 1_000_000,
        data: vec![0; size],
        owner,
        executable: false,
        rent_epoch: 0,
    };
    
    svm.set_account(account_pubkey, account).unwrap();
    account_pubkey
}

/// Deserialize from account data that may contain trailing zeros.
fn deserialize_account_data<T: borsh::BorshDeserialize>(data: &[u8]) -> T {
    for i in 1..=data.len() {
        if let Ok(val) = borsh::from_slice(&data[..i]) {
            return val;
        }
    }
    panic!("Failed to deserialize account data")
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
fn test_initialize_success() {
    let (mut svm, payer) = setup_test();
    
    // Create config account
    let config_account = create_account(&mut svm, &payer, ProgramConfig::size(), PROGRAM_ID);
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),   // admin
        AccountMeta::new(config_account, false),  // config_account
        AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false), // system_program
    ];
    
    let instruction = create_instruction(PROGRAM_ID, 0, accounts, vec![]);
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    assert!(result, "Initialize should succeed");
    
    // Verify config was written correctly
    let config_data = svm.get_account(&config_account).unwrap().data;
    assert!(config_data.starts_with(&ProgramConfig::DISCRIMINATOR));
    
    let config: ProgramConfig = deserialize_account_data(&config_data);
    assert_eq!(config.admin, addr_to_bytes(&payer.pubkey()));
    assert_eq!(config.total_users, 0);
    assert_eq!(config.total_agents, 0);
    assert!(config.registration_enabled);
}

#[test]
fn test_initialize_already_initialized() {
    let (mut svm, payer) = setup_test();
    
    // Create and initialize config account
    let config_account = create_account(&mut svm, &payer, ProgramConfig::size(), PROGRAM_ID);
    
    // Initialize once
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),
        AccountMeta::new(config_account, false),
        AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
    ];
    let instruction = create_instruction(PROGRAM_ID, 0, accounts.clone(), vec![]);
    assert!(execute_instruction(&mut svm, &payer, instruction), "First initialization should succeed");
    
    // Try to initialize again
    let instruction = create_instruction(PROGRAM_ID, 0, accounts, vec![]);
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    assert!(!result, "Should fail - already initialized");
}

#[test]
fn test_initialize_missing_signature() {
    let (mut svm, payer) = setup_test();
    let other_user = Keypair::new();

    let config_account = create_account(&mut svm, &payer, ProgramConfig::size(), PROGRAM_ID);

    let accounts = vec![
        AccountMeta::new(other_user.pubkey(), false), // Not a signer!
        AccountMeta::new(config_account, false),
        AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
    ];

    let fee_payer = Keypair::new();
    svm.airdrop(&fee_payer.pubkey(), 1_000_000_000).unwrap();

    let instruction = create_instruction(PROGRAM_ID, 0, accounts, vec![]);
    let result = execute_instruction_with_payer(&mut svm, &fee_payer, instruction);

    assert!(!result, "Should fail - missing signature");
}

#[test]
fn test_register_user_success() {
    let (mut svm, payer) = setup_test();
    
    let user_account = create_account(&mut svm, &payer, User::size(), PROGRAM_ID);
    let username = "alice".to_string();
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),      // payer
        AccountMeta::new(user_account, false),       // user_account
        AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false), // system_program
    ];
    
    let instruction = create_instruction(PROGRAM_ID, 1, accounts, username.as_bytes().to_vec());
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    assert!(result, "Register user should succeed");
    
    // Verify user was created correctly
    let user_data = svm.get_account(&user_account).unwrap().data;
    assert!(user_data.starts_with(&User::DISCRIMINATOR));
    
    let user: User = deserialize_account_data(&user_data);
    assert_eq!(user.username, username);
    assert_eq!(user.owner, addr_to_bytes(&payer.pubkey()));
    assert!(user.is_active);
    assert_eq!(user.agent_count, 0);
}

#[test]
fn test_register_user_username_too_long() {
    let (mut svm, payer) = setup_test();
    
    let user_account = create_account(&mut svm, &payer, User::size(), PROGRAM_ID);
    let username = "a".repeat(MAX_USERNAME_LEN + 1); // Too long!
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),
        AccountMeta::new(user_account, false),
        AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
    ];
    
    let instruction = create_instruction(PROGRAM_ID, 1, accounts, username.as_bytes().to_vec());
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    assert!(!result, "Should fail - username too long");
}

#[test]
fn test_register_user_missing_signature() {
    let (mut svm, payer) = setup_test();
    let other_user = Keypair::new();
    
    let user_account = create_account(&mut svm, &payer, User::size(), PROGRAM_ID);
    
    let accounts = vec![
        AccountMeta::new(other_user.pubkey(), false), // Not a signer!
        AccountMeta::new(user_account, false),
        AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
    ];
    
    let fee_payer = Keypair::new();
    svm.airdrop(&fee_payer.pubkey(), 1_000_000_000).unwrap();

    let instruction = create_instruction(PROGRAM_ID, 1, accounts, b"alice".to_vec());
    let result = execute_instruction_with_payer(&mut svm, &fee_payer, instruction);

    assert!(!result, "Should fail - missing signature");
}

#[test]
fn test_update_profile_success() {
    let (mut svm, payer) = setup_test();
    
    let profile_account = create_account(&mut svm, &payer, Profile::size(), PROGRAM_ID);
    
    let profile_data = UpdateProfileData {
        display_name: "Alice Smith".to_string(),
        bio: "I love coding!".to_string(),
        avatar_url: "https://example.com/avatar.jpg".to_string(),
        updated_at: 1234567890,
    };
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),       // user
        AccountMeta::new(profile_account, false),     // profile_account
    ];
    
    let serialized_data = borsh::to_vec(&profile_data).unwrap();
    let instruction = create_instruction(PROGRAM_ID, 2, accounts, serialized_data);
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    assert!(result, "Update profile should succeed");
    
    // Verify profile was created/updated
    let profile_account_data = svm.get_account(&profile_account).unwrap().data;
    assert!(profile_account_data.starts_with(&Profile::DISCRIMINATOR));
    
    let profile: Profile = deserialize_account_data(&profile_account_data);
    assert_eq!(profile.display_name, "Alice Smith");
    assert_eq!(profile.bio, "I love coding!");
    assert_eq!(profile.avatar_url, "https://example.com/avatar.jpg");
    assert_eq!(profile.user, addr_to_bytes(&payer.pubkey()));
}

#[test]
fn test_update_profile_display_name_too_long() {
    let (mut svm, payer) = setup_test();
    
    let profile_account = create_account(&mut svm, &payer, Profile::size(), PROGRAM_ID);
    
    let profile_data = UpdateProfileData {
        display_name: "a".repeat(MAX_DISPLAY_NAME_LEN + 1), // Too long!
        bio: "Valid bio".to_string(),
        avatar_url: "https://example.com/avatar.jpg".to_string(),
        updated_at: 1234567890,
    };
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),
        AccountMeta::new(profile_account, false),
    ];
    
    let serialized_data = borsh::to_vec(&profile_data).unwrap();
    let instruction = create_instruction(PROGRAM_ID, 2, accounts, serialized_data);
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    assert!(!result, "Should fail - display name too long");
}

#[test]
fn test_update_profile_bio_too_long() {
    let (mut svm, payer) = setup_test();
    
    let profile_account = create_account(&mut svm, &payer, Profile::size(), PROGRAM_ID);
    
    let profile_data = UpdateProfileData {
        display_name: "Alice".to_string(),
        bio: "a".repeat(MAX_BIO_LEN + 1), // Too long!
        avatar_url: "https://example.com/avatar.jpg".to_string(),
        updated_at: 1234567890,
    };
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),
        AccountMeta::new(profile_account, false),
    ];
    
    let serialized_data = borsh::to_vec(&profile_data).unwrap();
    let instruction = create_instruction(PROGRAM_ID, 2, accounts, serialized_data);
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    assert!(!result, "Should fail - bio too long");
}

#[test]
fn test_follow_user_success() {
    let (mut svm, payer) = setup_test();
    let target_user = Keypair::new();
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),        // follower
        AccountMeta::new(target_user.pubkey(), false), // target
    ];
    
    let instruction = create_instruction(PROGRAM_ID, 3, accounts, vec![]);
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    // Note: Current implementation is just a stub that checks signature
    assert!(result, "Follow user should succeed");
}

#[test]
fn test_follow_user_missing_signature() {
    let (mut svm, payer) = setup_test();
    let target_user = Keypair::new();
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), false), // Not a signer!
        AccountMeta::new(target_user.pubkey(), false),
    ];
    
    let fee_payer = Keypair::new();
    svm.airdrop(&fee_payer.pubkey(), 1_000_000_000).unwrap();

    let instruction = create_instruction(PROGRAM_ID, 3, accounts, vec![]);
    let result = execute_instruction_with_payer(&mut svm, &fee_payer, instruction);

    assert!(!result, "Should fail - missing signature");
}

#[test]
fn test_unfollow_user_success() {
    let (mut svm, payer) = setup_test();
    let target_user = Keypair::new();
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),        // follower
        AccountMeta::new(target_user.pubkey(), false), // target
    ];
    
    let instruction = create_instruction(PROGRAM_ID, 4, accounts, vec![]);
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    // Note: Current implementation is just a stub that checks signature
    assert!(result, "Unfollow user should succeed");
}

#[test]
fn test_unfollow_user_missing_signature() {
    let (mut svm, payer) = setup_test();
    let target_user = Keypair::new();
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), false), // Not a signer!
        AccountMeta::new(target_user.pubkey(), false),
    ];
    
    let fee_payer = Keypair::new();
    svm.airdrop(&fee_payer.pubkey(), 1_000_000_000).unwrap();

    let instruction = create_instruction(PROGRAM_ID, 4, accounts, vec![]);
    let result = execute_instruction_with_payer(&mut svm, &fee_payer, instruction);

    assert!(!result, "Should fail - missing signature");
}

#[test]
fn test_send_message_success() {
    let (mut svm, payer) = setup_test();
    let recipient = Keypair::new();
    
    let message_account = create_account(&mut svm, &payer, Message::size(), PROGRAM_ID);
    let content = "Hello, world!";
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),      // sender
        AccountMeta::new(recipient.pubkey(), false), // recipient
        AccountMeta::new(message_account, false),    // message_account
    ];
    
    let instruction = create_instruction(PROGRAM_ID, 5, accounts, content.as_bytes().to_vec());
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    assert!(result, "Send message should succeed");
    
    // Verify message was created
    let msg_data = svm.get_account(&message_account).unwrap().data;
    assert!(msg_data.starts_with(&Message::DISCRIMINATOR));
    
    let message: Message = deserialize_account_data(&msg_data);
    assert_eq!(message.content, content);
    assert_eq!(message.sender, addr_to_bytes(&payer.pubkey()));
    assert_eq!(message.recipient, addr_to_bytes(&recipient.pubkey()));
}

#[test]
fn test_send_message_too_long() {
    let (mut svm, payer) = setup_test();
    let recipient = Keypair::new();
    
    let message_account = create_account(&mut svm, &payer, Message::size(), PROGRAM_ID);
    let content = "a".repeat(MAX_MESSAGE_LEN + 1); // Too long!
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),
        AccountMeta::new(recipient.pubkey(), false),
        AccountMeta::new(message_account, false),
    ];
    
    let instruction = create_instruction(PROGRAM_ID, 5, accounts, content.as_bytes().to_vec());
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    assert!(!result, "Should fail - message too long");
}

#[test]
fn test_send_message_missing_signature() {
    let (mut svm, payer) = setup_test();
    let recipient = Keypair::new();
    
    let message_account = create_account(&mut svm, &payer, Message::size(), PROGRAM_ID);
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), false), // Not a signer!
        AccountMeta::new(recipient.pubkey(), false),
        AccountMeta::new(message_account, false),
    ];
    
    let fee_payer = Keypair::new();
    svm.airdrop(&fee_payer.pubkey(), 1_000_000_000).unwrap();

    let instruction = create_instruction(PROGRAM_ID, 5, accounts, b"Hello".to_vec());
    let result = execute_instruction_with_payer(&mut svm, &fee_payer, instruction);

    assert!(!result, "Should fail - missing signature");
}

#[test]
fn test_create_agent_success() {
    let (mut svm, payer) = setup_test();
    
    let agent_account = create_account(&mut svm, &payer, Agent::size(), PROGRAM_ID);
    
    let agent_data = CreateAgentData {
        name: "AI Assistant".to_string(),
        description: "A helpful AI assistant".to_string(),
        agent_type: AgentType::SocialAgent as u8,
        config: vec![1, 2, 3, 4],
        created_at: 1234567890,
    };
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),   // owner
        AccountMeta::new(agent_account, false),   // agent_account
    ];
    
    let serialized_data = borsh::to_vec(&agent_data).unwrap();
    let instruction = create_instruction(PROGRAM_ID, 6, accounts, serialized_data);
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    assert!(result, "Create agent should succeed");
    
    // Verify agent was created
    let agent_account_data = svm.get_account(&agent_account).unwrap().data;
    assert!(agent_account_data.starts_with(&Agent::DISCRIMINATOR));
    
    let agent: Agent = deserialize_account_data(&agent_account_data);
    assert_eq!(agent.name, "AI Assistant");
    assert_eq!(agent.description, "A helpful AI assistant");
    assert_eq!(agent.agent_type, AgentType::SocialAgent);
    assert_eq!(agent.config, vec![1, 2, 3, 4]);
    assert_eq!(agent.owner, addr_to_bytes(&payer.pubkey()));
    assert_eq!(agent.pubkey, addr_to_bytes(&agent_account));
    assert!(agent.is_active);
}

#[test]
fn test_create_agent_name_too_long() {
    let (mut svm, payer) = setup_test();
    
    let agent_account = create_account(&mut svm, &payer, Agent::size(), PROGRAM_ID);
    
    let agent_data = CreateAgentData {
        name: "a".repeat(MAX_AGENT_NAME_LEN + 1), // Too long!
        description: "Valid description".to_string(),
        agent_type: AgentType::SocialAgent as u8,
        config: vec![],
        created_at: 1234567890,
    };
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),
        AccountMeta::new(agent_account, false),
    ];
    
    let serialized_data = borsh::to_vec(&agent_data).unwrap();
    let instruction = create_instruction(PROGRAM_ID, 6, accounts, serialized_data);
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    assert!(!result, "Should fail - agent name too long");
}

#[test]
fn test_create_agent_description_too_long() {
    let (mut svm, payer) = setup_test();
    
    let agent_account = create_account(&mut svm, &payer, Agent::size(), PROGRAM_ID);
    
    let agent_data = CreateAgentData {
        name: "Valid Name".to_string(),
        description: "a".repeat(MAX_AGENT_DESCRIPTION_LEN + 1), // Too long!
        agent_type: AgentType::SocialAgent as u8,
        config: vec![],
        created_at: 1234567890,
    };
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),
        AccountMeta::new(agent_account, false),
    ];
    
    let serialized_data = borsh::to_vec(&agent_data).unwrap();
    let instruction = create_instruction(PROGRAM_ID, 6, accounts, serialized_data);
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    assert!(!result, "Should fail - description too long");
}

#[test]
fn test_create_agent_config_too_long() {
    let (mut svm, payer) = setup_test();
    
    let agent_account = create_account(&mut svm, &payer, Agent::size(), PROGRAM_ID);
    
    let agent_data = CreateAgentData {
        name: "Valid Name".to_string(),
        description: "Valid description".to_string(),
        agent_type: AgentType::SocialAgent as u8,
        config: vec![0u8; MAX_AGENT_CONFIG_LEN + 1], // Too long!
        created_at: 1234567890,
    };
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),
        AccountMeta::new(agent_account, false),
    ];
    
    let serialized_data = borsh::to_vec(&agent_data).unwrap();
    let instruction = create_instruction(PROGRAM_ID, 6, accounts, serialized_data);
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    assert!(!result, "Should fail - config too long");
}

#[test]
fn test_create_agent_missing_signature() {
    let (mut svm, payer) = setup_test();
    
    let agent_account = create_account(&mut svm, &payer, Agent::size(), PROGRAM_ID);
    
    let agent_data = CreateAgentData {
        name: "AI Assistant".to_string(),
        description: "A helpful AI assistant".to_string(),
        agent_type: AgentType::SocialAgent as u8,
        config: vec![],
        created_at: 1234567890,
    };
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), false), // Not a signer!
        AccountMeta::new(agent_account, false),
    ];

    let fee_payer = Keypair::new();
    svm.airdrop(&fee_payer.pubkey(), 1_000_000_000).unwrap();

    let serialized_data = borsh::to_vec(&agent_data).unwrap();
    let instruction = create_instruction(PROGRAM_ID, 6, accounts, serialized_data);
    let result = execute_instruction_with_payer(&mut svm, &fee_payer, instruction);

    assert!(!result, "Should fail - missing signature");
}

#[test]
fn test_update_agent_config_success() {
    let (mut svm, payer) = setup_test();
    
    let agent_account = create_account(&mut svm, &payer, Agent::size(), PROGRAM_ID);
    
    // First create an agent
    let create_data = CreateAgentData {
        name: "AI Assistant".to_string(),
        description: "Initial description".to_string(),
        agent_type: AgentType::SocialAgent as u8,
        config: vec![1, 2],
        created_at: 1234567890,
    };
    
    let create_accounts = vec![
        AccountMeta::new(payer.pubkey(), true),
        AccountMeta::new(agent_account, false),
    ];
    
    let create_instr = create_instruction(
        PROGRAM_ID, 
        6, 
        create_accounts, 
        borsh::to_vec(&create_data).unwrap()
    );
    assert!(execute_instruction(&mut svm, &payer, create_instr), "Create agent should succeed");
    
    // Now update the agent config
    let update_data = UpdateAgentConfigData {
        description: "Updated description".to_string(),
        config: vec![3, 4, 5],
        is_active: false,
        updated_at: 1234567900,
    };
    
    let update_accounts = vec![
        AccountMeta::new(payer.pubkey(), true),   // owner
        AccountMeta::new(agent_account, false),   // agent_account
    ];
    
    let update_instruction = create_instruction(
        PROGRAM_ID, 
        7, 
        update_accounts, 
        borsh::to_vec(&update_data).unwrap()
    );
    let result = execute_instruction(&mut svm, &payer, update_instruction);
    
    assert!(result, "Update agent config should succeed");
    
    // Verify agent was updated
    let agent_account_data = svm.get_account(&agent_account).unwrap().data;
    let agent: Agent = deserialize_account_data(&agent_account_data);
    assert_eq!(agent.description, "Updated description");
    assert_eq!(agent.config, vec![3, 4, 5]);
    assert!(!agent.is_active); // Should be inactive now
}

#[test]
fn test_update_agent_config_unauthorized() {
    let (mut svm, payer) = setup_test();
    let other_user = Keypair::new();
    svm.airdrop(&other_user.pubkey(), 10_000_000_000).unwrap();
    
    let agent_account = create_account(&mut svm, &payer, Agent::size(), PROGRAM_ID);
    
    // Create an agent owned by payer
    let create_data = CreateAgentData {
        name: "AI Assistant".to_string(),
        description: "Initial description".to_string(),
        agent_type: AgentType::SocialAgent as u8,
        config: vec![1, 2],
        created_at: 1234567890,
    };
    
    let create_accounts = vec![
        AccountMeta::new(payer.pubkey(), true),
        AccountMeta::new(agent_account, false),
    ];
    
    let create_instr = create_instruction(
        PROGRAM_ID, 
        6, 
        create_accounts, 
        borsh::to_vec(&create_data).unwrap()
    );
    assert!(execute_instruction(&mut svm, &payer, create_instr), "Create agent should succeed");
    
    // Try to update with other_user (not the owner)
    let update_data = UpdateAgentConfigData {
        description: "Malicious update".to_string(),
        config: vec![3, 4, 5],
        is_active: false,
        updated_at: 1234567900,
    };
    
    let update_accounts = vec![
        AccountMeta::new(other_user.pubkey(), true), // Wrong owner!
        AccountMeta::new(agent_account, false),
    ];
    
    let update_instruction = create_instruction(
        PROGRAM_ID, 
        7, 
        update_accounts, 
        borsh::to_vec(&update_data).unwrap()
    );
    let result = execute_instruction(&mut svm, &other_user, update_instruction);
    
    assert!(!result, "Should fail - unauthorized");
}

#[test]
fn test_update_reputation_success() {
    let (mut svm, payer) = setup_test();
    
    let agent_account = Keypair::new();
    let reputation_account = create_account(&mut svm, &payer, Reputation::size(), PROGRAM_ID);
    
    let reputation_data = UpdateReputationData {
        score_bps: 7500, // 75%
        won: true,
        updated_at: 1234567890,
    };
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),        // authority
        AccountMeta::new(agent_account.pubkey(), false), // agent_account
        AccountMeta::new(reputation_account, false),   // reputation_account
    ];
    
    let serialized_data = borsh::to_vec(&reputation_data).unwrap();
    let instruction = create_instruction(PROGRAM_ID, 8, accounts, serialized_data);
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    assert!(result, "Update reputation should succeed");
    
    // Verify reputation was created/updated
    let rep_data = svm.get_account(&reputation_account).unwrap().data;
    assert!(rep_data.starts_with(&Reputation::DISCRIMINATOR));
    
    let reputation: Reputation = deserialize_account_data(&rep_data);
    assert_eq!(reputation.agent, addr_to_bytes(&agent_account.pubkey()));
    assert_eq!(reputation.total_reviews, 1);
    assert_eq!(reputation.avg_score_bps, 7500);
    assert_eq!(reputation.completed, 1);
    assert_eq!(reputation.wins, 1);
    assert_eq!(reputation.win_rate_bps, 10000); // 100% win rate
}

#[test]
fn test_update_reputation_multiple_reviews() {
    let (mut svm, payer) = setup_test();
    
    let agent_account = Keypair::new();
    let reputation_account = create_account(&mut svm, &payer, Reputation::size(), PROGRAM_ID);
    
    // First review: 75%, won
    let reputation_data = UpdateReputationData {
        score_bps: 7500,
        won: true,
        updated_at: 1234567890,
    };
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),
        AccountMeta::new(agent_account.pubkey(), false),
        AccountMeta::new(reputation_account, false),
    ];
    
    let instruction = create_instruction(PROGRAM_ID, 8, accounts.clone(), borsh::to_vec(&reputation_data).unwrap());
    assert!(execute_instruction(&mut svm, &payer, instruction), "First reputation update should succeed");
    
    // Second review: 85%, lost
    let reputation_data2 = UpdateReputationData {
        score_bps: 8500,
        won: false,
        updated_at: 1234567900,
    };
    
    let instruction2 = create_instruction(PROGRAM_ID, 8, accounts, borsh::to_vec(&reputation_data2).unwrap());
    let result2 = execute_instruction(&mut svm, &payer, instruction2);
    assert!(result2, "Second reputation update should succeed");
    
    // Verify aggregated reputation
    let rep_data = svm.get_account(&reputation_account).unwrap().data;
    let reputation: Reputation = deserialize_account_data(&rep_data);
    
    assert_eq!(reputation.total_reviews, 2);
    assert_eq!(reputation.avg_score_bps, 8000); // (7500 + 8500) / 2 = 8000
    assert_eq!(reputation.completed, 2);
    assert_eq!(reputation.wins, 1);
    assert_eq!(reputation.win_rate_bps, 5000); // 50% win rate (1/2)
}

#[test]
fn test_update_reputation_invalid_score() {
    let (mut svm, payer) = setup_test();
    
    let agent_account = Keypair::new();
    let reputation_account = create_account(&mut svm, &payer, Reputation::size(), PROGRAM_ID);
    
    let reputation_data = UpdateReputationData {
        score_bps: MAX_REPUTATION_SCORE_BPS + 1, // Too high!
        won: true,
        updated_at: 1234567890,
    };
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),
        AccountMeta::new(agent_account.pubkey(), false),
        AccountMeta::new(reputation_account, false),
    ];
    
    let serialized_data = borsh::to_vec(&reputation_data).unwrap();
    let instruction = create_instruction(PROGRAM_ID, 8, accounts, serialized_data);
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    assert!(!result, "Should fail - invalid reputation score");
}

#[test]
fn test_update_reputation_missing_signature() {
    let (mut svm, payer) = setup_test();
    
    let agent_account = Keypair::new();
    let reputation_account = create_account(&mut svm, &payer, Reputation::size(), PROGRAM_ID);
    
    let reputation_data = UpdateReputationData {
        score_bps: 7500,
        won: true,
        updated_at: 1234567890,
    };
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), false), // Not a signer!
        AccountMeta::new(agent_account.pubkey(), false),
        AccountMeta::new(reputation_account, false),
    ];

    let fee_payer = Keypair::new();
    svm.airdrop(&fee_payer.pubkey(), 1_000_000_000).unwrap();

    let serialized_data = borsh::to_vec(&reputation_data).unwrap();
    let instruction = create_instruction(PROGRAM_ID, 8, accounts, serialized_data);
    let result = execute_instruction_with_payer(&mut svm, &fee_payer, instruction);

    assert!(!result, "Should fail - missing signature");
}

#[test]
fn test_invalid_instruction_discriminator() {
    let (mut svm, payer) = setup_test();
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),
    ];
    
    // Use invalid discriminator (9)
    let instruction = create_instruction(PROGRAM_ID, 9, accounts, vec![]);
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    assert!(!result, "Should fail - invalid instruction discriminator");
}

#[test]
fn test_empty_instruction_data() {
    let (mut svm, payer) = setup_test();
    
    let accounts = vec![
        AccountMeta::new(payer.pubkey(), true),
    ];
    
    // Create instruction with empty data (no discriminator)
    let instruction = Instruction {
        program_id: PROGRAM_ID,
        accounts,
        data: vec![], // Empty!
    };
    
    let result = execute_instruction(&mut svm, &payer, instruction);
    
    assert!(!result, "Should fail - empty instruction data");
}