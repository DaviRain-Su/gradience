use gradience_client::GRADIENCE_ID;
use solana_sdk::pubkey::Pubkey;

const TASK_SEED: &[u8] = b"task";
const ESCROW_SEED: &[u8] = b"escrow";
const APPLICATION_SEED: &[u8] = b"application";
const SUBMISSION_SEED: &[u8] = b"submission";
const REPUTATION_SEED: &[u8] = b"reputation";
const STAKE_SEED: &[u8] = b"stake";
const JUDGE_POOL_SEED: &[u8] = b"judge_pool";
const TREASURY_SEED: &[u8] = b"treasury";
const CONFIG_SEED: &[u8] = b"config";

pub fn find_task_pda(task_id: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[TASK_SEED, &task_id.to_le_bytes()], &GRADIENCE_ID)
}

pub fn find_escrow_pda(task_id: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[ESCROW_SEED, &task_id.to_le_bytes()], &GRADIENCE_ID)
}

pub fn find_application_pda(task_id: u64, agent: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[APPLICATION_SEED, &task_id.to_le_bytes(), agent.as_ref()],
        &GRADIENCE_ID,
    )
}

pub fn find_submission_pda(task_id: u64, agent: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[SUBMISSION_SEED, &task_id.to_le_bytes(), agent.as_ref()],
        &GRADIENCE_ID,
    )
}

pub fn find_reputation_pda(agent: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[REPUTATION_SEED, agent.as_ref()], &GRADIENCE_ID)
}

pub fn find_stake_pda(judge: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[STAKE_SEED, judge.as_ref()], &GRADIENCE_ID)
}

pub fn find_judge_pool_pda(category: u8) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[JUDGE_POOL_SEED, &[category]], &GRADIENCE_ID)
}

pub fn find_treasury_pda() -> (Pubkey, u8) {
    Pubkey::find_program_address(&[TREASURY_SEED], &GRADIENCE_ID)
}

pub fn find_config_pda() -> (Pubkey, u8) {
    Pubkey::find_program_address(&[CONFIG_SEED], &GRADIENCE_ID)
}

pub fn find_event_authority_pda() -> (Pubkey, u8) {
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(gradience::events::event_authority_pda::ID.as_ref());
    (
        Pubkey::new_from_array(bytes),
        gradience::events::event_authority_pda::BUMP,
    )
}
