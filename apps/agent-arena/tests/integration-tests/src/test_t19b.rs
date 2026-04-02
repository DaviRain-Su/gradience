use crate::{
    fixtures::{
        apply_for_task, initialize_program, post_task_sol, submit_result,
    },
    utils::{
        assert_program_error, find_application_pda, find_escrow_pda, find_reputation_pda,
        find_submission_pda, find_task_pda, get_application, get_escrow, get_reputation,
        get_submission, get_task, TestContext,
    },
};
use gradience_client::{
    errors::GradienceError,
    instructions::SubmitResultBuilder,
    types::RuntimeEnvInput,
    GRADIENCE_ID,
};
use solana_sdk::signature::Signer;

#[test]
fn t19b_s1_apply_creates_application_and_updates_reputation_and_escrow() {
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
        3,
        1_500,
        40_000,
        now + 120,
        now + 240,
    );
    let (escrow_pda, _) = find_escrow_pda(task_id);

    apply_for_task(&mut ctx, &agent, task_id, core.event_authority);

    let escrow = get_escrow(&ctx, &escrow_pda);
    assert_eq!(escrow.amount, 41_500);

    let (application_pda, _) = find_application_pda(task_id, &agent.pubkey());
    let application = get_application(&ctx, &application_pda);
    assert_eq!(application.task_id, task_id);
    assert_eq!(application.agent, agent.pubkey().to_bytes());
    assert_eq!(application.stake_amount, 1_500);

    let (reputation_pda, _) = find_reputation_pda(&agent.pubkey());
    let reputation = get_reputation(&ctx, &reputation_pda);
    assert_eq!(reputation.global.total_applied, 1);

    let (task_pda, _) = find_task_pda(task_id);
    let task = get_task(&ctx, &task_pda);
    assert_eq!(task.submission_count, 0);
}

#[test]
fn t19b_s2_apply_across_multiple_tasks_accumulates_total_applied() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let agent = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);

    let now = ctx.get_current_timestamp();
    let task_0 = post_task_sol(
        &mut ctx,
        &poster,
        &core,
        0,
        judge.pubkey().to_bytes(),
        0,
        1_000,
        20_000,
        now + 120,
        now + 240,
    );
    let task_1 = post_task_sol(
        &mut ctx,
        &poster,
        &core,
        0,
        judge.pubkey().to_bytes(),
        1,
        2_000,
        30_000,
        now + 120,
        now + 240,
    );

    apply_for_task(&mut ctx, &agent, task_0, core.event_authority);
    ctx.warp_to_next_slot();
    apply_for_task(&mut ctx, &agent, task_1, core.event_authority);

    let (rep_pda, _) = find_reputation_pda(&agent.pubkey());
    let reputation = get_reputation(&ctx, &rep_pda);
    assert_eq!(reputation.global.total_applied, 2);
}

#[test]
fn t19b_s3_submit_overwrite_does_not_double_count_and_updates_payload() {
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
    submit_result(&mut ctx, &agent, task_id, core.event_authority, "v1");
    let (task_pda, _) = find_task_pda(task_id);
    let (submission_pda, _) = find_submission_pda(task_id, &agent.pubkey());
    let first_submission = get_submission(&ctx, &submission_pda);
    let first_task = get_task(&ctx, &task_pda);
    assert_eq!(first_task.submission_count, 1);

    ctx.warp_to_next_slot();
    submit_result(&mut ctx, &agent, task_id, core.event_authority, "v2");
    let second_submission = get_submission(&ctx, &submission_pda);
    let second_task = get_task(&ctx, &task_pda);
    assert_eq!(second_task.submission_count, 1);
    assert_eq!(second_submission.result_ref, "ar://result-v2");
    assert_eq!(second_submission.trace_ref, "ar://trace-v2");
    assert!(second_submission.submission_slot > first_submission.submission_slot);
}

#[test]
fn t19b_s4_submit_two_agents_increments_submission_count_to_two() {
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

    submit_result(&mut ctx, &agent_a, task_id, core.event_authority, "a-1");
    let (task_pda, _) = find_task_pda(task_id);
    let task_after_a = get_task(&ctx, &task_pda);
    assert_eq!(task_after_a.submission_count, 1);

    ctx.warp_to_next_slot();
    submit_result(&mut ctx, &agent_b, task_id, core.event_authority, "b-1");
    let task_after_b = get_task(&ctx, &task_pda);
    assert_eq!(task_after_b.submission_count, 2);
}

#[test]
fn t19b_s5_submit_rejected_after_deadline() {
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
        20_000,
        now + 1,
        now + 200,
    );
    apply_for_task(&mut ctx, &agent, task_id, core.event_authority);

    ctx.warp_to_timestamp(now + 2);
    let ix = build_submit_result_ix(
        &agent.pubkey(),
        task_id,
        core.event_authority,
        "late",
        runtime_env("openai", "gpt-4.1", "opencloud", "20260402"),
    );
    let err = ctx.send_transaction_expect_error(ix, &[&agent]);
    assert_program_error(err, GradienceError::DeadlinePassed);
}

#[test]
fn t19b_s6_submit_rejects_invalid_runtime_env() {
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
        20_000,
        now + 200,
        now + 400,
    );
    apply_for_task(&mut ctx, &agent, task_id, core.event_authority);

    let ix = build_submit_result_ix(
        &agent.pubkey(),
        task_id,
        core.event_authority,
        "invalid-runtime",
        runtime_env("", "gpt-4.1", "opencloud", "20260402"),
    );
    let err = ctx.send_transaction_expect_error(ix, &[&agent]);
    assert_program_error(err, GradienceError::InvalidRuntimeEnv);
}

fn runtime_env(provider: &str, model: &str, runtime: &str, version: &str) -> RuntimeEnvInput {
    RuntimeEnvInput {
        provider: provider.to_string(),
        model: model.to_string(),
        runtime: runtime.to_string(),
        version: version.to_string(),
    }
}

fn build_submit_result_ix(
    agent: &solana_sdk::pubkey::Pubkey,
    task_id: u64,
    event_authority: solana_sdk::pubkey::Pubkey,
    suffix: &str,
    runtime_env: RuntimeEnvInput,
) -> solana_sdk::instruction::Instruction {
    let (task, _) = find_task_pda(task_id);
    let (application, _) = find_application_pda(task_id, agent);
    let (submission, _) = find_submission_pda(task_id, agent);

    SubmitResultBuilder::new()
        .agent(*agent)
        .task(task)
        .application(application)
        .submission(submission)
        .event_authority(event_authority)
        .gradience_program(GRADIENCE_ID)
        .result_ref(format!("ar://result-{suffix}"))
        .trace_ref(format!("ar://trace-{suffix}"))
        .runtime_env(runtime_env)
        .instruction()
}
