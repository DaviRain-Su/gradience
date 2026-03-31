use borsh::{BorshDeserialize, BorshSerialize};
use chain_hub::instructions::{InitializeData, RegisterProtocolData, RegisterSkillData};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::Signer,
};
use solana_system_interface::program::ID as SYSTEM_PROGRAM_ID;

use crate::utils::setup::{chain_hub_program_id, TestContext};

pub fn encode_ix<T: BorshSerialize>(discriminator: u8, data: &T) -> Vec<u8> {
    let mut encoded = vec![discriminator];
    encoded.extend(borsh::to_vec(data).expect("serialize ix"));
    encoded
}

pub fn decode_padded<T: BorshDeserialize>(data: &[u8], discriminator: u8) -> T {
    assert_eq!(data[0], discriminator);
    let mut payload = &data[2..];
    T::deserialize(&mut payload).expect("decode account")
}

pub fn derive_config_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"config"], &chain_hub_program_id()).0
}

pub fn derive_skill_registry_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"skill_registry"], &chain_hub_program_id()).0
}

pub fn derive_protocol_registry_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"protocol_registry"], &chain_hub_program_id()).0
}

pub fn derive_skill_pda(skill_id: u64) -> Pubkey {
    Pubkey::find_program_address(&[b"skill", &skill_id.to_le_bytes()], &chain_hub_program_id()).0
}

pub fn derive_protocol_pda(protocol_id: &str) -> Pubkey {
    Pubkey::find_program_address(&[b"protocol", protocol_id.as_bytes()], &chain_hub_program_id()).0
}

pub fn derive_task_pda(task_id: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[b"delegation_task", &task_id.to_le_bytes()],
        &chain_hub_program_id(),
    )
    .0
}

pub fn initialize(ctx: &mut TestContext, agent_layer_program: Pubkey) {
    let ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(ctx.payer.pubkey(), true),
            AccountMeta::new(derive_config_pda(), false),
            AccountMeta::new(derive_skill_registry_pda(), false),
            AccountMeta::new(derive_protocol_registry_pda(), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: encode_ix(
            0,
            &InitializeData {
                upgrade_authority: ctx.payer.pubkey().to_bytes(),
                agent_layer_program: agent_layer_program.to_bytes(),
            },
        ),
    };
    ctx.send_instruction(ix, &[]).unwrap();
}

pub fn register_skill(ctx: &mut TestContext, skill_id: u64, judge_category: u8) {
    let ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(ctx.payer.pubkey(), true),
            AccountMeta::new(derive_config_pda(), false),
            AccountMeta::new(derive_skill_registry_pda(), false),
            AccountMeta::new(derive_skill_pda(skill_id), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: encode_ix(
            1,
            &RegisterSkillData {
                judge_category,
                name: "strategy-skill".to_string(),
                metadata_uri: "ipfs://skill/strategy/v1".to_string(),
            },
        ),
    };
    ctx.send_instruction(ix, &[]).unwrap();
}

pub fn register_protocol(ctx: &mut TestContext, protocol_id: &str) {
    let ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(ctx.payer.pubkey(), true),
            AccountMeta::new(derive_config_pda(), false),
            AccountMeta::new(derive_protocol_registry_pda(), false),
            AccountMeta::new(derive_protocol_pda(protocol_id), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: encode_ix(
            3,
            &RegisterProtocolData {
                protocol_id: protocol_id.to_string(),
                protocol_type: 0,
                trust_model: 0,
                auth_mode: 1,
                capabilities_mask: 0b11,
                endpoint: "https://api.protocol.dev/v1".to_string(),
                docs_uri: "https://docs.protocol.dev".to_string(),
                program_id: [0u8; 32],
                idl_ref: "".to_string(),
            },
        ),
    };
    ctx.send_instruction(ix, &[]).unwrap();
}
