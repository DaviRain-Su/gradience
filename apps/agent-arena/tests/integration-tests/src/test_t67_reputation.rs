use gradience::state::TaskState;
use solana_sdk::signature::Signer;

use crate::{
    fixtures::{
        apply_for_task, build_judge_and_pay_ix, initialize_program, post_task_sol, register_judge,
        submit_result,
    },
    utils::{find_application_pda, find_reputation_pda, find_task_pda, get_reputation, get_task, TestContext},
};

#[test]
fn t67_reputation_by_category_all_8_categories_are_consistent() {
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
        (0u8..8u8).collect(),
        2_000_000_000,
    );

    let now = ctx.get_current_timestamp();
    let mut score_sum = 0u64;

    for category in 0u8..8u8 {
        let task_id = post_task_sol(
            &mut ctx,
            &poster,
            &core,
            0,
            judge.pubkey().to_bytes(),
            category,
            1_000,
            20_000,
            now + 1_000 + category as i64,
            now + 2_000 + category as i64,
        );
        apply_for_task(&mut ctx, &agent, task_id, core.event_authority);
        submit_result(
            &mut ctx,
            &agent,
            task_id,
            core.event_authority,
            &format!("cat-{category}"),
        );
        let score = 60 + category;
        score_sum += score as u64;
        let ix = build_judge_and_pay_ix(
            &judge,
            task_id,
            agent.pubkey(),
            poster.pubkey(),
            core.treasury,
            core.event_authority,
            &[],
            score,
        );
        ctx.send_transaction(ix, &[&judge])
            .expect("judge_and_pay should succeed for each category");

        let (task_pda, _) = find_task_pda(task_id);
        let task = get_task(&ctx, &task_pda);
        assert_eq!(task.state, TaskState::Completed);
    }

    let (rep_pda, _) = find_reputation_pda(&agent.pubkey());
    let reputation = get_reputation(&ctx, &rep_pda);
    assert_eq!(reputation.global.completed, 8);
    assert_eq!(reputation.global.total_applied, 8);
    assert_eq!(reputation.global.win_rate, 10_000);
    assert_eq!(
        reputation.global.avg_score as u64,
        (score_sum * 100) / 8,
        "global avg_score should match arithmetic mean in basis points"
    );

    for category in 0usize..8usize {
        let stats = &reputation.by_category[category];
        assert_eq!(stats.category as usize, category);
        assert_eq!(stats.completed, 1);
        assert_eq!(stats.avg_score, (60 + category as u8) as u16 * 100);
    }
}

#[test]
fn t67_ranking_metric_avg_score_times_win_rate_orders_agents() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let agent_high = ctx.create_funded_keypair();
    let agent_low = ctx.create_funded_keypair();

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

    // Task-1: high wins, low loses.
    let task1 = post_task_sol(
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
    apply_for_task(&mut ctx, &agent_high, task1, core.event_authority);
    apply_for_task(&mut ctx, &agent_low, task1, core.event_authority);
    submit_result(&mut ctx, &agent_high, task1, core.event_authority, "h1");
    ctx.warp_to_next_slot();
    submit_result(&mut ctx, &agent_low, task1, core.event_authority, "l1");
    let (low_app1, _) = find_application_pda(task1, &agent_low.pubkey());
    let ix1 = build_judge_and_pay_ix(
        &judge,
        task1,
        agent_high.pubkey(),
        poster.pubkey(),
        core.treasury,
        core.event_authority,
        &[(low_app1, agent_low.pubkey())],
        90,
    );
    ctx.send_transaction(ix1, &[&judge])
        .expect("task1 judge_and_pay should succeed");

    // Task-2: high wins again, low loses again.
    let task2 = post_task_sol(
        &mut ctx,
        &poster,
        &core,
        0,
        judge.pubkey().to_bytes(),
        0,
        1_000,
        50_000,
        now + 1_100,
        now + 2_100,
    );
    apply_for_task(&mut ctx, &agent_high, task2, core.event_authority);
    apply_for_task(&mut ctx, &agent_low, task2, core.event_authority);
    submit_result(&mut ctx, &agent_high, task2, core.event_authority, "h2");
    ctx.warp_to_next_slot();
    submit_result(&mut ctx, &agent_low, task2, core.event_authority, "l2");
    let (low_app2, _) = find_application_pda(task2, &agent_low.pubkey());
    let ix2 = build_judge_and_pay_ix(
        &judge,
        task2,
        agent_high.pubkey(),
        poster.pubkey(),
        core.treasury,
        core.event_authority,
        &[(low_app2, agent_low.pubkey())],
        80,
    );
    ctx.send_transaction(ix2, &[&judge])
        .expect("task2 judge_and_pay should succeed");

    // Task-3: only low participates and wins.
    let task3 = post_task_sol(
        &mut ctx,
        &poster,
        &core,
        0,
        judge.pubkey().to_bytes(),
        0,
        1_000,
        50_000,
        now + 1_200,
        now + 2_200,
    );
    apply_for_task(&mut ctx, &agent_low, task3, core.event_authority);
    submit_result(&mut ctx, &agent_low, task3, core.event_authority, "l3");
    let ix3 = build_judge_and_pay_ix(
        &judge,
        task3,
        agent_low.pubkey(),
        poster.pubkey(),
        core.treasury,
        core.event_authority,
        &[],
        70,
    );
    ctx.send_transaction(ix3, &[&judge])
        .expect("task3 judge_and_pay should succeed");

    let (high_rep_pda, _) = find_reputation_pda(&agent_high.pubkey());
    let high_rep = get_reputation(&ctx, &high_rep_pda);
    let (low_rep_pda, _) = find_reputation_pda(&agent_low.pubkey());
    let low_rep = get_reputation(&ctx, &low_rep_pda);

    assert_eq!(high_rep.global.total_applied, 2);
    assert_eq!(high_rep.global.completed, 2);
    assert_eq!(high_rep.global.avg_score, 8_500);
    assert_eq!(high_rep.global.win_rate, 10_000);

    assert_eq!(low_rep.global.total_applied, 3);
    assert_eq!(low_rep.global.completed, 1);
    assert_eq!(low_rep.global.avg_score, 7_000);
    assert_eq!(low_rep.global.win_rate, 3_333);

    let high_rank = (high_rep.global.avg_score as u64) * (high_rep.global.win_rate as u64);
    let low_rank = (low_rep.global.avg_score as u64) * (low_rep.global.win_rate as u64);
    assert!(
        high_rank > low_rank,
        "avg_score × win_rate ranking should place high-performing agent first"
    );
}
