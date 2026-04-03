use gradience::constants::MAX_JUDGES_PER_POOL;
use gradience::state::TaskState;
use gradience_client::{instructions::RegisterJudgeBuilder, errors::GradienceError, GRADIENCE_ID};
use solana_sdk::{instruction::AccountMeta, signature::Signer};

use crate::{
    fixtures::{
        apply_for_task, build_judge_and_pay_ix, initialize_program, post_task_sol, register_judge,
        submit_result,
    },
    utils::{
        assert_program_error, find_application_pda, find_judge_pool_pda, find_reputation_pda,
        find_stake_pda, find_task_pda, get_lamports, get_task, TestContext,
    },
};

#[test]
fn t65_pool_mode_settlement_with_multiple_applicants() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge_a = ctx.create_funded_keypair();
    let judge_b = ctx.create_funded_keypair();
    let judge_c = ctx.create_funded_keypair();
    let agents: Vec<_> = (0..2).map(|_| ctx.create_funded_keypair()).collect();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);
    register_judge(
        &mut ctx,
        &judge_a,
        core.config,
        core.event_authority,
        vec![0],
        2_000_000_000,
    );
    register_judge(
        &mut ctx,
        &judge_b,
        core.config,
        core.event_authority,
        vec![0],
        3_000_000_000,
    );
    register_judge(
        &mut ctx,
        &judge_c,
        core.config,
        core.event_authority,
        vec![0],
        4_000_000_000,
    );

    let now = ctx.get_current_timestamp();
    let reward = 120_000;
    let min_stake = 1_000;
    let task_id = post_task_sol(
        &mut ctx,
        &poster,
        &core,
        1,
        [0u8; 32],
        0,
        min_stake,
        reward,
        now + 1_000,
        now + 2_000,
    );

    let (task_pda, _) = find_task_pda(task_id);
    let pooled_task = get_task(&ctx, &task_pda);

    let selected_judge = if pooled_task.judge == judge_a.pubkey().to_bytes() {
        &judge_a
    } else if pooled_task.judge == judge_b.pubkey().to_bytes() {
        &judge_b
    } else if pooled_task.judge == judge_c.pubkey().to_bytes() {
        &judge_c
    } else {
        panic!("selected judge is not part of the category pool");
    };

    for (idx, agent) in agents.iter().enumerate() {
        apply_for_task(&mut ctx, agent, task_id, core.event_authority);
        submit_result(
            &mut ctx,
            agent,
            task_id,
            core.event_authority,
            &format!("pool-{idx}"),
        );
        ctx.warp_to_next_slot();
    }

    let winner = &agents[0];
    let winner_before = get_lamports(&ctx, &winner.pubkey());
    let judge_before = get_lamports(&ctx, &selected_judge.pubkey());
    let treasury_before = get_lamports(&ctx, &core.treasury);
    let loser_befores: Vec<(solana_sdk::pubkey::Pubkey, u64)> = agents
        .iter()
        .skip(1)
        .map(|agent| (agent.pubkey(), get_lamports(&ctx, &agent.pubkey())))
        .collect();

    let loser_pairs: Vec<(solana_sdk::pubkey::Pubkey, solana_sdk::pubkey::Pubkey)> = agents
        .iter()
        .skip(1)
        .map(|agent| {
            let (application, _) = find_application_pda(task_id, &agent.pubkey());
            (application, agent.pubkey())
        })
        .collect();

    let judge_ix = build_judge_and_pay_ix(
        selected_judge,
        task_id,
        winner.pubkey(),
        poster.pubkey(),
        core.treasury,
        core.event_authority,
        &loser_pairs,
        86,
    );
    ctx.send_transaction(judge_ix, &[selected_judge])
        .expect("pool judge settlement should succeed");

    let settled_task = get_task(&ctx, &task_pda);
    assert_eq!(settled_task.state, TaskState::Completed);
    assert_eq!(settled_task.winner, Some(winner.pubkey().to_bytes()));

    let winner_after = get_lamports(&ctx, &winner.pubkey());
    let judge_after = get_lamports(&ctx, &selected_judge.pubkey());
    let treasury_after = get_lamports(&ctx, &core.treasury);

    assert_eq!(
        winner_after - winner_before,
        (reward * 95 / 100) + min_stake,
        "winner should receive 95% payout plus stake refund"
    );
    assert_eq!(
        judge_after - judge_before,
        reward * 3 / 100,
        "selected pool judge should receive 3% fee"
    );
    assert_eq!(
        treasury_after - treasury_before,
        reward * 2 / 100,
        "treasury should receive 2% fee"
    );

    for (loser_pubkey, loser_before) in loser_befores {
        let loser_after = get_lamports(&ctx, &loser_pubkey);
        assert_eq!(
            loser_after - loser_before,
            min_stake,
            "loser stake should be refunded for {loser_pubkey}"
        );
    }
}

#[test]
fn t65_register_judge_rejects_pool_over_capacity() {
    let mut ctx = TestContext::new();
    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);

    for _ in 0..MAX_JUDGES_PER_POOL {
        let judge = ctx.create_funded_keypair();
        register_judge(
            &mut ctx,
            &judge,
            core.config,
            core.event_authority,
            vec![0],
            1_000_000_000,
        );
    }

    let extra_judge = ctx.create_funded_keypair();
    let (stake, _) = find_stake_pda(&extra_judge.pubkey());
    let (reputation, _) = find_reputation_pda(&extra_judge.pubkey());
    let (pool0, _) = find_judge_pool_pda(0);

    let mut builder = RegisterJudgeBuilder::new();
    builder
        .judge(extra_judge.pubkey())
        .config(core.config)
        .stake(stake)
        .reputation(reputation)
        .event_authority(core.event_authority)
        .gradience_program(GRADIENCE_ID)
        .categories(vec![0])
        .stake_amount(1_000_000_000);
    builder.add_remaining_account(AccountMeta::new(pool0, false));

    let err = ctx.send_transaction_expect_error(builder.instruction(), &[&extra_judge]);
    assert_program_error(err, GradienceError::JudgePoolFull);
}
