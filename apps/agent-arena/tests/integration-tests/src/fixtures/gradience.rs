use gradience_client::{
    instructions::{
        ApplyForTaskBuilder, CancelTaskBuilder, ForceRefundBuilder, InitializeBuilder,
        JudgeAndPayBuilder, PostTaskBuilder, RefundExpiredBuilder, RegisterJudgeBuilder,
        SubmitResultBuilder, UnstakeJudgeBuilder, UpgradeConfigBuilder,
    },
    types::RuntimeEnvInput,
    GRADIENCE_ID,
};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    signature::{Keypair, Signer},
};

use crate::utils::{
    find_application_pda, find_config_pda, find_escrow_pda, find_event_authority_pda,
    find_judge_pool_pda, find_reputation_pda, find_stake_pda, find_submission_pda, find_task_pda,
    find_treasury_pda, get_program_config, TestContext,
};

pub struct CorePdas {
    pub config: solana_sdk::pubkey::Pubkey,
    pub treasury: solana_sdk::pubkey::Pubkey,
    pub event_authority: solana_sdk::pubkey::Pubkey,
}

pub fn strip_optional_tail_pub(
    instruction: Instruction,
    base_account_count: usize,
    optional_account_count: usize,
) -> Instruction {
    strip_optional_tail(instruction, base_account_count, optional_account_count)
}

fn strip_optional_tail(
    mut instruction: Instruction,
    base_account_count: usize,
    optional_account_count: usize,
) -> Instruction {
    let optional_end = base_account_count + optional_account_count;
    if instruction.accounts.len() < optional_end {
        return instruction;
    }

    let mut accounts = Vec::with_capacity(instruction.accounts.len() - optional_account_count);
    accounts.extend_from_slice(&instruction.accounts[..base_account_count]);
    accounts.extend_from_slice(&instruction.accounts[optional_end..]);
    instruction.accounts = accounts;
    instruction
}

#[inline(always)]
pub fn pubkey_bytes(pubkey: &solana_sdk::pubkey::Pubkey) -> [u8; 32] {
    pubkey.to_bytes()
}

pub fn initialize_program(
    ctx: &mut TestContext,
    upgrade_authority: &solana_sdk::pubkey::Pubkey,
    min_judge_stake: u64,
) -> CorePdas {
    let (config, _) = find_config_pda();
    let (treasury, _) = find_treasury_pda();
    let (event_authority, _) = find_event_authority_pda();

    let instruction = InitializeBuilder::new()
        .payer(ctx.payer.pubkey())
        .config(config)
        .treasury(treasury)
        .upgrade_authority(*upgrade_authority.as_array())
        .min_judge_stake(min_judge_stake)
        .instruction();
    ctx.send_transaction(instruction, &[])
        .expect("initialize should succeed");

    CorePdas {
        config,
        treasury,
        event_authority,
    }
}

pub fn register_judge(
    ctx: &mut TestContext,
    judge: &Keypair,
    config: solana_sdk::pubkey::Pubkey,
    event_authority: solana_sdk::pubkey::Pubkey,
    categories: Vec<u8>,
    stake_amount: u64,
) -> solana_sdk::pubkey::Pubkey {
    let (stake, _) = find_stake_pda(&judge.pubkey());
    let (reputation, _) = find_reputation_pda(&judge.pubkey());

    let mut builder = RegisterJudgeBuilder::new();
    builder
        .judge(judge.pubkey())
        .config(config)
        .stake(stake)
        .reputation(reputation)
        .event_authority(event_authority)
        .gradience_program(GRADIENCE_ID)
        .categories(categories.clone())
        .stake_amount(stake_amount);

    for category in categories {
        let (pool, _) = find_judge_pool_pda(category);
        builder.add_remaining_account(AccountMeta::new(pool, false));
    }

    ctx.send_transaction(builder.instruction(), &[judge])
        .expect("register_judge should succeed");

    stake
}

pub fn post_task_sol(
    ctx: &mut TestContext,
    poster: &Keypair,
    core: &CorePdas,
    judge_mode: u8,
    judge: [u8; 32],
    category: u8,
    min_stake: u64,
    reward: u64,
    deadline: i64,
    judge_deadline: i64,
) -> u64 {
    let config = get_program_config(ctx, &core.config);
    let task_id = config.task_count;

    let (task, _) = find_task_pda(task_id);
    let (escrow, _) = find_escrow_pda(task_id);
    let (judge_pool, _) = find_judge_pool_pda(category);

    let instruction = PostTaskBuilder::new()
        .poster(poster.pubkey())
        .config(core.config)
        .task(task)
        .escrow(escrow)
        .judge_pool(judge_pool)
        .event_authority(core.event_authority)
        .gradience_program(GRADIENCE_ID)
        .eval_ref(format!("ar://task-{task_id}"))
        .deadline(deadline)
        .judge_deadline(judge_deadline)
        .judge_mode(judge_mode)
        .judge(judge)
        .category(category)
        .mint([0u8; 32])
        .min_stake(min_stake)
        .reward(reward)
        .instruction();
    let instruction = strip_optional_tail(instruction, 8, 5);
    ctx.send_transaction(instruction, &[poster])
        .expect("post_task should succeed");

    task_id
}

pub fn apply_for_task(
    ctx: &mut TestContext,
    agent: &Keypair,
    task_id: u64,
    event_authority: solana_sdk::pubkey::Pubkey,
) {
    let (task, _) = find_task_pda(task_id);
    let (escrow, _) = find_escrow_pda(task_id);
    let (application, _) = find_application_pda(task_id, &agent.pubkey());
    let (reputation, _) = find_reputation_pda(&agent.pubkey());

    let instruction = ApplyForTaskBuilder::new()
        .agent(agent.pubkey())
        .task(task)
        .escrow(escrow)
        .application(application)
        .reputation(reputation)
        .event_authority(event_authority)
        .gradience_program(GRADIENCE_ID)
        .instruction();
    let instruction = strip_optional_tail(instruction, 8, 4);
    ctx.send_transaction(instruction, &[agent])
        .expect("apply_for_task should succeed");
}

pub fn submit_result(
    ctx: &mut TestContext,
    agent: &Keypair,
    task_id: u64,
    event_authority: solana_sdk::pubkey::Pubkey,
    suffix: &str,
) {
    let (task, _) = find_task_pda(task_id);
    let (application, _) = find_application_pda(task_id, &agent.pubkey());
    let (submission, _) = find_submission_pda(task_id, &agent.pubkey());

    let runtime_env = RuntimeEnvInput {
        provider: "openai".to_string(),
        model: "gpt-4.1".to_string(),
        runtime: "opencloud".to_string(),
        version: "20260331".to_string(),
    };

    let instruction = SubmitResultBuilder::new()
        .agent(agent.pubkey())
        .task(task)
        .application(application)
        .submission(submission)
        .event_authority(event_authority)
        .gradience_program(GRADIENCE_ID)
        .result_ref(format!("ar://result-{suffix}"))
        .trace_ref(format!("ar://trace-{suffix}"))
        .runtime_env(runtime_env)
        .instruction();
    ctx.send_transaction(instruction, &[agent])
        .expect("submit_result should succeed");
}

pub fn build_judge_and_pay_ix(
    judge: &Keypair,
    task_id: u64,
    winner: solana_sdk::pubkey::Pubkey,
    poster: solana_sdk::pubkey::Pubkey,
    treasury: solana_sdk::pubkey::Pubkey,
    event_authority: solana_sdk::pubkey::Pubkey,
    loser_application_and_account_pairs: &[(solana_sdk::pubkey::Pubkey, solana_sdk::pubkey::Pubkey)],
    score: u8,
) -> Instruction {
    let (task, _) = find_task_pda(task_id);
    let (escrow, _) = find_escrow_pda(task_id);
    let (winner_application, _) = find_application_pda(task_id, &winner);
    let (winner_submission, _) = find_submission_pda(task_id, &winner);
    let (winner_reputation, _) = find_reputation_pda(&winner);
    let (judge_stake, _) = find_stake_pda(&judge.pubkey());

    let mut builder = JudgeAndPayBuilder::new();
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
        .winner(pubkey_bytes(&winner))
        .score(score);

    for (application, agent) in loser_application_and_account_pairs {
        builder.add_remaining_account(AccountMeta::new(*application, false));
        builder.add_remaining_account(AccountMeta::new(*agent, false));
    }

    strip_optional_tail(builder.instruction(), 13, 8)
}

pub fn build_cancel_task_ix(
    poster: &Keypair,
    task_id: u64,
    treasury: solana_sdk::pubkey::Pubkey,
    event_authority: solana_sdk::pubkey::Pubkey,
    application_and_agent_pairs: &[(solana_sdk::pubkey::Pubkey, solana_sdk::pubkey::Pubkey)],
) -> Instruction {
    let (task, _) = find_task_pda(task_id);
    let (escrow, _) = find_escrow_pda(task_id);
    let mut builder = CancelTaskBuilder::new();
    builder
        .poster(poster.pubkey())
        .task(task)
        .escrow(escrow)
        .treasury(treasury)
        .event_authority(event_authority)
        .gradience_program(GRADIENCE_ID);
    for (application, agent) in application_and_agent_pairs {
        builder.add_remaining_account(AccountMeta::new(*application, false));
        builder.add_remaining_account(AccountMeta::new(*agent, false));
    }
    strip_optional_tail(builder.instruction(), 7, 6)
}

pub fn build_refund_expired_ix(
    anyone: &Keypair,
    poster: solana_sdk::pubkey::Pubkey,
    task_id: u64,
    event_authority: solana_sdk::pubkey::Pubkey,
    application_and_agent_pairs: &[(solana_sdk::pubkey::Pubkey, solana_sdk::pubkey::Pubkey)],
) -> Instruction {
    let (task, _) = find_task_pda(task_id);
    let (escrow, _) = find_escrow_pda(task_id);
    let mut builder = RefundExpiredBuilder::new();
    builder
        .anyone(anyone.pubkey())
        .poster(Some(poster))
        .task(task)
        .escrow(escrow)
        .event_authority(event_authority)
        .gradience_program(GRADIENCE_ID);
    for (application, agent) in application_and_agent_pairs {
        builder.add_remaining_account(AccountMeta::new(*application, false));
        builder.add_remaining_account(AccountMeta::new(*agent, false));
    }
    strip_optional_tail(builder.instruction(), 7, 4)
}

pub fn build_force_refund_ix(
    anyone: &Keypair,
    task_id: u64,
    poster: solana_sdk::pubkey::Pubkey,
    most_active_agent: solana_sdk::pubkey::Pubkey,
    config: solana_sdk::pubkey::Pubkey,
    judge: solana_sdk::pubkey::Pubkey,
    treasury: solana_sdk::pubkey::Pubkey,
    event_authority: solana_sdk::pubkey::Pubkey,
    judge_pool_accounts: &[solana_sdk::pubkey::Pubkey],
    application_and_agent_pairs: &[(solana_sdk::pubkey::Pubkey, solana_sdk::pubkey::Pubkey)],
) -> Instruction {
    let (task, _) = find_task_pda(task_id);
    let (escrow, _) = find_escrow_pda(task_id);
    let (judge_stake, _) = find_stake_pda(&judge);
    let (judge_reputation, _) = find_reputation_pda(&judge);

    let mut builder = ForceRefundBuilder::new();
    builder
        .anyone(anyone.pubkey())
        .poster_account(poster)
        .most_active_agent(most_active_agent)
        .config(config)
        .task(task)
        .escrow(escrow)
        .judge_stake(judge_stake)
        .judge_account(judge)
        .judge_reputation(judge_reputation)
        .treasury(treasury)
        .event_authority(event_authority)
        .gradience_program(GRADIENCE_ID);

    for pool in judge_pool_accounts {
        builder.add_remaining_account(AccountMeta::new(*pool, false));
    }
    for (application, agent) in application_and_agent_pairs {
        builder.add_remaining_account(AccountMeta::new(*application, false));
        builder.add_remaining_account(AccountMeta::new(*agent, false));
    }

    strip_optional_tail(builder.instruction(), 13, 7)
}

pub fn build_unstake_judge_ix(
    judge: &Keypair,
    event_authority: solana_sdk::pubkey::Pubkey,
    categories: &[u8],
) -> Instruction {
    let (stake, _) = find_stake_pda(&judge.pubkey());
    let mut builder = UnstakeJudgeBuilder::new();
    builder
        .judge(judge.pubkey())
        .stake(stake)
        .event_authority(event_authority)
        .gradience_program(GRADIENCE_ID);
    for category in categories {
        let (pool, _) = find_judge_pool_pda(*category);
        builder.add_remaining_account(AccountMeta::new(pool, false));
    }
    builder.instruction()
}

pub fn build_upgrade_config_ix(
    authority: &Keypair,
    config: solana_sdk::pubkey::Pubkey,
    new_treasury: Option<solana_sdk::pubkey::Pubkey>,
    new_min_judge_stake: Option<u64>,
) -> Instruction {
    let mut builder = UpgradeConfigBuilder::new();
    builder.authority(authority.pubkey()).config(config);
    if let Some(treasury) = new_treasury {
        builder.new_treasury(pubkey_bytes(&treasury));
    }
    if let Some(min_stake) = new_min_judge_stake {
        builder.new_min_judge_stake(min_stake);
    }
    builder.instruction()
}
