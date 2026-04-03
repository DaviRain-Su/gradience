use chain_hub::{
    errors::ChainHubError,
    instructions::{RegisterProtocolData, SetSkillStatusData, UpdateProtocolStatusData},
    state::{
        ProtocolEntry, ProtocolRegistry, ProtocolStatus, SkillEntry, SkillRegistry, SkillStatus,
        PROTOCOL_ENTRY_DISCRIMINATOR, PROTOCOL_REGISTRY_DISCRIMINATOR, SKILL_ENTRY_DISCRIMINATOR,
        SKILL_REGISTRY_DISCRIMINATOR,
    },
};
use solana_sdk::{
    instruction::InstructionError,
    instruction::{AccountMeta, Instruction},
    signature::Signer,
    transaction::TransactionError,
};
use solana_system_interface::program::ID as SYSTEM_PROGRAM_ID;

use crate::utils::{
    chain_hub::{
        decode_padded, derive_config_pda, derive_protocol_pda, derive_protocol_registry_pda,
        derive_skill_pda, derive_skill_registry_pda, encode_ix, initialize, register_skill,
    },
    setup::{chain_hub_program_id, TestContext},
};

#[test]
fn test_skill_status_lifecycle_updates_registry_counters() {
    let mut ctx = TestContext::new();
    initialize(&mut ctx, solana_sdk::pubkey::Pubkey::new_unique());
    register_skill(&mut ctx, 1, 2);

    let skill_registry_before = ctx
        .get_account(&derive_skill_registry_pda())
        .expect("skill registry");
    let registry: SkillRegistry =
        decode_padded(&skill_registry_before.data, SKILL_REGISTRY_DISCRIMINATOR);
    assert_eq!(registry.total_registered, 1);
    assert_eq!(registry.total_active, 1);

    let pause_ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(ctx.payer.pubkey(), true),
            AccountMeta::new(derive_config_pda(), false),
            AccountMeta::new(derive_skill_registry_pda(), false),
            AccountMeta::new(derive_skill_pda(1), false),
        ],
        data: encode_ix(
            2,
            &SetSkillStatusData {
                skill_id: 1,
                status: 1,
            },
        ),
    };
    ctx.send_instruction(pause_ix, &[]).unwrap();

    let skill_account = ctx.get_account(&derive_skill_pda(1)).expect("skill");
    let skill: SkillEntry = decode_padded(&skill_account.data, SKILL_ENTRY_DISCRIMINATOR);
    assert_eq!(skill.status, SkillStatus::Paused);

    let skill_registry_after = ctx
        .get_account(&derive_skill_registry_pda())
        .expect("skill registry");
    let registry_after: SkillRegistry =
        decode_padded(&skill_registry_after.data, SKILL_REGISTRY_DISCRIMINATOR);
    assert_eq!(registry_after.total_active, 0);
}

#[test]
fn test_protocol_register_and_pause() {
    let mut ctx = TestContext::new();
    initialize(&mut ctx, solana_sdk::pubkey::Pubkey::new_unique());

    let register_ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(ctx.payer.pubkey(), true),
            AccountMeta::new(derive_config_pda(), false),
            AccountMeta::new(derive_protocol_registry_pda(), false),
            AccountMeta::new(derive_protocol_pda("orca-whirlpool"), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: encode_ix(
            3,
            &RegisterProtocolData {
                protocol_id: "orca-whirlpool".to_string(),
                protocol_type: 1,
                trust_model: 2,
                auth_mode: 0,
                capabilities_mask: 0b111,
                endpoint: "".to_string(),
                docs_uri: "https://docs.orca.so".to_string(),
                program_id: solana_sdk::pubkey::Pubkey::new_unique().to_bytes(),
                idl_ref: "ipfs://idl/orca".to_string(),
            },
        ),
    };
    ctx.send_instruction(register_ix, &[]).unwrap();

    let protocol_account = ctx
        .get_account(&derive_protocol_pda("orca-whirlpool"))
        .expect("protocol account");
    let protocol: ProtocolEntry =
        decode_padded(&protocol_account.data, PROTOCOL_ENTRY_DISCRIMINATOR);
    assert_eq!(protocol.protocol_id, "orca-whirlpool");
    assert_eq!(protocol.status, ProtocolStatus::Active);

    let pause_ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(ctx.payer.pubkey(), true),
            AccountMeta::new(derive_config_pda(), false),
            AccountMeta::new(derive_protocol_registry_pda(), false),
            AccountMeta::new(derive_protocol_pda("orca-whirlpool"), false),
        ],
        data: encode_ix(
            4,
            &UpdateProtocolStatusData {
                protocol_id: "orca-whirlpool".to_string(),
                status: 1,
            },
        ),
    };
    ctx.send_instruction(pause_ix, &[]).unwrap();

    let protocol_registry_account = ctx
        .get_account(&derive_protocol_registry_pda())
        .expect("protocol registry");
    let registry: ProtocolRegistry =
        decode_padded(&protocol_registry_account.data, PROTOCOL_REGISTRY_DISCRIMINATOR);
    assert_eq!(registry.total_registered, 1);
    assert_eq!(registry.total_active, 0);
}

#[test]
fn test_protocol_register_rejects_zero_capability_mask() {
    let mut ctx = TestContext::new();
    initialize(&mut ctx, solana_sdk::pubkey::Pubkey::new_unique());

    let invalid_ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(ctx.payer.pubkey(), true),
            AccountMeta::new(derive_config_pda(), false),
            AccountMeta::new(derive_protocol_registry_pda(), false),
            AccountMeta::new(derive_protocol_pda("invalid-mask"), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: encode_ix(
            3,
            &RegisterProtocolData {
                protocol_id: "invalid-mask".to_string(),
                protocol_type: 0,
                trust_model: 0,
                auth_mode: 0,
                capabilities_mask: 0,
                endpoint: "https://api.invalid.dev/v1".to_string(),
                docs_uri: "https://docs.invalid.dev".to_string(),
                program_id: [0u8; 32],
                idl_ref: "".to_string(),
            },
        ),
    };

    let err = ctx.send_instruction(invalid_ix, &[]).unwrap_err();
    assert!(matches!(
        err,
        TransactionError::InstructionError(_, InstructionError::Custom(code))
            if code == ChainHubError::InvalidCapabilityMask as u32
    ));
}

#[test]
fn test_protocol_register_rest_requires_endpoint() {
    let mut ctx = TestContext::new();
    initialize(&mut ctx, solana_sdk::pubkey::Pubkey::new_unique());

    let invalid_ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(ctx.payer.pubkey(), true),
            AccountMeta::new(derive_config_pda(), false),
            AccountMeta::new(derive_protocol_registry_pda(), false),
            AccountMeta::new(derive_protocol_pda("missing-endpoint"), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: encode_ix(
            3,
            &RegisterProtocolData {
                protocol_id: "missing-endpoint".to_string(),
                protocol_type: 0,
                trust_model: 0,
                auth_mode: 0,
                capabilities_mask: 0b1,
                endpoint: "".to_string(),
                docs_uri: "https://docs.invalid.dev".to_string(),
                program_id: [0u8; 32],
                idl_ref: "".to_string(),
            },
        ),
    };

    let err = ctx.send_instruction(invalid_ix, &[]).unwrap_err();
    assert!(matches!(
        err,
        TransactionError::InstructionError(_, InstructionError::Custom(code))
            if code == ChainHubError::InvalidProtocolEndpoint as u32
    ));
}
