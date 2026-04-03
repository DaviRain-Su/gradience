use gradience::constants::FORCE_REFUND_DELAY;
use gradience::state::TaskState;
use solana_sdk::{instruction::InstructionError, signature::Signer};

use crate::{
    fixtures::{
        apply_for_task, build_force_refund_ix, initialize_program, post_task_sol, register_judge,
        submit_result,
    },
    utils::{
        assert_instruction_error, find_application_pda, find_judge_pool_pda, find_stake_pda,
        find_task_pda, get_lamports, get_stake, get_task, TestContext,
    },
};

#[test]
fn t66_force_refund_slash_and_agent_stake_transfers_are_precise() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let anyone = ctx.create_funded_keypair();
    let agent_a = ctx.create_funded_keypair();
    let agent_b = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);
    let stake_pda = register_judge(
        &mut ctx,
        &judge,
        core.config,
        core.event_authority,
        vec![0],
        5_000_000_000,
    );

    let now = ctx.get_current_timestamp();
    let reward = 100_000;
    let min_stake = 1_000;
    let task_id = post_task_sol(
        &mut ctx,
        &poster,
        &core,
        0,
        judge.pubkey().to_bytes(),
        0,
        min_stake,
        reward,
        now + 10,
        now + 20,
    );
    apply_for_task(&mut ctx, &agent_a, task_id, core.event_authority);
    apply_for_task(&mut ctx, &agent_b, task_id, core.event_authority);
    submit_result(&mut ctx, &agent_a, task_id, core.event_authority, "a");
    submit_result(&mut ctx, &agent_b, task_id, core.event_authority, "b");

    ctx.warp_to_timestamp(now + 20 + FORCE_REFUND_DELAY + 1);

    let poster_before = get_lamports(&ctx, &poster.pubkey());
    let agent_a_before = get_lamports(&ctx, &agent_a.pubkey());
    let agent_b_before = get_lamports(&ctx, &agent_b.pubkey());
    let treasury_before = get_lamports(&ctx, &core.treasury);

    let (pool0, _) = find_judge_pool_pda(0);
    let (app_a, _) = find_application_pda(task_id, &agent_a.pubkey());
    let (app_b, _) = find_application_pda(task_id, &agent_b.pubkey());
    let ix = build_force_refund_ix(
        &anyone,
        task_id,
        poster.pubkey(),
        agent_a.pubkey(),
        core.config,
        judge.pubkey(),
        core.treasury,
        core.event_authority,
        &[pool0],
        &[(app_a, agent_a.pubkey()), (app_b, agent_b.pubkey())],
    );
    ctx.send_transaction(ix, &[&anyone])
        .expect("force_refund should succeed");

    let (task_pda, _) = find_task_pda(task_id);
    let task = get_task(&ctx, &task_pda);
    assert_eq!(task.state, TaskState::Refunded);

    let poster_after = get_lamports(&ctx, &poster.pubkey());
    let agent_a_after = get_lamports(&ctx, &agent_a.pubkey());
    let agent_b_after = get_lamports(&ctx, &agent_b.pubkey());
    let treasury_after = get_lamports(&ctx, &core.treasury);

    let poster_share = reward * 95 / 100;
    let most_active_share = reward * 3 / 100;
    let protocol_fee = reward * 2 / 100;
    let slash = 1_000_000_000;

    assert_eq!(poster_after - poster_before, poster_share);
    assert_eq!(
        agent_a_after - agent_a_before,
        most_active_share + min_stake,
        "most_active agent should receive 3% reward plus stake refund"
    );
    assert_eq!(
        agent_b_after - agent_b_before,
        min_stake,
        "other agent should receive only stake refund"
    );
    assert_eq!(
        treasury_after - treasury_before,
        protocol_fee + slash,
        "treasury should receive protocol fee plus judge slash"
    );

    let stake = get_stake(&ctx, &stake_pda);
    assert_eq!(
        stake.amount, 4_000_000_000,
        "judge stake should be slashed by min_judge_stake"
    );
}

#[test]
fn t66_force_refund_rejects_when_most_active_not_in_refund_accounts() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let anyone = ctx.create_funded_keypair();
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
        5_000_000_000,
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
        now + 10,
        now + 20,
    );
    apply_for_task(&mut ctx, &agent_a, task_id, core.event_authority);
    apply_for_task(&mut ctx, &agent_b, task_id, core.event_authority);
    submit_result(&mut ctx, &agent_a, task_id, core.event_authority, "a");
    submit_result(&mut ctx, &agent_b, task_id, core.event_authority, "b");
    ctx.warp_to_timestamp(now + 20 + FORCE_REFUND_DELAY + 1);

    let (pool0, _) = find_judge_pool_pda(0);
    let (app_b, _) = find_application_pda(task_id, &agent_b.pubkey());
    let ix = build_force_refund_ix(
        &anyone,
        task_id,
        poster.pubkey(),
        agent_a.pubkey(),
        core.config,
        judge.pubkey(),
        core.treasury,
        core.event_authority,
        &[pool0],
        &[(app_b, agent_b.pubkey())],
    );

    let err = ctx.send_transaction_expect_error(ix, &[&anyone]);
    assert_instruction_error(err, InstructionError::InvalidInstructionData);

    let (task_pda, _) = find_task_pda(task_id);
    let task = get_task(&ctx, &task_pda);
    assert_eq!(
        task.state,
        TaskState::Open,
        "failed force_refund should keep task state unchanged"
    );

    let (stake_pda, _) = find_stake_pda(&judge.pubkey());
    let stake = get_stake(&ctx, &stake_pda);
    assert_eq!(
        stake.amount, 5_000_000_000,
        "failed transaction should not slash judge stake"
    );
}
