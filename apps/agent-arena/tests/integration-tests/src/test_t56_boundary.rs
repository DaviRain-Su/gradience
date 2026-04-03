use gradience::constants::{MIN_SCORE, UNSTAKE_COOLDOWN};
use gradience::state::TaskState;
use gradience_client::errors::GradienceError;
use solana_sdk::signature::Signer;

use crate::{
    fixtures::{
        apply_for_task, build_judge_and_pay_ix, build_refund_expired_ix, build_unstake_judge_ix,
        initialize_program, post_task_sol, register_judge, submit_result,
    },
    utils::{
        assert_program_error, find_application_pda, find_judge_pool_pda, find_task_pda,
        get_lamports, get_reputation, get_task, TestContext,
    },
};

// ── score < MIN_SCORE refund path ─────────────────────────────────────

#[test]
fn t56_judge_low_score_refunds_poster() {
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

    let now = ctx.get_current_timestamp();
    let task_id = post_task_sol(
        &mut ctx,
        &poster,
        &core,
        0,
        judge.pubkey().to_bytes(),
        0,
        1_000,
        100_000,
        now + 1_000,
        now + 2_000,
    );

    apply_for_task(&mut ctx, &agent_a, task_id, core.event_authority);
    apply_for_task(&mut ctx, &agent_b, task_id, core.event_authority);
    submit_result(&mut ctx, &agent_a, task_id, core.event_authority, "a");
    ctx.warp_to_next_slot();
    submit_result(&mut ctx, &agent_b, task_id, core.event_authority, "b");

    let poster_before = get_lamports(&ctx, &poster.pubkey());
    let agent_a_before = get_lamports(&ctx, &agent_a.pubkey());
    let agent_b_before = get_lamports(&ctx, &agent_b.pubkey());
    let judge_before = get_lamports(&ctx, &judge.pubkey());
    let treasury_before = get_lamports(&ctx, &core.treasury);

    let (app_b, _) = find_application_pda(task_id, &agent_b.pubkey());
    let low_score = MIN_SCORE - 1;
    let judge_ix = build_judge_and_pay_ix(
        &judge,
        task_id,
        agent_a.pubkey(),
        poster.pubkey(),
        core.treasury,
        core.event_authority,
        &[(app_b, agent_b.pubkey())],
        low_score,
    );
    ctx.send_transaction(judge_ix, &[&judge])
        .expect("judge_and_pay with low score should succeed");

    let (task_pda, _) = find_task_pda(task_id);
    let task = get_task(&ctx, &task_pda);
    assert_eq!(task.state, TaskState::Refunded, "low score should refund");
    assert_eq!(task.winner, None, "low score should have no winner");

    let poster_after = get_lamports(&ctx, &poster.pubkey());
    assert_eq!(
        poster_after - poster_before,
        100_000,
        "poster should receive full reward back"
    );

    let agent_a_after = get_lamports(&ctx, &agent_a.pubkey());
    let agent_b_after = get_lamports(&ctx, &agent_b.pubkey());
    assert_eq!(
        agent_a_after - agent_a_before,
        1_000,
        "agent_a stake refunded"
    );
    assert_eq!(
        agent_b_after - agent_b_before,
        1_000,
        "agent_b stake refunded"
    );

    assert_eq!(
        get_lamports(&ctx, &judge.pubkey()) - judge_before,
        0,
        "judge should not receive fee on low score"
    );
    assert_eq!(
        get_lamports(&ctx, &core.treasury) - treasury_before,
        0,
        "treasury should not receive fee on low score"
    );
}

// ── score exactly at MIN_SCORE boundary ───────────────────────────────

#[test]
fn t56_judge_at_min_score_succeeds_normally() {
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

    let now = ctx.get_current_timestamp();
    let task_id = post_task_sol(
        &mut ctx,
        &poster,
        &core,
        0,
        judge.pubkey().to_bytes(),
        0,
        1_000,
        100_000,
        now + 1_000,
        now + 2_000,
    );

    apply_for_task(&mut ctx, &agent, task_id, core.event_authority);
    submit_result(&mut ctx, &agent, task_id, core.event_authority, "a");

    let agent_before = get_lamports(&ctx, &agent.pubkey());
    let treasury_before = get_lamports(&ctx, &core.treasury);

    let judge_ix = build_judge_and_pay_ix(
        &judge,
        task_id,
        agent.pubkey(),
        poster.pubkey(),
        core.treasury,
        core.event_authority,
        &[],
        MIN_SCORE,
    );
    ctx.send_transaction(judge_ix, &[&judge])
        .expect("judge_and_pay at MIN_SCORE should succeed normally");

    let (task_pda, _) = find_task_pda(task_id);
    let task = get_task(&ctx, &task_pda);
    assert_eq!(task.state, TaskState::Completed, "MIN_SCORE should complete normally");
    assert_eq!(task.winner, Some(agent.pubkey().to_bytes()));

    let agent_after = get_lamports(&ctx, &agent.pubkey());
    assert_eq!(
        agent_after - agent_before,
        96_000,
        "agent should get 95% reward + 1000 stake"
    );
    assert_eq!(
        get_lamports(&ctx, &core.treasury) - treasury_before,
        2_000,
        "treasury should get 2%"
    );
}

// ── reputation global + category updates on judge ─────────────────────

#[test]
fn t56_judge_updates_category_stats() {
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
        vec![2],
        2_000_000_000,
    );

    let now = ctx.get_current_timestamp();
    let task_id = post_task_sol(
        &mut ctx,
        &poster,
        &core,
        0,
        judge.pubkey().to_bytes(),
        2,
        1_000,
        50_000,
        now + 1_000,
        now + 2_000,
    );

    apply_for_task(&mut ctx, &agent, task_id, core.event_authority);
    submit_result(&mut ctx, &agent, task_id, core.event_authority, "a");

    let judge_ix = build_judge_and_pay_ix(
        &judge,
        task_id,
        agent.pubkey(),
        poster.pubkey(),
        core.treasury,
        core.event_authority,
        &[],
        85,
    );
    ctx.send_transaction(judge_ix, &[&judge])
        .expect("judge should succeed");

    let (rep_pda, _) = crate::utils::find_reputation_pda(&agent.pubkey());
    let reputation = get_reputation(&ctx, &rep_pda);

    assert_eq!(reputation.global.completed, 1);
    assert_eq!(reputation.global.avg_score, 8500); // stored as basis points (score * 100)
    assert_eq!(reputation.global.total_applied, 1);

    assert_eq!(reputation.by_category[2].completed, 1);
    assert_eq!(reputation.by_category[2].avg_score, 8500);
}

// ── refund_expired: multiple applicants with different stake amounts ───

#[test]
fn t56_refund_expired_no_applicants() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let anyone = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);

    let now = ctx.get_current_timestamp();
    let task_id = post_task_sol(
        &mut ctx,
        &poster,
        &core,
        0,
        judge.pubkey().to_bytes(),
        0,
        1_000,
        50_000,
        now + 1,
        now + 2_000,
    );
    let poster_after_post = get_lamports(&ctx, &poster.pubkey());

    ctx.warp_to_timestamp(now + 2);

    let refund_ix = build_refund_expired_ix(
        &anyone,
        poster.pubkey(),
        task_id,
        core.event_authority,
        &[],
    );
    ctx.send_transaction(refund_ix, &[&anyone])
        .expect("refund_expired no applicants should succeed");

    let (task_pda, _) = find_task_pda(task_id);
    let task = get_task(&ctx, &task_pda);
    assert_eq!(task.state, TaskState::Refunded);

    let poster_after_refund = get_lamports(&ctx, &poster.pubkey());
    assert_eq!(
        poster_after_refund - poster_after_post,
        50_000,
        "full reward refunded to poster"
    );
}

// ── unstake after cooldown from judging ───────────────────────────────

#[test]
fn t56_unstake_after_cooldown_from_judging() {
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

    let now = ctx.get_current_timestamp();
    let task_id = post_task_sol(
        &mut ctx,
        &poster,
        &core,
        0,
        judge.pubkey().to_bytes(),
        0,
        1_000,
        50_000,
        now + 1_000,
        now + 2_000,
    );
    apply_for_task(&mut ctx, &agent, task_id, core.event_authority);
    submit_result(&mut ctx, &agent, task_id, core.event_authority, "a");

    let judge_ix = build_judge_and_pay_ix(
        &judge,
        task_id,
        agent.pubkey(),
        poster.pubkey(),
        core.treasury,
        core.event_authority,
        &[],
        80,
    );
    ctx.send_transaction(judge_ix, &[&judge])
        .expect("judge should succeed");

    // Try before cooldown
    let unstake_ix = build_unstake_judge_ix(&judge, core.event_authority, &[0]);
    let err = ctx.send_transaction_expect_error(unstake_ix, &[&judge]);
    assert_program_error(err, GradienceError::CooldownNotExpired);

    // Warp past cooldown and succeed
    let now2 = ctx.get_current_timestamp();
    ctx.warp_to_timestamp(now2 + UNSTAKE_COOLDOWN + 1);
    ctx.warp_to_next_slot();

    let unstake_ix2 = build_unstake_judge_ix(&judge, core.event_authority, &[0]);
    ctx.send_transaction(unstake_ix2, &[&judge])
        .expect("unstake after cooldown should succeed");

    let (pool0, _) = find_judge_pool_pda(0);
    let pool = crate::utils::get_judge_pool(&ctx, &pool0);
    assert!(
        !pool.entries.iter().any(|e| e.judge == judge.pubkey().to_bytes()),
        "judge removed from pool after unstake"
    );
}
