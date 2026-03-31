use crate::{
    fixtures::{apply_for_task, initialize_program, post_task_sol, submit_result},
    utils::{
        find_application_pda, find_escrow_pda, find_reputation_pda, find_task_pda, get_application,
        get_escrow, get_reputation, get_task, TestContext,
    },
};
use solana_sdk::signature::Signer;

#[test]
fn t19b_apply_and_submit_flow_updates_state() {
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
    let (escrow_pda, _) = find_escrow_pda(task_id);

    apply_for_task(&mut ctx, &agent_a, task_id, core.event_authority);
    apply_for_task(&mut ctx, &agent_b, task_id, core.event_authority);

    let escrow = get_escrow(&ctx, &escrow_pda);
    assert_eq!(escrow.amount, 52_000);

    let (app_a_pda, _) = find_application_pda(task_id, &agent_a.pubkey());
    let application_a = get_application(&ctx, &app_a_pda);
    assert_eq!(application_a.stake_amount, 1_000);

    let (reputation_a_pda, _) = find_reputation_pda(&agent_a.pubkey());
    let reputation_a = get_reputation(&ctx, &reputation_a_pda);
    assert_eq!(reputation_a.global.total_applied, 1);

    submit_result(&mut ctx, &agent_a, task_id, core.event_authority, "a-1");
    let (task_pda, _) = find_task_pda(task_id);
    let task_after_first_submit = get_task(&ctx, &task_pda);
    assert_eq!(task_after_first_submit.submission_count, 1);

    ctx.warp_to_next_slot();
    submit_result(&mut ctx, &agent_a, task_id, core.event_authority, "a-2");
    let task_after_overwrite = get_task(&ctx, &task_pda);
    assert_eq!(task_after_overwrite.submission_count, 1);

    ctx.warp_to_next_slot();
    submit_result(&mut ctx, &agent_b, task_id, core.event_authority, "b-1");
    let task_after_second_agent = get_task(&ctx, &task_pda);
    assert_eq!(task_after_second_agent.submission_count, 2);
}
