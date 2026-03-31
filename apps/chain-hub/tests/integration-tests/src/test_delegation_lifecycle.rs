use chain_hub::{
    errors::ChainHubError,
    instructions::{
        ActivateDelegationTaskData, CancelDelegationTaskData, DelegationTaskData,
        RecordDelegationExecutionData,
    },
    state::{DelegationTaskAccount, DelegationTaskStatus, DELEGATION_TASK_DISCRIMINATOR},
};
use solana_sdk::{
    instruction::InstructionError,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::TransactionError,
};
use solana_system_interface::program::ID as SYSTEM_PROGRAM_ID;

use crate::utils::{
    chain_hub::{
        decode_padded, derive_config_pda, derive_protocol_pda, derive_skill_pda, derive_task_pda,
        encode_ix, initialize, register_protocol, register_skill,
    },
    setup::{chain_hub_program_id, TestContext},
};

fn create_delegation_ix(
    requester: Pubkey,
    task_id: u64,
    skill_id: u64,
    protocol_id: &str,
    judge_category: u8,
    selected_agent: Pubkey,
    selected_judge: Pubkey,
    max_executions: u32,
    expires_at: i64,
) -> Instruction {
    Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(requester, true),
            AccountMeta::new(derive_config_pda(), false),
            AccountMeta::new_readonly(derive_skill_pda(skill_id), false),
            AccountMeta::new_readonly(derive_protocol_pda(protocol_id), false),
            AccountMeta::new(derive_task_pda(task_id), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: encode_ix(
            5,
            &DelegationTaskData {
                skill_id,
                protocol_id: protocol_id.to_string(),
                judge_category,
                selected_agent_authority: selected_agent.to_bytes(),
                selected_judge_authority: selected_judge.to_bytes(),
                max_executions,
                expires_at,
                policy_hash: [7u8; 32],
            },
        ),
    }
}

#[test]
fn test_delegation_full_lifecycle_to_completed() {
    let mut ctx = TestContext::new();
    let agent_layer_program = Pubkey::new_unique();
    initialize(&mut ctx, agent_layer_program);
    register_skill(&mut ctx, 1, 2);
    register_protocol(&mut ctx, "sdp");

    let agent = Keypair::new();
    let judge = Keypair::new();
    ctx.svm.airdrop(&agent.pubkey(), 1_000_000_000).unwrap();
    ctx.svm.airdrop(&judge.pubkey(), 1_000_000_000).unwrap();

    let now = ctx.get_current_timestamp();
    let create_ix = create_delegation_ix(
        ctx.payer.pubkey(),
        1,
        1,
        "sdp",
        2,
        agent.pubkey(),
        judge.pubkey(),
        1,
        now + 3_600,
    );
    ctx.send_instruction(create_ix, &[]).unwrap();

    let task_account = ctx.get_account(&derive_task_pda(1)).expect("task exists");
    let task: DelegationTaskAccount = decode_padded(&task_account.data, DELEGATION_TASK_DISCRIMINATOR);
    assert_eq!(task.status, DelegationTaskStatus::Created);
    assert_eq!(task.executed_count, 0);
    let expected_judge_pool =
        Pubkey::find_program_address(&[b"judge_pool", &[2]], &agent_layer_program).0;
    assert_eq!(task.judge_pool, expected_judge_pool.to_bytes());

    let activate_ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(ctx.payer.pubkey(), true),
            AccountMeta::new(derive_task_pda(1), false),
        ],
        data: encode_ix(6, &ActivateDelegationTaskData { task_id: 1 }),
    };
    ctx.send_instruction(activate_ix, &[]).unwrap();

    let record_ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(agent.pubkey(), true),
            AccountMeta::new(derive_task_pda(1), false),
        ],
        data: encode_ix(
            7,
            &RecordDelegationExecutionData {
                task_id: 1,
                execution_ref_hash: [9u8; 32],
            },
        ),
    };
    ctx.send_instruction(record_ix, &[&agent]).unwrap();

    let task_after = ctx.get_account(&derive_task_pda(1)).expect("task exists");
    let task_after: DelegationTaskAccount =
        decode_padded(&task_after.data, DELEGATION_TASK_DISCRIMINATOR);
    assert_eq!(task_after.executed_count, 1);
    assert_eq!(task_after.status, DelegationTaskStatus::Completed);
}

#[test]
fn test_delegation_unauthorized_and_expired_paths() {
    let mut ctx = TestContext::new();
    initialize(&mut ctx, Pubkey::new_unique());
    register_skill(&mut ctx, 1, 2);
    register_protocol(&mut ctx, "sdp");

    let agent = Keypair::new();
    let judge = Keypair::new();
    let attacker = Keypair::new();
    ctx.svm.airdrop(&agent.pubkey(), 1_000_000_000).unwrap();
    ctx.svm.airdrop(&judge.pubkey(), 1_000_000_000).unwrap();
    ctx.svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    let now = ctx.get_current_timestamp();
    let create_ix = create_delegation_ix(
        ctx.payer.pubkey(),
        1,
        1,
        "sdp",
        2,
        agent.pubkey(),
        judge.pubkey(),
        2,
        now + 100,
    );
    ctx.send_instruction(create_ix, &[]).unwrap();

    let activate_ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(ctx.payer.pubkey(), true),
            AccountMeta::new(derive_task_pda(1), false),
        ],
        data: encode_ix(6, &ActivateDelegationTaskData { task_id: 1 }),
    };
    ctx.send_instruction(activate_ix, &[]).unwrap();

    let unauthorized_record_ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(attacker.pubkey(), true),
            AccountMeta::new(derive_task_pda(1), false),
        ],
        data: encode_ix(
            7,
            &RecordDelegationExecutionData {
                task_id: 1,
                execution_ref_hash: [1u8; 32],
            },
        ),
    };
    let unauthorized_err = ctx
        .send_instruction(unauthorized_record_ix, &[&attacker])
        .unwrap_err();
    assert!(matches!(
        unauthorized_err,
        TransactionError::InstructionError(_, InstructionError::Custom(code))
            if code == ChainHubError::UnauthorizedAgent as u32
    ));

    ctx.warp_to_timestamp(now + 1_000);
    let expired_record_ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(agent.pubkey(), true),
            AccountMeta::new(derive_task_pda(1), false),
        ],
        data: encode_ix(
            7,
            &RecordDelegationExecutionData {
                task_id: 1,
                execution_ref_hash: [2u8; 32],
            },
        ),
    };
    let expired_err = ctx.send_instruction(expired_record_ix, &[&agent]).unwrap_err();
    assert!(matches!(
        expired_err,
        TransactionError::InstructionError(_, InstructionError::Custom(code))
            if code == ChainHubError::DelegationExpired as u32
    ));

    let task_after = ctx.get_account(&derive_task_pda(1)).expect("task exists");
    let task_after: DelegationTaskAccount =
        decode_padded(&task_after.data, DELEGATION_TASK_DISCRIMINATOR);
    assert_eq!(task_after.status, DelegationTaskStatus::Active);

    let create_ix_2 = create_delegation_ix(
        ctx.payer.pubkey(),
        2,
        1,
        "sdp",
        2,
        agent.pubkey(),
        judge.pubkey(),
        2,
        ctx.get_current_timestamp() + 600,
    );
    ctx.send_instruction(create_ix_2, &[]).unwrap();

    let cancel_ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(ctx.payer.pubkey(), true),
            AccountMeta::new(derive_task_pda(2), false),
        ],
        data: encode_ix(9, &CancelDelegationTaskData { task_id: 2 }),
    };
    ctx.send_instruction(cancel_ix, &[]).unwrap();
    let cancelled = ctx.get_account(&derive_task_pda(2)).expect("task exists");
    let cancelled: DelegationTaskAccount =
        decode_padded(&cancelled.data, DELEGATION_TASK_DISCRIMINATOR);
    assert_eq!(cancelled.status, DelegationTaskStatus::Cancelled);
}
