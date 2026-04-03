use gradience::constants::UNSTAKE_COOLDOWN;
use gradience_client::errors::GradienceError;
use solana_sdk::signature::Signer;

use crate::{
    fixtures::{
        apply_for_task, build_cancel_task_ix, build_judge_and_pay_ix, build_refund_expired_ix,
        build_unstake_judge_ix, initialize_program, post_task_sol, register_judge, submit_result,
    },
    utils::{
        assert_instruction_error, assert_program_error, find_application_pda, find_judge_pool_pda,
        find_task_pda, TestContext,
    },
};

// ── post_task error boundaries ────────────────────────────────────────

#[test]
fn error_post_task_zero_reward() {
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

    let now = ctx.get_current_timestamp();
    let config = crate::utils::get_program_config(&ctx, &core.config);
    let task_id = config.task_count;

    let (task, _) = find_task_pda(task_id);
    let (escrow, _) = crate::utils::find_escrow_pda(task_id);
    let (judge_pool, _) = find_judge_pool_pda(0);

    let mut builder = gradience_client::instructions::PostTaskBuilder::new();
    builder
        .poster(poster.pubkey())
        .config(core.config)
        .task(task)
        .escrow(escrow)
        .judge_pool(judge_pool)
        .event_authority(core.event_authority)
        .gradience_program(gradience_client::GRADIENCE_ID)
        .eval_ref("ar://test".to_string())
        .deadline(now + 1_000)
        .judge_deadline(now + 2_000)
        .judge_mode(0)
        .judge(judge.pubkey().to_bytes())
        .category(0)
        .mint([0u8; 32])
        .min_stake(1_000)
        .reward(0);

    let instruction = crate::fixtures::strip_optional_tail_pub(builder.instruction(), 8, 5);
    let err = ctx.send_transaction_expect_error(instruction, &[&poster]);
    assert_program_error(err, GradienceError::ZeroReward);
}

// ── apply_for_task error boundaries ───────────────────────────────────

#[test]
fn error_apply_duplicate() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let agent = ctx.create_funded_keypair();

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
        now + 1_000,
        now + 2_000,
    );

    apply_for_task(&mut ctx, &agent, task_id, core.event_authority);
    ctx.warp_to_next_slot();

    let (task, _) = find_task_pda(task_id);
    let (escrow, _) = crate::utils::find_escrow_pda(task_id);
    let (application, _) = find_application_pda(task_id, &agent.pubkey());
    let (reputation, _) = crate::utils::find_reputation_pda(&agent.pubkey());

    let instruction = gradience_client::instructions::ApplyForTaskBuilder::new()
        .agent(agent.pubkey())
        .task(task)
        .escrow(escrow)
        .application(application)
        .reputation(reputation)
        .event_authority(core.event_authority)
        .gradience_program(gradience_client::GRADIENCE_ID)
        .instruction();
    let instruction = crate::fixtures::strip_optional_tail_pub(instruction, 8, 4);
    let err = ctx.send_transaction_expect_error(instruction, &[&agent]);
    // Application PDA already exists, so system-level AccountAlreadyInitialized
    // fires before custom AlreadyApplied check.
    assert_instruction_error(
        err,
        solana_sdk::instruction::InstructionError::AccountAlreadyInitialized,
    );
}

// ── cancel_task error boundaries ──────────────────────────────────────

#[test]
fn error_cancel_has_submissions() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let agent = ctx.create_funded_keypair();

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
        now + 1_000,
        now + 2_000,
    );

    apply_for_task(&mut ctx, &agent, task_id, core.event_authority);
    submit_result(&mut ctx, &agent, task_id, core.event_authority, "result");

    let (application, _) = find_application_pda(task_id, &agent.pubkey());
    let cancel_ix = build_cancel_task_ix(
        &poster,
        task_id,
        core.treasury,
        core.event_authority,
        &[(application, agent.pubkey())],
    );
    let err = ctx.send_transaction_expect_error(cancel_ix, &[&poster]);
    assert_program_error(err, GradienceError::HasSubmissions);
}

#[test]
fn error_cancel_not_poster() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let imposter = ctx.create_funded_keypair();

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
        now + 1_000,
        now + 2_000,
    );

    let cancel_ix = build_cancel_task_ix(
        &imposter,
        task_id,
        core.treasury,
        core.event_authority,
        &[],
    );
    let err = ctx.send_transaction_expect_error(cancel_ix, &[&imposter]);
    assert_program_error(err, GradienceError::NotTaskPoster);
}

// ── refund_expired error boundaries ───────────────────────────────────

#[test]
fn error_refund_expired_deadline_not_passed() {
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
        now + 10_000,
        now + 20_000,
    );

    let refund_ix = build_refund_expired_ix(
        &anyone,
        poster.pubkey(),
        task_id,
        core.event_authority,
        &[],
    );
    let err = ctx.send_transaction_expect_error(refund_ix, &[&anyone]);
    assert_program_error(err, GradienceError::DeadlineNotPassed);
}

// ── judge_and_pay error boundaries ────────────────────────────────────

#[test]
fn error_judge_not_authorized() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let fake_judge = ctx.create_funded_keypair();
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
    register_judge(
        &mut ctx,
        &fake_judge,
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
        &fake_judge,
        task_id,
        agent.pubkey(),
        poster.pubkey(),
        core.treasury,
        core.event_authority,
        &[],
        80,
    );
    let err = ctx.send_transaction_expect_error(judge_ix, &[&fake_judge]);
    assert_program_error(err, GradienceError::NotTaskJudge);
}

// ── unstake_judge + cooldown ──────────────────────────────────────────

#[test]
fn unstake_judge_succeeds_after_cooldown() {
    let mut ctx = TestContext::new();
    let judge = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);
    let stake_pda = register_judge(
        &mut ctx,
        &judge,
        core.config,
        core.event_authority,
        vec![0],
        2_000_000_000,
    );

    let now = ctx.get_current_timestamp();
    ctx.warp_to_timestamp(now + UNSTAKE_COOLDOWN + 1);

    let unstake_ix = build_unstake_judge_ix(&judge, core.event_authority, &[0]);
    ctx.send_transaction(unstake_ix, &[&judge])
        .expect("unstake_judge should succeed after cooldown");

    assert!(
        ctx.get_account(&stake_pda).is_none(),
        "stake account should be closed after unstake"
    );

    let (pool0, _) = find_judge_pool_pda(0);
    let pool = crate::utils::get_judge_pool(&ctx, &pool0);
    assert!(
        !pool.entries.iter().any(|e| e.judge == judge.pubkey().to_bytes()),
        "judge should be removed from pool"
    );
}

#[test]
fn error_unstake_cooldown_not_expired() {
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
        .expect("judge_and_pay should succeed");

    let unstake_ix = build_unstake_judge_ix(&judge, core.event_authority, &[0]);
    let err = ctx.send_transaction_expect_error(unstake_ix, &[&judge]);
    assert_program_error(err, GradienceError::CooldownNotExpired);
}
