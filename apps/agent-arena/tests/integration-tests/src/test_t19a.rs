use crate::{
    fixtures::{initialize_program, post_task_sol, register_judge},
    utils::{find_task_pda, get_judge_pool, get_program_config, get_task, TestContext},
};
use solana_sdk::signature::Signer;

#[test]
fn t19a_initialize_and_post_task_sol_designated_and_pool() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge_a = ctx.create_funded_keypair();
    let judge_b = ctx.create_funded_keypair();

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
        2_000_000_000,
    );

    let now = ctx.get_current_timestamp();
    let designated_task_id = post_task_sol(
        &mut ctx,
        &poster,
        &core,
        0,
        judge_a.pubkey().to_bytes(),
        0,
        1_000,
        10_000,
        now + 1_000,
        now + 2_000,
    );
    let (designated_task, _) = find_task_pda(designated_task_id);
    let designated = get_task(&ctx, &designated_task);
    assert_eq!(designated.judge, judge_a.pubkey().to_bytes());

    let pool_task_id = post_task_sol(
        &mut ctx,
        &poster,
        &core,
        1,
        [0u8; 32],
        0,
        1_000,
        12_000,
        now + 1_000,
        now + 2_000,
    );
    let (pool_task, _) = find_task_pda(pool_task_id);
    let pooled = get_task(&ctx, &pool_task);
    let pooled_judge = pooled.judge;
    assert!(
        pooled_judge == judge_a.pubkey().to_bytes() || pooled_judge == judge_b.pubkey().to_bytes(),
        "pooled judge must come from category pool"
    );

    let config = get_program_config(&ctx, &core.config);
    assert_eq!(config.task_count, 2);

    let (pool0, _) = crate::utils::find_judge_pool_pda(0);
    let judge_pool = get_judge_pool(&ctx, &pool0);
    assert_eq!(judge_pool.entries.len(), 2);
}
