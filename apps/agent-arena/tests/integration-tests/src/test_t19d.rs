use gradience::constants::FORCE_REFUND_DELAY;
use gradience::state::TaskState;
use gradience_client::{
    errors::GradienceError,
    instructions::RegisterJudgeBuilder,
    GRADIENCE_ID,
};
use solana_sdk::instruction::AccountMeta;
use solana_sdk::signature::Signer;

use crate::{
    fixtures::{
        apply_for_task, build_force_refund_ix, build_upgrade_config_ix, initialize_program,
        post_task_sol, register_judge, submit_result,
    },
    utils::{
        assert_instruction_error, assert_program_error, find_application_pda, find_judge_pool_pda,
        find_reputation_pda, find_stake_pda, find_task_pda, get_judge_pool, get_lamports,
        get_program_config, get_stake, get_task, TestContext,
    },
};
use solana_sdk::instruction::InstructionError;

#[test]
fn t19d_s1_force_refund_judge_kept_in_pool_when_stake_sufficient() {
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

    let poster_before = get_lamports(&ctx, &poster.pubkey());
    let agent_a_before = get_lamports(&ctx, &agent_a.pubkey());
    let agent_b_before = get_lamports(&ctx, &agent_b.pubkey());
    let treasury_before = get_lamports(&ctx, &core.treasury);

    ctx.warp_to_timestamp(now + 20 + FORCE_REFUND_DELAY + 1);

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
    assert_eq!(task.winner, None);

    let stake = get_stake(&ctx, &stake_pda);
    assert_eq!(stake.amount, 4_000_000_000);
    let pool = get_judge_pool(&ctx, &pool0);
    assert!(pool.entries.iter().any(|entry| entry.judge == judge.pubkey().to_bytes()));
    assert_eq!(get_lamports(&ctx, &poster.pubkey()) - poster_before, 95_000);
    assert_eq!(get_lamports(&ctx, &agent_a.pubkey()) - agent_a_before, 4_000);
    assert_eq!(get_lamports(&ctx, &agent_b.pubkey()) - agent_b_before, 1_000);
    assert_eq!(get_lamports(&ctx, &core.treasury) - treasury_before, 1_000_002_000);
}

#[test]
fn t19d_s2_force_refund_removes_judge_when_stake_insufficient() {
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
        1_000_000_000,
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
    apply_for_task(&mut ctx, &agent, task_id, core.event_authority);
    submit_result(&mut ctx, &agent, task_id, core.event_authority, "a");

    ctx.warp_to_timestamp(now + 20 + FORCE_REFUND_DELAY + 1);
    let (pool0, _) = find_judge_pool_pda(0);
    let (application, _) = find_application_pda(task_id, &agent.pubkey());
    let ix = build_force_refund_ix(
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
    ctx.send_transaction(ix, &[&anyone])
        .expect("force_refund should succeed");

    let (stake_pda, _) = find_stake_pda(&judge.pubkey());
    assert!(
        ctx.get_account(&stake_pda).is_none(),
        "stake account should be closed when judge is removed"
    );
    let pool = get_judge_pool(&ctx, &pool0);
    assert!(!pool.entries.iter().any(|entry| entry.judge == judge.pubkey().to_bytes()));
}

#[test]
fn t19d_s3_upgrade_config_updates_min_stake_and_enforces_authority() {
    let mut ctx = TestContext::new();
    let upgrade_authority = ctx.create_funded_keypair();
    let unauthorized = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();

    let core = initialize_program(&mut ctx, &upgrade_authority.pubkey(), 1_000_000_000);

    let unauthorized_ix =
        build_upgrade_config_ix(&unauthorized, core.config, None, Some(2_000_000_000));
    let unauthorized_err = ctx.send_transaction_expect_error(unauthorized_ix, &[&unauthorized]);
    assert_program_error(unauthorized_err, GradienceError::NotUpgradeAuthority);

    let upgrade_ix = build_upgrade_config_ix(
        &upgrade_authority,
        core.config,
        Some(ctx.create_funded_keypair().pubkey()),
        Some(2_000_000_000),
    );
    ctx.send_transaction(upgrade_ix, &[&upgrade_authority])
        .expect("upgrade_config should succeed");

    let config = get_program_config(&ctx, &core.config);
    assert_eq!(config.min_judge_stake, 2_000_000_000);

    let (stake, _) = find_stake_pda(&judge.pubkey());
    let (reputation, _) = find_reputation_pda(&judge.pubkey());
    let mut register_builder = RegisterJudgeBuilder::new();
    register_builder
        .judge(judge.pubkey())
        .config(core.config)
        .stake(stake)
        .reputation(reputation)
        .event_authority(core.event_authority)
        .gradience_program(GRADIENCE_ID)
        .categories(vec![0])
        .stake_amount(1_500_000_000);
    let (pool0, _) = find_judge_pool_pda(0);
    register_builder.add_remaining_account(AccountMeta::new(pool0, false));
    let register_err =
        ctx.send_transaction_expect_error(register_builder.instruction(), &[&judge]);
    assert_program_error(register_err, GradienceError::InsufficientJudgeStake);
}

#[test]
fn t19d_s4_force_refund_rejects_when_no_submissions() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let anyone = ctx.create_funded_keypair();
    let placeholder_agent = ctx.create_funded_keypair();

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
        now + 10,
        now + 20,
    );

    ctx.warp_to_timestamp(now + 20 + FORCE_REFUND_DELAY + 1);
    let (pool0, _) = find_judge_pool_pda(0);
    let ix = build_force_refund_ix(
        &anyone,
        task_id,
        poster.pubkey(),
        placeholder_agent.pubkey(),
        core.config,
        judge.pubkey(),
        core.treasury,
        core.event_authority,
        &[pool0],
        &[],
    );
    let err = ctx.send_transaction_expect_error(ix, &[&anyone]);
    assert_program_error(err, GradienceError::NoSubmissions);
}

#[test]
fn t19d_s5_force_refund_rejects_before_delay_window() {
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
        now + 10,
        now + 20,
    );
    apply_for_task(&mut ctx, &agent, task_id, core.event_authority);
    submit_result(&mut ctx, &agent, task_id, core.event_authority, "a");

    ctx.warp_to_timestamp(now + 21);
    let (pool0, _) = find_judge_pool_pda(0);
    let (application, _) = find_application_pda(task_id, &agent.pubkey());
    let ix = build_force_refund_ix(
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
    let err = ctx.send_transaction_expect_error(ix, &[&anyone]);
    assert_program_error(err, GradienceError::ForceRefundDelayNotPassed);
}

#[test]
fn t19d_s6_force_refund_rejects_when_most_active_not_in_refund_accounts() {
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
}
