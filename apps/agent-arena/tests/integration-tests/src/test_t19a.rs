use gradience::{
    constants::MAX_CATEGORIES,
    events::EVENT_IX_TAG_LE,
    state::{JudgeMode, TaskState},
};
use gradience_client::{
    errors::GradienceError,
    instructions::{InitializeBuilder, PostTaskBuilder},
    GRADIENCE_ID,
};
use litesvm::types::TransactionMetadata;
use solana_sdk::{instruction::InstructionError, signature::Signer};

use crate::{
    fixtures::{initialize_program, post_task_sol, register_judge, strip_optional_tail_pub},
    utils::{
        assert_instruction_error, find_escrow_pda, find_judge_pool_pda, find_task_pda,
        get_escrow, get_judge_pool, get_program_config, get_task, TestContext,
    },
};

const EVENT_TASK_CREATED: u8 = 1;

#[test]
fn t19a_s1_initialize_bootstraps_core_state() {
    let mut ctx = TestContext::new();
    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);

    let config = get_program_config(&ctx, &core.config);
    assert_eq!(config.task_count, 0);
    assert_eq!(config.min_judge_stake, 1_000_000_000);
    assert_eq!(config.upgrade_authority, payer.to_bytes());
    assert_eq!(config.treasury, core.treasury.to_bytes());
    assert!(
        ctx.get_account(&core.treasury).is_some(),
        "treasury PDA must exist after initialize",
    );
    assert!(
        ctx.get_account(&core.event_authority).is_none(),
        "event_authority is PDA signer and should not require backing account",
    );
}

#[test]
fn t19a_s1b_reinitialize_should_fail() {
    let mut ctx = TestContext::new();
    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);

    // Attempt to initialize again with different params — should fail with AccountAlreadyInitialized
    let ix = InitializeBuilder::new()
        .payer(payer)
        .config(core.config)
        .treasury(core.treasury)
        .upgrade_authority(*payer.as_array())
        .min_judge_stake(2_000_000_000)
        .instruction();

    let err = ctx.send_transaction_expect_error(ix, &[]);
    assert_instruction_error(err, InstructionError::AccountAlreadyInitialized);
}

#[test]
fn t19a_s2_post_task_designated_persists_expected_fields() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);

    let now = ctx.get_current_timestamp();
    let task_id = post_task_sol(
        &mut ctx,
        &poster,
        &core,
        0,
        judge.pubkey().to_bytes(),
        2,
        9_999,
        42_000,
        now + 120,
        now + 360,
    );
    let (task_pda, _) = find_task_pda(task_id);
    let (escrow_pda, _) = find_escrow_pda(task_id);
    let task = get_task(&ctx, &task_pda);
    let escrow = get_escrow(&ctx, &escrow_pda);

    assert_eq!(task.task_id, task_id);
    assert_eq!(task.poster, poster.pubkey().to_bytes());
    assert_eq!(task.judge, judge.pubkey().to_bytes());
    assert_eq!(task.judge_mode, JudgeMode::Designated);
    assert_eq!(task.state, TaskState::Open);
    assert_eq!(task.category, 2);
    assert_eq!(task.min_stake, 9_999);
    assert_eq!(task.reward, 42_000);
    assert_eq!(task.submission_count, 0);
    assert_eq!(escrow.amount, 42_000);
}

#[test]
fn t19a_s3_post_task_pool_selects_registered_judge() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge_a = ctx.create_funded_keypair();
    let judge_b = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);
    register_judge(
        &mut ctx,
        &judge_a,
        core.config,
        core.event_authority,
        vec![0],
        2_000_000_000,
    );
    register_judge(
        &mut ctx,
        &judge_b,
        core.config,
        core.event_authority,
        vec![0],
        2_000_000_000,
    );

    let now = ctx.get_current_timestamp();
    let task_id = post_task_sol(
        &mut ctx,
        &poster,
        &core,
        1,
        [0u8; 32],
        0,
        1_000,
        12_000,
        now + 60,
        now + 180,
    );
    let (task_pda, _) = find_task_pda(task_id);
    let pooled_task = get_task(&ctx, &task_pda);

    assert_eq!(pooled_task.judge_mode, JudgeMode::Pool);
    assert!(
        pooled_task.judge == judge_a.pubkey().to_bytes()
            || pooled_task.judge == judge_b.pubkey().to_bytes(),
        "pooled judge must be selected from registered category judges",
    );

    let (pool_pda, _) = find_judge_pool_pda(0);
    let pool = get_judge_pool(&ctx, &pool_pda);
    assert_eq!(pool.entries.len(), 2);
    assert!(pool.total_weight > 0, "judge pool total weight must be positive");
}

#[test]
fn t19a_s4_post_task_boundary_acceptance_and_rejections() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);

    let now = ctx.get_current_timestamp();
    let max_category_task = post_task_sol(
        &mut ctx,
        &poster,
        &core,
        0,
        judge.pubkey().to_bytes(),
        (MAX_CATEGORIES as u8) - 1,
        0,
        1,
        now + 1,
        now + 2,
    );
    let (task_pda, _) = find_task_pda(max_category_task);
    let task = get_task(&ctx, &task_pda);
    assert_eq!(task.category, (MAX_CATEGORIES as u8) - 1);
    assert_eq!(task.reward, 1);
    assert_eq!(task.deadline, now + 1);
    assert_eq!(task.judge_deadline, now + 2);

    let config = get_program_config(&ctx, &core.config);
    let invalid_task_id = config.task_count;
    let (task_pda, _) = find_task_pda(invalid_task_id);
    let (escrow_pda, _) = find_escrow_pda(invalid_task_id);
    let (judge_pool_pda, _) = find_judge_pool_pda(MAX_CATEGORIES as u8);
    let invalid_category_ix = PostTaskBuilder::new()
        .poster(poster.pubkey())
        .config(core.config)
        .task(task_pda)
        .escrow(escrow_pda)
        .judge_pool(judge_pool_pda)
        .event_authority(core.event_authority)
        .gradience_program(GRADIENCE_ID)
        .eval_ref("ar://invalid-category".into())
        .deadline(now + 10)
        .judge_deadline(now + 20)
        .judge_mode(0)
        .judge(judge.pubkey().to_bytes())
        .category(MAX_CATEGORIES as u8)
        .mint([0u8; 32])
        .min_stake(1_000)
        .reward(1_000)
        .instruction();
    let invalid_category_ix = strip_optional_tail_pub(invalid_category_ix, 8, 5);
    let err = ctx.send_transaction_expect_error(invalid_category_ix, &[&poster]);
    assert_instruction_error(err, InstructionError::Custom(GradienceError::InvalidCategory as u32));

    let config = get_program_config(&ctx, &core.config);
    let invalid_deadline_task_id = config.task_count;
    let (task_pda, _) = find_task_pda(invalid_deadline_task_id);
    let (escrow_pda, _) = find_escrow_pda(invalid_deadline_task_id);
    let (judge_pool_pda, _) = find_judge_pool_pda(0);
    let invalid_deadline_ix = PostTaskBuilder::new()
        .poster(poster.pubkey())
        .config(core.config)
        .task(task_pda)
        .escrow(escrow_pda)
        .judge_pool(judge_pool_pda)
        .event_authority(core.event_authority)
        .gradience_program(GRADIENCE_ID)
        .eval_ref("ar://invalid-deadline".into())
        .deadline(now + 100)
        .judge_deadline(now + 100)
        .judge_mode(0)
        .judge(judge.pubkey().to_bytes())
        .category(0)
        .mint([0u8; 32])
        .min_stake(1_000)
        .reward(1_000)
        .instruction();
    let invalid_deadline_ix = strip_optional_tail_pub(invalid_deadline_ix, 8, 5);
    let err = ctx.send_transaction_expect_error(invalid_deadline_ix, &[&poster]);
    assert_instruction_error(
        err,
        InstructionError::Custom(GradienceError::InvalidJudgeDeadline as u32),
    );
}

#[test]
fn t19a_s5_post_task_emits_event_and_increments_counter() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);
    let config_before = get_program_config(&ctx, &core.config);

    let now = ctx.get_current_timestamp();
    let (task_id, meta) = post_task_sol_with_meta(
        &mut ctx,
        &poster,
        core.config,
        core.event_authority,
        judge.pubkey().to_bytes(),
        0,
        7_000,
        88_000,
        now + 100,
        now + 200,
    );

    let created_payload = find_event_payload(&meta, EVENT_TASK_CREATED);
    assert_eq!(read_u64(&created_payload, 0), task_id);
    assert_eq!(read_array_32(&created_payload, 8), poster.pubkey().to_bytes());
    assert_eq!(read_array_32(&created_payload, 40), judge.pubkey().to_bytes());
    assert_eq!(read_u64(&created_payload, 72), 88_000);
    assert_eq!(created_payload[80], 0);
    assert_eq!(read_i64(&created_payload, 81), now + 100);

    let config_after = get_program_config(&ctx, &core.config);
    assert_eq!(config_before.task_count + 1, config_after.task_count);
}

fn post_task_sol_with_meta(
    ctx: &mut TestContext,
    poster: &solana_sdk::signature::Keypair,
    config: solana_sdk::pubkey::Pubkey,
    event_authority: solana_sdk::pubkey::Pubkey,
    judge: [u8; 32],
    category: u8,
    min_stake: u64,
    reward: u64,
    deadline: i64,
    judge_deadline: i64,
) -> (u64, TransactionMetadata) {
    let cfg = get_program_config(ctx, &config);
    let task_id = cfg.task_count;

    let (task, _) = find_task_pda(task_id);
    let (escrow, _) = find_escrow_pda(task_id);
    let (judge_pool, _) = find_judge_pool_pda(category);

    let instruction = PostTaskBuilder::new()
        .poster(poster.pubkey())
        .config(config)
        .task(task)
        .escrow(escrow)
        .judge_pool(judge_pool)
        .event_authority(event_authority)
        .gradience_program(GRADIENCE_ID)
        .eval_ref(format!("ar://task-{task_id}"))
        .deadline(deadline)
        .judge_deadline(judge_deadline)
        .judge_mode(0)
        .judge(judge)
        .category(category)
        .mint([0u8; 32])
        .min_stake(min_stake)
        .reward(reward)
        .instruction();
    let instruction = strip_optional_tail_pub(instruction, 8, 5);
    let meta = ctx
        .send_transaction_with_meta(instruction, &[poster])
        .expect("post_task should succeed");
    (task_id, meta)
}

fn extract_event_payloads(meta: &TransactionMetadata) -> Vec<(u8, Vec<u8>)> {
    meta.inner_instructions
        .iter()
        .flat_map(|ixs| ixs.iter())
        .filter_map(|inner_ix| {
            let data = &inner_ix.instruction.data;
            if data.len() < 9 || &data[..8] != EVENT_IX_TAG_LE {
                return None;
            }
            Some((data[8], data[9..].to_vec()))
        })
        .collect()
}

fn find_event_payload(meta: &TransactionMetadata, discriminator: u8) -> Vec<u8> {
    extract_event_payloads(meta)
        .into_iter()
        .find(|(disc, _)| *disc == discriminator)
        .map(|(_, payload)| payload)
        .unwrap_or_else(|| panic!("event discriminator {discriminator} not found"))
}

fn read_u64(data: &[u8], start: usize) -> u64 {
    u64::from_le_bytes(data[start..start + 8].try_into().expect("u64 bytes"))
}

fn read_i64(data: &[u8], start: usize) -> i64 {
    i64::from_le_bytes(data[start..start + 8].try_into().expect("i64 bytes"))
}

fn read_array_32(data: &[u8], start: usize) -> [u8; 32] {
    data[start..start + 32].try_into().expect("[u8;32] bytes")
}
