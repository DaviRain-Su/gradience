use std::time::Instant;

use gradience_client::{instructions::PostTaskBuilder, GRADIENCE_ID};
use solana_sdk::signature::Signer;

use crate::{
    fixtures::{
        apply_for_task, build_judge_and_pay_ix, initialize_program, register_judge,
        strip_optional_tail_pub, submit_result,
    },
    utils::{find_judge_pool_pda, find_task_pda, get_program_config, TestContext},
};

#[test]
fn t70_post_task_cu_and_tx_size_baseline() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();

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

    let task_id = get_program_config(&ctx, &core.config).task_count;
    let (task, _) = find_task_pda(task_id);
    let (escrow, _) = crate::utils::find_escrow_pda(task_id);
    let (judge_pool, _) = find_judge_pool_pda(0);
    let now = ctx.get_current_timestamp();

    let instruction = PostTaskBuilder::new()
        .poster(poster.pubkey())
        .config(core.config)
        .task(task)
        .escrow(escrow)
        .judge_pool(judge_pool)
        .event_authority(core.event_authority)
        .gradience_program(GRADIENCE_ID)
        .eval_ref("ar://t70-post-task".to_string())
        .deadline(now + 1_000)
        .judge_deadline(now + 2_000)
        .judge_mode(1)
        .judge([0u8; 32])
        .category(0)
        .mint([0u8; 32])
        .min_stake(1_000)
        .reward(100_000)
        .instruction();
    let instruction = strip_optional_tail_pub(instruction, 8, 5);

    let started = Instant::now();
    let stats = ctx
        .send_transaction_with_stats(instruction, &[&poster])
        .expect("post_task should succeed");
    let latency_ms = started.elapsed().as_millis() as u64;

    assert!(
        stats.compute_units <= 200_000,
        "post_task CU should stay <= 200k"
    );
    assert!(
        stats.tx_size_bytes <= 1_232,
        "post_task tx size should stay <= packet limit"
    );

    println!(
        "T70_BASELINE|instruction=post_task|cu={}|tx_size_bytes={}|latency_ms={}",
        stats.compute_units, stats.tx_size_bytes, latency_ms
    );
}

#[test]
fn t70_judge_and_pay_cu_and_tx_size_baseline() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let winner = ctx.create_funded_keypair();
    let loser = ctx.create_funded_keypair();

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

    let now = ctx.get_current_timestamp();
    let task_id = crate::fixtures::post_task_sol(
        &mut ctx,
        &poster,
        &core,
        0,
        judge.pubkey().to_bytes(),
        0,
        1_000,
        120_000,
        now + 1_000,
        now + 2_000,
    );
    apply_for_task(&mut ctx, &winner, task_id, core.event_authority);
    apply_for_task(&mut ctx, &loser, task_id, core.event_authority);
    submit_result(&mut ctx, &winner, task_id, core.event_authority, "winner");
    ctx.warp_to_next_slot();
    submit_result(&mut ctx, &loser, task_id, core.event_authority, "loser");

    let (loser_application, _) = crate::utils::find_application_pda(task_id, &loser.pubkey());
    let judge_ix = build_judge_and_pay_ix(
        &judge,
        task_id,
        winner.pubkey(),
        poster.pubkey(),
        core.treasury,
        core.event_authority,
        &[(loser_application, loser.pubkey())],
        88,
    );

    let started = Instant::now();
    let stats = ctx
        .send_transaction_with_stats(judge_ix, &[&judge])
        .expect("judge_and_pay should succeed");
    let latency_ms = started.elapsed().as_millis() as u64;

    assert!(
        stats.compute_units <= 200_000,
        "judge_and_pay CU should stay <= 200k"
    );
    assert!(
        stats.tx_size_bytes <= 1_232,
        "judge_and_pay tx size should stay <= packet limit"
    );

    println!(
        "T70_BASELINE|instruction=judge_and_pay|cu={}|tx_size_bytes={}|latency_ms={}",
        stats.compute_units, stats.tx_size_bytes, latency_ms
    );
}
