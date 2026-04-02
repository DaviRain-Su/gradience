use gradience::{constants::MIN_SCORE, state::TaskState};
use gradience_client::{
    instructions::{ApplyForTaskBuilder, PostTaskBuilder},
    GRADIENCE_ID,
};
use solana_sdk::{
    instruction::AccountMeta,
    signature::Signer,
};


use crate::{
    fixtures::{
        initialize_program, register_judge,
    },
    utils::{
        create_ata, create_mint, find_application_pda, find_escrow_pda, find_judge_pool_pda,
        find_reputation_pda, find_submission_pda, find_task_pda, get_application,
        get_associated_token_address, get_program_config, get_task, get_token_balance, mint_to,
        TestContext,
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID, SPL_TOKEN_PROGRAM_ID,
    },
};

fn post_task_spl(
    ctx: &mut TestContext,
    poster: &solana_sdk::signature::Keypair,
    core: &crate::fixtures::CorePdas,
    judge: [u8; 32],
    category: u8,
    min_stake: u64,
    reward: u64,
    deadline: i64,
    judge_deadline: i64,
    mint_pubkey: &solana_sdk::pubkey::Pubkey,
    poster_ata: &solana_sdk::pubkey::Pubkey,
) -> u64 {
    let config = get_program_config(ctx, &core.config);
    let task_id = config.task_count;

    let (task, _) = find_task_pda(task_id);
    let (escrow, _) = find_escrow_pda(task_id);
    let (judge_pool, _) = find_judge_pool_pda(category);
    let escrow_ata = get_associated_token_address(&escrow, mint_pubkey);

    let instruction = PostTaskBuilder::new()
        .poster(poster.pubkey())
        .config(core.config)
        .task(task)
        .escrow(escrow)
        .judge_pool(judge_pool)
        .event_authority(core.event_authority)
        .gradience_program(GRADIENCE_ID)
        .eval_ref(format!("ar://spl-task-{task_id}"))
        .deadline(deadline)
        .judge_deadline(judge_deadline)
        .judge_mode(0)
        .judge(judge)
        .category(category)
        .mint(mint_pubkey.to_bytes())
        .min_stake(min_stake)
        .reward(reward)
        .instruction();

    // SPL path: keep the optional token accounts (don't strip)
    // The builder generates accounts in order: base(8) + optional(5)
    // optional: poster_token_account, escrow_ata, mint, token_program, ata_program
    let mut accounts = instruction.accounts;
    // Replace the optional accounts with correct SPL ones
    if accounts.len() >= 13 {
        accounts[8] = AccountMeta::new(*poster_ata, false);
        accounts[9] = AccountMeta::new(escrow_ata, false);
        accounts[10] = AccountMeta::new_readonly(*mint_pubkey, false);
        accounts[11] = AccountMeta::new_readonly(SPL_TOKEN_PROGRAM_ID, false);
        accounts[12] = AccountMeta::new_readonly(SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID, false);
    }

    let spl_ix = solana_sdk::instruction::Instruction {
        program_id: instruction.program_id,
        accounts,
        data: instruction.data,
    };

    ctx.send_transaction(spl_ix, &[poster])
        .expect("post_task SPL should succeed");

    task_id
}

fn apply_for_task_spl(
    ctx: &mut TestContext,
    agent: &solana_sdk::signature::Keypair,
    task_id: u64,
    event_authority: solana_sdk::pubkey::Pubkey,
    mint_pubkey: &solana_sdk::pubkey::Pubkey,
    agent_ata: &solana_sdk::pubkey::Pubkey,
) {
    let (task, _) = find_task_pda(task_id);
    let (escrow, _) = find_escrow_pda(task_id);
    let (application, _) = find_application_pda(task_id, &agent.pubkey());
    let (reputation, _) = find_reputation_pda(&agent.pubkey());
    let escrow_ata = get_associated_token_address(&escrow, mint_pubkey);

    let instruction = ApplyForTaskBuilder::new()
        .agent(agent.pubkey())
        .task(task)
        .escrow(escrow)
        .application(application)
        .reputation(reputation)
        .event_authority(event_authority)
        .gradience_program(GRADIENCE_ID)
        .instruction();

    // SPL path: keep optional token accounts
    // optional: agent_token_account, escrow_ata, mint, token_program
    let mut accounts = instruction.accounts;
    if accounts.len() >= 12 {
        accounts[8] = AccountMeta::new(*agent_ata, false);
        accounts[9] = AccountMeta::new(escrow_ata, false);
        accounts[10] = AccountMeta::new_readonly(*mint_pubkey, false);
        accounts[11] = AccountMeta::new_readonly(SPL_TOKEN_PROGRAM_ID, false);
    }

    let spl_ix = solana_sdk::instruction::Instruction {
        program_id: instruction.program_id,
        accounts,
        data: instruction.data,
    };

    ctx.send_transaction(spl_ix, &[agent])
        .expect("apply_for_task SPL should succeed");
}

fn submit_result_spl(
    ctx: &mut TestContext,
    agent: &solana_sdk::signature::Keypair,
    task_id: u64,
    event_authority: solana_sdk::pubkey::Pubkey,
    suffix: &str,
) {
    // submit_result doesn't touch tokens, reuse SOL version
    crate::fixtures::submit_result(ctx, agent, task_id, event_authority, suffix);
}

fn build_judge_and_pay_spl_ix(
    judge: &solana_sdk::signature::Keypair,
    task_id: u64,
    winner: solana_sdk::pubkey::Pubkey,
    poster: solana_sdk::pubkey::Pubkey,
    treasury: solana_sdk::pubkey::Pubkey,
    event_authority: solana_sdk::pubkey::Pubkey,
    loser_pairs: &[(solana_sdk::pubkey::Pubkey, solana_sdk::pubkey::Pubkey)],
    score: u8,
    mint_pubkey: &solana_sdk::pubkey::Pubkey,
) -> solana_sdk::instruction::Instruction {
    let (task, _) = find_task_pda(task_id);
    let (escrow, _) = find_escrow_pda(task_id);
    let (winner_application, _) = find_application_pda(task_id, &winner);
    let (winner_submission, _) = find_submission_pda(task_id, &winner);
    let (winner_reputation, _) = find_reputation_pda(&winner);
    let (judge_stake, _) = crate::utils::find_stake_pda(&judge.pubkey());

    let escrow_ata = get_associated_token_address(&escrow, mint_pubkey);
    let winner_ata = get_associated_token_address(&winner, mint_pubkey);
    let poster_ata = get_associated_token_address(&poster, mint_pubkey);
    let judge_ata = get_associated_token_address(&judge.pubkey(), mint_pubkey);
    let treasury_ata_addr = get_associated_token_address(&treasury, mint_pubkey);

    // Use the Codama builder with all SPL optional accounts set
    let mut builder = gradience_client::instructions::JudgeAndPayBuilder::new();
    builder
        .judge(judge.pubkey())
        .task(task)
        .escrow(escrow)
        .poster_account(poster)
        .winner_account(winner)
        .winner_application(winner_application)
        .winner_submission(winner_submission)
        .winner_reputation(winner_reputation)
        .judge_stake(judge_stake)
        .treasury(treasury)
        .event_authority(event_authority)
        .gradience_program(GRADIENCE_ID)
        .judge_token_account(Some(judge_ata))
        .escrow_ata(Some(escrow_ata))
        .winner_token_account(Some(winner_ata))
        .poster_token_account(Some(poster_ata))
        .treasury_ata(Some(treasury_ata_addr))
        .mint_account(Some(*mint_pubkey))
        .token_program(Some(SPL_TOKEN_PROGRAM_ID))
        .associated_token_program(Some(SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID))
        .winner(winner.to_bytes())
        .score(score);

    // Add loser remaining accounts (application PDA + loser ATA)
    for (application, agent_pubkey) in loser_pairs {
        builder.add_remaining_account(AccountMeta::new(*application, false));
        let loser_ata = get_associated_token_address(agent_pubkey, mint_pubkey);
        builder.add_remaining_account(AccountMeta::new(loser_ata, false));
    }

    builder.instruction()
}

// ── SPL Token full lifecycle test ──────────────────────────────────────

#[test]
fn t56_spl_full_lifecycle_post_apply_submit_judge() {
    let mut ctx = TestContext::new();
    let mint_authority = ctx.create_funded_keypair();
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

    // Create SPL mint (6 decimals)
    let mint_kp = create_mint(&mut ctx, &mint_authority.pubkey(), 6);
    let mint_pubkey = mint_kp.pubkey();

    // Create ATAs and fund poster
    let poster_ata = create_ata(&mut ctx, &poster.pubkey(), &mint_pubkey);
    let agent_a_ata = create_ata(&mut ctx, &agent_a.pubkey(), &mint_pubkey);
    let agent_b_ata = create_ata(&mut ctx, &agent_b.pubkey(), &mint_pubkey);
    create_ata(&mut ctx, &judge.pubkey(), &mint_pubkey);
    create_ata(&mut ctx, &core.treasury, &mint_pubkey);

    let reward = 1_000_000; // 1.0 token
    let min_stake = 100_000; // 0.1 token
    mint_to(&mut ctx, &mint_pubkey, &poster_ata, &mint_authority, reward);
    mint_to(&mut ctx, &mint_pubkey, &agent_a_ata, &mint_authority, min_stake);
    mint_to(&mut ctx, &mint_pubkey, &agent_b_ata, &mint_authority, min_stake);

    let now = ctx.get_current_timestamp();

    // Post task with SPL
    let task_id = post_task_spl(
        &mut ctx,
        &poster,
        &core,
        judge.pubkey().to_bytes(),
        0,
        min_stake,
        reward,
        now + 1_000,
        now + 2_000,
        &mint_pubkey,
        &poster_ata,
    );

    // Verify poster's ATA was debited
    assert_eq!(get_token_balance(&ctx, &poster_ata), 0);

    // Verify escrow ATA has the reward
    let (escrow, _) = find_escrow_pda(task_id);
    let escrow_ata = get_associated_token_address(&escrow, &mint_pubkey);
    assert_eq!(get_token_balance(&ctx, &escrow_ata), reward);

    // Apply with SPL tokens
    apply_for_task_spl(
        &mut ctx,
        &agent_a,
        task_id,
        core.event_authority,
        &mint_pubkey,
        &agent_a_ata,
    );
    apply_for_task_spl(
        &mut ctx,
        &agent_b,
        task_id,
        core.event_authority,
        &mint_pubkey,
        &agent_b_ata,
    );

    // Verify agent ATAs were debited
    assert_eq!(get_token_balance(&ctx, &agent_a_ata), 0);
    assert_eq!(get_token_balance(&ctx, &agent_b_ata), 0);

    // Escrow now has reward + 2 stakes
    assert_eq!(
        get_token_balance(&ctx, &escrow_ata),
        reward + min_stake * 2
    );

    // Submit
    submit_result_spl(&mut ctx, &agent_a, task_id, core.event_authority, "a");
    ctx.warp_to_next_slot();
    submit_result_spl(&mut ctx, &agent_b, task_id, core.event_authority, "b");

    // Judge (SPL path) with loser stake refund
    let (app_b, _) = find_application_pda(task_id, &agent_b.pubkey());
    let app_b_state = get_application(&ctx, &app_b);
    assert_eq!(app_b_state.task_id, task_id);
    assert_eq!(app_b_state.agent, agent_b.pubkey().to_bytes());
    assert_eq!(app_b_state.stake_amount, min_stake);
    let judge_ix = build_judge_and_pay_spl_ix(
        &judge,
        task_id,
        agent_a.pubkey(),
        poster.pubkey(),
        core.treasury,
        core.event_authority,
        &[(app_b, agent_b.pubkey())],
        80,
        &mint_pubkey,
    );
    ctx.send_transaction(judge_ix, &[&judge])
        .expect("judge_and_pay SPL should succeed");

    // Verify task state
    let (task_pda, _) = find_task_pda(task_id);
    let task = get_task(&ctx, &task_pda);
    assert_eq!(task.state, TaskState::Completed);

    // Verify token distribution (95/3/2 split)
    let winner_ata = get_associated_token_address(&agent_a.pubkey(), &mint_pubkey);
    let judge_ata = get_associated_token_address(&judge.pubkey(), &mint_pubkey);
    let treasury_ata = get_associated_token_address(&core.treasury, &mint_pubkey);

    let winner_payout = reward * 95 / 100; // 950_000
    let judge_fee = reward * 3 / 100; // 30_000
    let protocol_fee = reward * 2 / 100; // 20_000

    assert_eq!(
        get_token_balance(&ctx, &winner_ata),
        winner_payout + min_stake, // payout + stake refund
        "winner gets 95% reward + stake"
    );
    assert_eq!(
        get_token_balance(&ctx, &judge_ata),
        judge_fee,
        "judge gets 3%"
    );
    assert_eq!(
        get_token_balance(&ctx, &treasury_ata),
        protocol_fee,
        "treasury gets 2%"
    );
    assert_eq!(
        get_token_balance(&ctx, &agent_b_ata),
        min_stake,
        "loser stake refunded"
    );
}

#[test]
fn t56_spl_low_score_refunds_poster_and_stakes() {
    let mut ctx = TestContext::new();
    let mint_authority = ctx.create_funded_keypair();
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

    let mint_kp = create_mint(&mut ctx, &mint_authority.pubkey(), 6);
    let mint_pubkey = mint_kp.pubkey();
    let poster_ata = create_ata(&mut ctx, &poster.pubkey(), &mint_pubkey);
    let agent_a_ata = create_ata(&mut ctx, &agent_a.pubkey(), &mint_pubkey);
    let agent_b_ata = create_ata(&mut ctx, &agent_b.pubkey(), &mint_pubkey);
    let judge_ata = create_ata(&mut ctx, &judge.pubkey(), &mint_pubkey);
    let treasury_ata = create_ata(&mut ctx, &core.treasury, &mint_pubkey);

    let reward = 1_000_000;
    let min_stake = 100_000;
    mint_to(&mut ctx, &mint_pubkey, &poster_ata, &mint_authority, reward);
    mint_to(&mut ctx, &mint_pubkey, &agent_a_ata, &mint_authority, min_stake);
    mint_to(&mut ctx, &mint_pubkey, &agent_b_ata, &mint_authority, min_stake);

    let now = ctx.get_current_timestamp();
    let task_id = post_task_spl(
        &mut ctx,
        &poster,
        &core,
        judge.pubkey().to_bytes(),
        0,
        min_stake,
        reward,
        now + 1_000,
        now + 2_000,
        &mint_pubkey,
        &poster_ata,
    );

    apply_for_task_spl(
        &mut ctx,
        &agent_a,
        task_id,
        core.event_authority,
        &mint_pubkey,
        &agent_a_ata,
    );
    apply_for_task_spl(
        &mut ctx,
        &agent_b,
        task_id,
        core.event_authority,
        &mint_pubkey,
        &agent_b_ata,
    );
    submit_result_spl(&mut ctx, &agent_a, task_id, core.event_authority, "a");
    ctx.warp_to_next_slot();
    submit_result_spl(&mut ctx, &agent_b, task_id, core.event_authority, "b");

    let (app_b, _) = find_application_pda(task_id, &agent_b.pubkey());
    let judge_ix = build_judge_and_pay_spl_ix(
        &judge,
        task_id,
        agent_a.pubkey(),
        poster.pubkey(),
        core.treasury,
        core.event_authority,
        &[(app_b, agent_b.pubkey())],
        MIN_SCORE - 1,
        &mint_pubkey,
    );
    ctx.send_transaction(judge_ix, &[&judge])
        .expect("judge_and_pay SPL low score should succeed");

    let (task_pda, _) = find_task_pda(task_id);
    let task = get_task(&ctx, &task_pda);
    assert_eq!(task.state, TaskState::Refunded);
    assert_eq!(task.winner, None);

    let escrow_ata = get_associated_token_address(&find_escrow_pda(task_id).0, &mint_pubkey);
    assert_eq!(get_token_balance(&ctx, &escrow_ata), 0, "escrow drained on refund");
    assert_eq!(
        get_token_balance(&ctx, &poster_ata),
        reward,
        "poster should recover full reward",
    );
    assert_eq!(
        get_token_balance(&ctx, &agent_a_ata),
        min_stake,
        "agent_a stake refunded",
    );
    assert_eq!(
        get_token_balance(&ctx, &agent_b_ata),
        min_stake,
        "agent_b stake refunded",
    );
    assert_eq!(get_token_balance(&ctx, &judge_ata), 0, "judge fee should be zero");
    assert_eq!(
        get_token_balance(&ctx, &treasury_ata),
        0,
        "treasury fee should be zero",
    );
}
