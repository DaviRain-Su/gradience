use gradience::{
    constants::{
        BPS_DENOMINATOR, CANCEL_FEE_BPS, FORCE_REFUND_DELAY, JUDGE_FEE_BPS, MIN_SCORE,
        PROTOCOL_FEE_BPS,
    },
    events::{
        EVENT_IX_TAG_LE, TASK_REFUND_REASON_CANCELLED, TASK_REFUND_REASON_EXPIRED,
        TASK_REFUND_REASON_FORCE_REFUND, TASK_REFUND_REASON_LOW_SCORE,
    },
};
use gradience_client::{
    instructions::{ApplyForTaskBuilder, PostTaskBuilder, RegisterJudgeBuilder, SubmitResultBuilder},
    types::RuntimeEnvInput,
    GRADIENCE_ID,
};
use litesvm::types::TransactionMetadata;
use solana_sdk::signature::Signer;

use crate::{
    fixtures::{
        apply_for_task, build_cancel_task_ix, build_force_refund_ix, build_judge_and_pay_ix,
        build_refund_expired_ix, build_unstake_judge_ix, initialize_program, register_judge,
        strip_optional_tail_pub, submit_result,
    },
    utils::{
        find_application_pda, find_escrow_pda, find_judge_pool_pda, find_reputation_pda,
        find_stake_pda, find_submission_pda, find_task_pda, get_program_config, TestContext,
    },
};

const EVENT_TASK_CREATED: u8 = 1;
const EVENT_SUBMISSION_RECEIVED: u8 = 2;
const EVENT_TASK_JUDGED: u8 = 3;
const EVENT_TASK_REFUNDED: u8 = 4;
const EVENT_JUDGE_REGISTERED: u8 = 5;
const EVENT_TASK_APPLIED: u8 = 6;
const EVENT_TASK_CANCELLED: u8 = 7;
const EVENT_JUDGE_UNSTAKED: u8 = 8;

fn read_u64(data: &[u8], start: usize) -> u64 {
    u64::from_le_bytes(data[start..start + 8].try_into().expect("u64 bytes"))
}

fn read_i64(data: &[u8], start: usize) -> i64 {
    i64::from_le_bytes(data[start..start + 8].try_into().expect("i64 bytes"))
}

fn read_u32(data: &[u8], start: usize) -> u32 {
    u32::from_le_bytes(data[start..start + 4].try_into().expect("u32 bytes"))
}

fn read_array_32(data: &[u8], start: usize) -> [u8; 32] {
    data[start..start + 32].try_into().expect("[u8;32] bytes")
}

fn read_prefixed_string(data: &[u8], start: usize) -> (String, usize) {
    let len = read_u32(data, start) as usize;
    let begin = start + 4;
    let end = begin + len;
    let value = std::str::from_utf8(&data[begin..end])
        .expect("valid utf8")
        .to_string();
    (value, end)
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

fn post_task_sol_with_meta(
    ctx: &mut TestContext,
    poster: &solana_sdk::signature::Keypair,
    core: &crate::fixtures::CorePdas,
    judge: [u8; 32],
    category: u8,
    min_stake: u64,
    reward: u64,
    deadline: i64,
    judge_deadline: i64,
) -> (u64, TransactionMetadata) {
    let config = get_program_config(ctx, &core.config);
    let task_id = config.task_count;

    let (task, _) = find_task_pda(task_id);
    let (escrow, _) = find_escrow_pda(task_id);
    let (judge_pool, _) = find_judge_pool_pda(category);

    let instruction = PostTaskBuilder::new()
        .poster(poster.pubkey())
        .config(core.config)
        .task(task)
        .escrow(escrow)
        .judge_pool(judge_pool)
        .event_authority(core.event_authority)
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

fn register_judge_with_meta(
    ctx: &mut TestContext,
    judge: &solana_sdk::signature::Keypair,
    config: solana_sdk::pubkey::Pubkey,
    event_authority: solana_sdk::pubkey::Pubkey,
    categories: Vec<u8>,
    stake_amount: u64,
) -> (solana_sdk::pubkey::Pubkey, TransactionMetadata) {
    let (stake, _) = find_stake_pda(&judge.pubkey());
    let (reputation, _) = find_reputation_pda(&judge.pubkey());

    let mut builder = RegisterJudgeBuilder::new();
    builder
        .judge(judge.pubkey())
        .config(config)
        .stake(stake)
        .reputation(reputation)
        .event_authority(event_authority)
        .gradience_program(GRADIENCE_ID)
        .categories(categories.clone())
        .stake_amount(stake_amount);

    for category in categories {
        let (pool, _) = find_judge_pool_pda(category);
        builder.add_remaining_account(solana_sdk::instruction::AccountMeta::new(pool, false));
    }

    let meta = ctx
        .send_transaction_with_meta(builder.instruction(), &[judge])
        .expect("register_judge should succeed");
    (stake, meta)
}

fn apply_for_task_with_meta(
    ctx: &mut TestContext,
    agent: &solana_sdk::signature::Keypair,
    task_id: u64,
    event_authority: solana_sdk::pubkey::Pubkey,
) -> TransactionMetadata {
    let (task, _) = find_task_pda(task_id);
    let (escrow, _) = find_escrow_pda(task_id);
    let (application, _) = find_application_pda(task_id, &agent.pubkey());
    let (reputation, _) = find_reputation_pda(&agent.pubkey());

    let instruction = ApplyForTaskBuilder::new()
        .agent(agent.pubkey())
        .task(task)
        .escrow(escrow)
        .application(application)
        .reputation(reputation)
        .event_authority(event_authority)
        .gradience_program(GRADIENCE_ID)
        .instruction();
    let instruction = strip_optional_tail_pub(instruction, 8, 4);
    ctx.send_transaction_with_meta(instruction, &[agent])
        .expect("apply_for_task should succeed")
}

fn submit_result_with_meta(
    ctx: &mut TestContext,
    agent: &solana_sdk::signature::Keypair,
    task_id: u64,
    event_authority: solana_sdk::pubkey::Pubkey,
    suffix: &str,
) -> TransactionMetadata {
    let (task, _) = find_task_pda(task_id);
    let (application, _) = find_application_pda(task_id, &agent.pubkey());
    let (submission, _) = find_submission_pda(task_id, &agent.pubkey());
    let runtime_env = RuntimeEnvInput {
        provider: "openai".to_string(),
        model: "gpt-4.1".to_string(),
        runtime: "opencloud".to_string(),
        version: "20260331".to_string(),
    };

    let instruction = SubmitResultBuilder::new()
        .agent(agent.pubkey())
        .task(task)
        .application(application)
        .submission(submission)
        .event_authority(event_authority)
        .gradience_program(GRADIENCE_ID)
        .result_ref(format!("ar://result-{suffix}"))
        .trace_ref(format!("ar://trace-{suffix}"))
        .runtime_env(runtime_env)
        .instruction();
    ctx.send_transaction_with_meta(instruction, &[agent])
        .expect("submit_result should succeed")
}

#[test]
fn t56_event_parsing_task_created_and_judged() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let agent_a = ctx.create_funded_keypair();
    let agent_b = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);
    register_judge(
        &mut ctx,
        &judge,
        core.config,
        core.event_authority,
        vec![0],
        2_000_000_000,
    );

    let reward = 1_000_000;
    let min_stake = 100_000;
    let now = ctx.get_current_timestamp();
    let (task_id, post_meta) = post_task_sol_with_meta(
        &mut ctx,
        &poster,
        &core,
        judge.pubkey().to_bytes(),
        0,
        min_stake,
        reward,
        now + 1_000,
        now + 2_000,
    );

    let created = find_event_payload(&post_meta, EVENT_TASK_CREATED);
    assert_eq!(created.len(), 8 + 32 + 32 + 8 + 1 + 8);
    assert_eq!(read_u64(&created, 0), task_id);
    assert_eq!(read_array_32(&created, 8), poster.pubkey().to_bytes());
    assert_eq!(read_array_32(&created, 40), judge.pubkey().to_bytes());
    assert_eq!(read_u64(&created, 72), reward);
    assert_eq!(created[80], 0);
    assert_eq!(read_i64(&created, 81), now + 1_000);

    apply_for_task(&mut ctx, &agent_a, task_id, core.event_authority);
    apply_for_task(&mut ctx, &agent_b, task_id, core.event_authority);
    submit_result(&mut ctx, &agent_a, task_id, core.event_authority, "a");
    ctx.warp_to_next_slot();
    submit_result(&mut ctx, &agent_b, task_id, core.event_authority, "b");

    let (app_b, _) = find_application_pda(task_id, &agent_b.pubkey());
    let judge_ix = build_judge_and_pay_ix(
        &judge,
        task_id,
        agent_a.pubkey(),
        poster.pubkey(),
        core.treasury,
        core.event_authority,
        &[(app_b, agent_b.pubkey())],
        80,
    );
    let judge_meta = ctx
        .send_transaction_with_meta(judge_ix, &[&judge])
        .expect("judge_and_pay should succeed");

    let judged = find_event_payload(&judge_meta, EVENT_TASK_JUDGED);
    assert_eq!(judged.len(), 8 + 32 + 1 + 8 + 8 + 8);
    assert_eq!(read_u64(&judged, 0), task_id);
    assert_eq!(read_array_32(&judged, 8), agent_a.pubkey().to_bytes());
    assert_eq!(judged[40], 80);
    assert_eq!(read_u64(&judged, 41), reward * 95 / 100);
    assert_eq!(read_u64(&judged, 49), reward * 3 / 100);
    assert_eq!(read_u64(&judged, 57), reward * 2 / 100);
}

#[test]
fn t56_event_parsing_task_refunded_low_score() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let agent = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);
    register_judge(
        &mut ctx,
        &judge,
        core.config,
        core.event_authority,
        vec![0],
        2_000_000_000,
    );

    let reward = 600_000;
    let min_stake = 50_000;
    let now = ctx.get_current_timestamp();
    let (task_id, _) = post_task_sol_with_meta(
        &mut ctx,
        &poster,
        &core,
        judge.pubkey().to_bytes(),
        0,
        min_stake,
        reward,
        now + 1_000,
        now + 2_000,
    );

    apply_for_task(&mut ctx, &agent, task_id, core.event_authority);
    submit_result(&mut ctx, &agent, task_id, core.event_authority, "low");

    let low_score = MIN_SCORE - 1;
    let judge_ix = build_judge_and_pay_ix(
        &judge,
        task_id,
        agent.pubkey(),
        poster.pubkey(),
        core.treasury,
        core.event_authority,
        &[],
        low_score,
    );
    let judge_meta = ctx
        .send_transaction_with_meta(judge_ix, &[&judge])
        .expect("judge_and_pay low-score should succeed");

    let refunded = find_event_payload(&judge_meta, EVENT_TASK_REFUNDED);
    assert_eq!(refunded.len(), 8 + 1 + 8);
    assert_eq!(read_u64(&refunded, 0), task_id);
    assert_eq!(refunded[8], TASK_REFUND_REASON_LOW_SCORE);
    assert_eq!(read_u64(&refunded, 9), reward);
}

#[test]
fn t56_event_parsing_task_refunded_expired_reason() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let anyone = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);
    register_judge(
        &mut ctx,
        &judge,
        core.config,
        core.event_authority,
        vec![0],
        2_000_000_000,
    );

    let reward = 700_000;
    let min_stake = 50_000;
    let now = ctx.get_current_timestamp();
    let (task_id, _) = post_task_sol_with_meta(
        &mut ctx,
        &poster,
        &core,
        judge.pubkey().to_bytes(),
        0,
        min_stake,
        reward,
        now + 1_000,
        now + 2_000,
    );

    ctx.warp_to_timestamp(now + 1_001);
    let refund_ix = build_refund_expired_ix(
        &anyone,
        poster.pubkey(),
        task_id,
        core.event_authority,
        &[],
    );
    let refund_meta = ctx
        .send_transaction_with_meta(refund_ix, &[&anyone])
        .expect("refund_expired should succeed");

    let refunded = find_event_payload(&refund_meta, EVENT_TASK_REFUNDED);
    assert_eq!(refunded.len(), 8 + 1 + 8);
    assert_eq!(read_u64(&refunded, 0), task_id);
    assert_eq!(refunded[8], TASK_REFUND_REASON_EXPIRED);
    assert_eq!(read_u64(&refunded, 9), reward);
}

#[test]
fn t56_event_parsing_task_refunded_cancelled_reason() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let agent = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);
    register_judge(
        &mut ctx,
        &judge,
        core.config,
        core.event_authority,
        vec![0],
        2_000_000_000,
    );

    let reward = 1_000_000;
    let min_stake = 100_000;
    let now = ctx.get_current_timestamp();
    let (task_id, _) = post_task_sol_with_meta(
        &mut ctx,
        &poster,
        &core,
        judge.pubkey().to_bytes(),
        0,
        min_stake,
        reward,
        now + 1_000,
        now + 2_000,
    );
    apply_for_task(&mut ctx, &agent, task_id, core.event_authority);

    let (application, _) = find_application_pda(task_id, &agent.pubkey());
    let cancel_ix = build_cancel_task_ix(
        &poster,
        task_id,
        core.treasury,
        core.event_authority,
        &[(application, agent.pubkey())],
    );
    let cancel_meta = ctx
        .send_transaction_with_meta(cancel_ix, &[&poster])
        .expect("cancel_task should succeed");

    let refunded = find_event_payload(&cancel_meta, EVENT_TASK_REFUNDED);
    let expected_fee = reward * (CANCEL_FEE_BPS as u64) / BPS_DENOMINATOR;
    let expected_refund = reward - expected_fee;
    assert_eq!(refunded.len(), 8 + 1 + 8);
    assert_eq!(read_u64(&refunded, 0), task_id);
    assert_eq!(refunded[8], TASK_REFUND_REASON_CANCELLED);
    assert_eq!(read_u64(&refunded, 9), expected_refund);
}

#[test]
fn t56_event_parsing_task_refunded_force_refund_reason() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let anyone = ctx.create_funded_keypair();
    let agent = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);
    register_judge(
        &mut ctx,
        &judge,
        core.config,
        core.event_authority,
        vec![0],
        5_000_000_000,
    );

    let reward = 500_000;
    let min_stake = 1_000;
    let now = ctx.get_current_timestamp();
    let task_id = post_task_sol_with_meta(
        &mut ctx,
        &poster,
        &core,
        judge.pubkey().to_bytes(),
        0,
        min_stake,
        reward,
        now + 10,
        now + 20,
    )
    .0;
    apply_for_task(&mut ctx, &agent, task_id, core.event_authority);
    submit_result(&mut ctx, &agent, task_id, core.event_authority, "force");

    ctx.warp_to_timestamp(now + 20 + FORCE_REFUND_DELAY + 1);

    let (pool0, _) = find_judge_pool_pda(0);
    let (application, _) = find_application_pda(task_id, &agent.pubkey());
    let force_ix = build_force_refund_ix(
        &anyone,
        task_id,
        poster.pubkey(),
        agent.pubkey(),
        core.config,
        judge.pubkey(),
        core.treasury,
        core.event_authority,
        &[pool0],
        &[(application, agent.pubkey())],
    );
    let force_meta = ctx
        .send_transaction_with_meta(force_ix, &[&anyone])
        .expect("force_refund should succeed");

    let refunded = find_event_payload(&force_meta, EVENT_TASK_REFUNDED);
    let judge_fee = reward * (JUDGE_FEE_BPS as u64) / BPS_DENOMINATOR;
    let protocol_fee = reward * (PROTOCOL_FEE_BPS as u64) / BPS_DENOMINATOR;
    let expected_poster_share = reward - judge_fee - protocol_fee;
    assert_eq!(refunded.len(), 8 + 1 + 8);
    assert_eq!(read_u64(&refunded, 0), task_id);
    assert_eq!(refunded[8], TASK_REFUND_REASON_FORCE_REFUND);
    assert_eq!(read_u64(&refunded, 9), expected_poster_share);
}

#[test]
fn t56_event_parsing_task_applied_and_submission_received() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let agent = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);
    register_judge(
        &mut ctx,
        &judge,
        core.config,
        core.event_authority,
        vec![0],
        2_000_000_000,
    );

    let reward = 900_000;
    let min_stake = 111_000;
    let now = ctx.get_current_timestamp();
    let (task_id, _) = post_task_sol_with_meta(
        &mut ctx,
        &poster,
        &core,
        judge.pubkey().to_bytes(),
        0,
        min_stake,
        reward,
        now + 1_000,
        now + 2_000,
    );

    let apply_meta = apply_for_task_with_meta(&mut ctx, &agent, task_id, core.event_authority);
    let applied = find_event_payload(&apply_meta, EVENT_TASK_APPLIED);
    assert_eq!(applied.len(), 8 + 32 + 8 + 8);
    assert_eq!(read_u64(&applied, 0), task_id);
    assert_eq!(read_array_32(&applied, 8), agent.pubkey().to_bytes());
    assert_eq!(read_u64(&applied, 40), min_stake);
    assert!(read_u64(&applied, 48) > 0);

    let submit_meta = submit_result_with_meta(&mut ctx, &agent, task_id, core.event_authority, "evt");
    let submitted = find_event_payload(&submit_meta, EVENT_SUBMISSION_RECEIVED);
    assert_eq!(read_u64(&submitted, 0), task_id);
    assert_eq!(read_array_32(&submitted, 8), agent.pubkey().to_bytes());
    let (result_ref, next) = read_prefixed_string(&submitted, 40);
    let (trace_ref, next2) = read_prefixed_string(&submitted, next);
    let submission_slot = read_u64(&submitted, next2);
    assert_eq!(result_ref, "ar://result-evt");
    assert_eq!(trace_ref, "ar://trace-evt");
    assert!(submission_slot > 0);
}

#[test]
fn t56_event_parsing_task_cancelled() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let agent = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);
    register_judge(
        &mut ctx,
        &judge,
        core.config,
        core.event_authority,
        vec![0],
        2_000_000_000,
    );

    let reward = 1_000_000;
    let min_stake = 100_000;
    let now = ctx.get_current_timestamp();
    let (task_id, _) = post_task_sol_with_meta(
        &mut ctx,
        &poster,
        &core,
        judge.pubkey().to_bytes(),
        0,
        min_stake,
        reward,
        now + 1_000,
        now + 2_000,
    );
    apply_for_task(&mut ctx, &agent, task_id, core.event_authority);

    let (application, _) = find_application_pda(task_id, &agent.pubkey());
    let cancel_ix = build_cancel_task_ix(
        &poster,
        task_id,
        core.treasury,
        core.event_authority,
        &[(application, agent.pubkey())],
    );
    let cancel_meta = ctx
        .send_transaction_with_meta(cancel_ix, &[&poster])
        .expect("cancel_task should succeed");

    let cancelled = find_event_payload(&cancel_meta, EVENT_TASK_CANCELLED);
    assert_eq!(cancelled.len(), 8 + 32 + 8 + 8);
    assert_eq!(read_u64(&cancelled, 0), task_id);
    assert_eq!(read_array_32(&cancelled, 8), poster.pubkey().to_bytes());
    let expected_fee = reward * (CANCEL_FEE_BPS as u64) / BPS_DENOMINATOR;
    let expected_refund = reward - expected_fee;
    assert_eq!(read_u64(&cancelled, 40), expected_refund);
    assert_eq!(read_u64(&cancelled, 48), expected_fee);
}

#[test]
fn t56_event_parsing_judge_registered_and_unstaked() {
    let mut ctx = TestContext::new();
    let judge = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);
    let stake_amount = 2_000_000_000;
    let categories = vec![0, 2];
    let (_stake_pda, register_meta) = register_judge_with_meta(
        &mut ctx,
        &judge,
        core.config,
        core.event_authority,
        categories.clone(),
        stake_amount,
    );

    let registered = find_event_payload(&register_meta, EVENT_JUDGE_REGISTERED);
    assert_eq!(read_array_32(&registered, 0), judge.pubkey().to_bytes());
    assert_eq!(read_u64(&registered, 32), stake_amount);
    let categories_len = read_u32(&registered, 40) as usize;
    assert_eq!(categories_len, categories.len());
    assert_eq!(&registered[44..44 + categories_len], categories.as_slice());

    let unstake_ix = build_unstake_judge_ix(&judge, core.event_authority, &categories);
    let unstake_meta = ctx
        .send_transaction_with_meta(unstake_ix, &[&judge])
        .expect("unstake_judge should succeed");

    let unstaked = find_event_payload(&unstake_meta, EVENT_JUDGE_UNSTAKED);
    assert_eq!(read_array_32(&unstaked, 0), judge.pubkey().to_bytes());
    assert_eq!(read_u64(&unstaked, 32), stake_amount);
    let unstaked_len = read_u32(&unstaked, 40) as usize;
    assert_eq!(unstaked_len, categories.len());
    assert_eq!(&unstaked[44..44 + unstaked_len], categories.as_slice());
}
