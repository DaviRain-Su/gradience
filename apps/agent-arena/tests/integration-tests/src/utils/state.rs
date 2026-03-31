use borsh::BorshDeserialize;
use gradience::state::{
    ACCOUNT_VERSION_V1, APPLICATION_DISCRIMINATOR, ESCROW_DISCRIMINATOR,
    JUDGE_POOL_DISCRIMINATOR, PROGRAM_CONFIG_DISCRIMINATOR, REPUTATION_DISCRIMINATOR,
    STAKE_DISCRIMINATOR, SUBMISSION_DISCRIMINATOR, TASK_DISCRIMINATOR, Application, Escrow,
    JudgePool, ProgramConfig, Reputation, Stake, Submission, Task,
};

use crate::utils::TestContext;

fn decode_with_header<T: BorshDeserialize>(data: &[u8], discriminator: u8, label: &str) -> T {
    assert!(data.len() >= 2, "{label}: account data too short");
    assert_eq!(data[0], discriminator, "{label}: discriminator mismatch");
    assert_eq!(data[1], ACCOUNT_VERSION_V1, "{label}: version mismatch");
    let mut cursor = &data[2..];
    T::deserialize(&mut cursor).expect("borsh decode failed")
}

pub fn get_program_config(ctx: &TestContext, address: &solana_sdk::pubkey::Pubkey) -> ProgramConfig {
    let account = ctx
        .get_account(address)
        .unwrap_or_else(|| panic!("ProgramConfig {address} missing"));
    decode_with_header(&account.data, PROGRAM_CONFIG_DISCRIMINATOR, "ProgramConfig")
}

pub fn get_task(ctx: &TestContext, address: &solana_sdk::pubkey::Pubkey) -> Task {
    let account = ctx
        .get_account(address)
        .unwrap_or_else(|| panic!("Task {address} missing"));
    decode_with_header(&account.data, TASK_DISCRIMINATOR, "Task")
}

pub fn get_escrow(ctx: &TestContext, address: &solana_sdk::pubkey::Pubkey) -> Escrow {
    let account = ctx
        .get_account(address)
        .unwrap_or_else(|| panic!("Escrow {address} missing"));
    decode_with_header(&account.data, ESCROW_DISCRIMINATOR, "Escrow")
}

pub fn get_application(ctx: &TestContext, address: &solana_sdk::pubkey::Pubkey) -> Application {
    let account = ctx
        .get_account(address)
        .unwrap_or_else(|| panic!("Application {address} missing"));
    decode_with_header(&account.data, APPLICATION_DISCRIMINATOR, "Application")
}

pub fn get_submission(ctx: &TestContext, address: &solana_sdk::pubkey::Pubkey) -> Submission {
    let account = ctx
        .get_account(address)
        .unwrap_or_else(|| panic!("Submission {address} missing"));
    decode_with_header(&account.data, SUBMISSION_DISCRIMINATOR, "Submission")
}

pub fn get_reputation(ctx: &TestContext, address: &solana_sdk::pubkey::Pubkey) -> Reputation {
    let account = ctx
        .get_account(address)
        .unwrap_or_else(|| panic!("Reputation {address} missing"));
    decode_with_header(&account.data, REPUTATION_DISCRIMINATOR, "Reputation")
}

pub fn get_stake(ctx: &TestContext, address: &solana_sdk::pubkey::Pubkey) -> Stake {
    let account = ctx
        .get_account(address)
        .unwrap_or_else(|| panic!("Stake {address} missing"));
    decode_with_header(&account.data, STAKE_DISCRIMINATOR, "Stake")
}

pub fn get_judge_pool(ctx: &TestContext, address: &solana_sdk::pubkey::Pubkey) -> JudgePool {
    let account = ctx
        .get_account(address)
        .unwrap_or_else(|| panic!("JudgePool {address} missing"));
    decode_with_header(&account.data, JUDGE_POOL_DISCRIMINATOR, "JudgePool")
}

pub fn get_lamports(ctx: &TestContext, address: &solana_sdk::pubkey::Pubkey) -> u64 {
    ctx.get_account(address).map(|a| a.lamports).unwrap_or(0)
}
