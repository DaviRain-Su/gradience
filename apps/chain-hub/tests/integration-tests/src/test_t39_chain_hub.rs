use borsh::{BorshDeserialize, BorshSerialize};
use chain_hub::{
    errors::ChainHubError,
    instructions::{DelegationTaskData, InitializeData, RegisterSkillData},
    state::{
        DelegationTaskAccount, ProgramConfig, SkillEntry, SkillRegistry,
        DELEGATION_TASK_DISCRIMINATOR, PROGRAM_CONFIG_DISCRIMINATOR, SKILL_ENTRY_DISCRIMINATOR,
        SKILL_REGISTRY_DISCRIMINATOR,
    },
};
use solana_sdk::{
    instruction::InstructionError,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::Signer,
    transaction::TransactionError,
};
use solana_system_interface::program::ID as SYSTEM_PROGRAM_ID;

use crate::utils::setup::{chain_hub_program_id, TestContext};

fn encode_ix<T: BorshSerialize>(discriminator: u8, data: &T) -> Vec<u8> {
    let mut encoded = vec![discriminator];
    encoded.extend(borsh::to_vec(data).expect("serialize instruction"));
    encoded
}

fn decode_padded<T: BorshDeserialize>(data: &[u8], discriminator: u8) -> T {
    assert_eq!(data[0], discriminator);
    let mut payload = &data[2..];
    T::deserialize(&mut payload).expect("deserialize account")
}

fn derive_config_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"config"], &chain_hub_program_id()).0
}

fn derive_skill_registry_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"skill_registry"], &chain_hub_program_id()).0
}

fn derive_skill_pda(skill_id: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[b"skill", &skill_id.to_le_bytes()],
        &chain_hub_program_id(),
    )
    .0
}

fn derive_task_pda(task_id: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[b"delegation_task", &task_id.to_le_bytes()],
        &chain_hub_program_id(),
    )
    .0
}

fn bootstrap_skill(ctx: &mut TestContext, agent_layer_program: Pubkey) {
    let config_pda = derive_config_pda();
    let skill_registry_pda = derive_skill_registry_pda();

    let initialize_ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(ctx.payer.pubkey(), true),
            AccountMeta::new(config_pda, false),
            AccountMeta::new(skill_registry_pda, false),
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
    ctx.send_instruction(initialize_ix, &[]).unwrap();

    let register_skill_ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(ctx.payer.pubkey(), true),
            AccountMeta::new(config_pda, false),
            AccountMeta::new(skill_registry_pda, false),
            AccountMeta::new(derive_skill_pda(1), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: encode_ix(
            1,
            &RegisterSkillData {
                judge_category: 2,
                name: "code-review".to_string(),
                metadata_uri: "ipfs://skill/code-review/v1".to_string(),
            },
        ),
    };
    ctx.send_instruction(register_skill_ix, &[]).unwrap();
}

#[test]
fn test_t39_delegation_task_callable_and_pda_shape() {
    let mut ctx = TestContext::new();
    let agent_layer_program = Pubkey::new_unique();
    bootstrap_skill(&mut ctx, agent_layer_program);

    let config_pda = derive_config_pda();
    let skill_pda = derive_skill_pda(1);
    let delegation_task_pda = derive_task_pda(1);

    let selected_agent = Pubkey::new_unique();
    let selected_judge = Pubkey::new_unique();

    let delegation_ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(ctx.payer.pubkey(), true),
            AccountMeta::new(config_pda, false),
            AccountMeta::new_readonly(skill_pda, false),
            AccountMeta::new(delegation_task_pda, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: encode_ix(
            2,
            &DelegationTaskData {
                skill_id: 1,
                judge_category: 2,
                selected_agent_authority: selected_agent.to_bytes(),
                selected_judge_authority: selected_judge.to_bytes(),
            },
        ),
    };

    ctx.send_instruction(delegation_ix, &[]).unwrap();

    let config_account = ctx.get_account(&config_pda).expect("config account exists");
    let config: ProgramConfig = decode_padded(&config_account.data, PROGRAM_CONFIG_DISCRIMINATOR);
    assert_eq!(config.skill_count, 1);
    assert_eq!(config.delegation_task_count, 1);

    let skill_registry_account = ctx
        .get_account(&derive_skill_registry_pda())
        .expect("registry account exists");
    let registry: SkillRegistry =
        decode_padded(&skill_registry_account.data, SKILL_REGISTRY_DISCRIMINATOR);
    assert_eq!(registry.total_registered, 1);

    let skill_account = ctx.get_account(&skill_pda).expect("skill exists");
    let skill: SkillEntry = decode_padded(&skill_account.data, SKILL_ENTRY_DISCRIMINATOR);
    assert_eq!(skill.skill_id, 1);
    assert_eq!(skill.name, "code-review");
    assert_eq!(skill.judge_category, 2);

    let task_account = ctx
        .get_account(&delegation_task_pda)
        .expect("delegation task account exists");
    let task: DelegationTaskAccount =
        decode_padded(&task_account.data, DELEGATION_TASK_DISCRIMINATOR);
    assert_eq!(task.task_id, 1);
    assert_eq!(task.skill, skill_pda.to_bytes());
    assert_eq!(task.selected_agent_authority, selected_agent.to_bytes());
    assert_eq!(task.selected_judge_authority, selected_judge.to_bytes());
    assert_eq!(task.judge_category, 2);

    let expected_judge_pool =
        Pubkey::find_program_address(&[b"judge_pool", &[2]], &agent_layer_program).0;
    assert_eq!(task.judge_pool, expected_judge_pool.to_bytes());
}

#[test]
fn test_t39_delegation_task_rejects_zero_authority() {
    let mut ctx = TestContext::new();
    bootstrap_skill(&mut ctx, Pubkey::new_unique());

    let delegation_ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(ctx.payer.pubkey(), true),
            AccountMeta::new(derive_config_pda(), false),
            AccountMeta::new_readonly(derive_skill_pda(1), false),
            AccountMeta::new(derive_task_pda(1), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: encode_ix(
            2,
            &DelegationTaskData {
                skill_id: 1,
                judge_category: 2,
                selected_agent_authority: [0u8; 32],
                selected_judge_authority: Pubkey::new_unique().to_bytes(),
            },
        ),
    };

    let err = ctx.send_instruction(delegation_ix, &[]).unwrap_err();
    assert!(matches!(
        err,
        TransactionError::InstructionError(_, InstructionError::Custom(code))
            if code == ChainHubError::ZeroAuthority as u32
    ));
}
