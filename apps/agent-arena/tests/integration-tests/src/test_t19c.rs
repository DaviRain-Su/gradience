use gradience::state::TaskState;
use solana_sdk::signature::Signer;

use crate::{
    fixtures::{
        apply_for_task, build_cancel_task_ix, build_judge_and_pay_ix, build_refund_expired_ix,
        initialize_program, post_task_sol, register_judge, submit_result,
    },
    utils::{
        find_application_pda, find_stake_pda, find_task_pda, get_lamports, get_reputation,
        get_stake, get_task, TestContext,
    },
};

#[test]
fn t19c_judge_and_pay_sol_flow() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let agent_a = ctx.create_funded_keypair();
    let agent_b = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);
    let (stake_pda, _) = find_stake_pda(&judge.pubkey());
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
    let agent_a_before_judge = get_lamports(&ctx, &agent_a.pubkey());
    let agent_b_before_judge = get_lamports(&ctx, &agent_b.pubkey());
    let judge_before_judge = get_lamports(&ctx, &judge.pubkey());
    let treasury_before_judge = get_lamports(&ctx, &core.treasury);

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
    ctx.send_transaction(judge_ix, &[&judge])
        .expect("judge_and_pay should succeed");

    let (task_pda, _) = find_task_pda(task_id);
    let task = get_task(&ctx, &task_pda);
    assert_eq!(task.state, TaskState::Completed);
    assert_eq!(task.winner, Some(agent_a.pubkey().to_bytes()));

    let stake = get_stake(&ctx, &stake_pda);
    assert!(stake.cooldown_until > 0, "judge cooldown should be set");

    let winner_reputation = {
        let (rep, _) = crate::utils::find_reputation_pda(&agent_a.pubkey());
        get_reputation(&ctx, &rep)
    };
    assert_eq!(winner_reputation.global.completed, 1);

    let agent_b_after_judge = get_lamports(&ctx, &agent_b.pubkey());
    let agent_a_after_judge = get_lamports(&ctx, &agent_a.pubkey());
    let judge_after_judge = get_lamports(&ctx, &judge.pubkey());
    let treasury_after_judge = get_lamports(&ctx, &core.treasury);

    assert_eq!(
        agent_a_after_judge - agent_a_before_judge,
        96_000,
        "winner should receive 95% reward + winner stake refund"
    );
    assert_eq!(
        agent_b_after_judge - agent_b_before_judge,
        1_000,
        "loser stake must be refunded during judge_and_pay"
    );
    assert_eq!(
        judge_after_judge - judge_before_judge,
        3_000,
        "judge should receive 3% reward share"
    );
    assert_eq!(
        treasury_after_judge - treasury_before_judge,
        2_000,
        "treasury should receive 2% protocol fee"
    );
}

#[test]
fn t19c_cancel_task_with_applicants() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let agent_a = ctx.create_funded_keypair();
    let agent_b = ctx.create_funded_keypair();

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

    apply_for_task(&mut ctx, &agent_a, task_id, core.event_authority);
    apply_for_task(&mut ctx, &agent_b, task_id, core.event_authority);
    let agent_a_before_cancel = get_lamports(&ctx, &agent_a.pubkey());
    let agent_b_before_cancel = get_lamports(&ctx, &agent_b.pubkey());

    let (app_a, _) = find_application_pda(task_id, &agent_a.pubkey());
    let (app_b, _) = find_application_pda(task_id, &agent_b.pubkey());
    let cancel_ix = build_cancel_task_ix(
        &poster,
        task_id,
        core.treasury,
        core.event_authority,
        &[(app_a, agent_a.pubkey()), (app_b, agent_b.pubkey())],
    );
    ctx.send_transaction(cancel_ix, &[&poster])
        .expect("cancel_task should succeed");

    let (task_pda, _) = find_task_pda(task_id);
    let task = get_task(&ctx, &task_pda);
    assert_eq!(task.state, TaskState::Refunded);
    assert_eq!(
        get_lamports(&ctx, &agent_a.pubkey()) - agent_a_before_cancel,
        1_000
    );
    assert_eq!(
        get_lamports(&ctx, &agent_b.pubkey()) - agent_b_before_cancel,
        1_000
    );
}

#[test]
fn t19c_refund_expired_with_stake_refund() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let anyone = ctx.create_funded_keypair();
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
        30_000,
        now + 1,
        now + 2_000,
    );

    apply_for_task(&mut ctx, &agent, task_id, core.event_authority);
    let agent_before_refund = get_lamports(&ctx, &agent.pubkey());
    ctx.warp_to_timestamp(now + 2);

    let (application, _) = find_application_pda(task_id, &agent.pubkey());
    let refund_ix = build_refund_expired_ix(
        &anyone,
        poster.pubkey(),
        task_id,
        core.event_authority,
        &[(application, agent.pubkey())],
    );
    ctx.send_transaction(refund_ix, &[&anyone])
        .expect("refund_expired should succeed");

    let (task_pda, _) = find_task_pda(task_id);
    let task = get_task(&ctx, &task_pda);
    assert_eq!(task.state, TaskState::Refunded);
    assert_eq!(
        get_lamports(&ctx, &agent.pubkey()) - agent_before_refund,
        1_000
    );
}
