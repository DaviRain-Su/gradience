use alloc::{string::String, vec::Vec};
use codama::{CodamaInstructions, CodamaType};

#[derive(Clone, Debug, PartialEq, Eq, CodamaType)]
pub struct RuntimeEnvInput {
    pub provider: String,
    pub model: String,
    pub runtime: String,
    pub version: String,
}

/// Instructions for the Gradience program.
#[allow(clippy::large_enum_variant)]
#[repr(C, u8)]
#[derive(Clone, Debug, PartialEq, CodamaInstructions)]
pub enum GradienceInstruction {
    /// Initialize program config and treasury PDAs.
    #[codama(account(name = "payer", signer, writable))]
    #[codama(account(name = "config", writable))]
    #[codama(account(name = "treasury", writable))]
    #[codama(account(name = "system_program"))]
    Initialize {
        /// Upgrade authority pubkey bytes
        upgrade_authority: [u8; 32],
        /// Minimum judge stake in lamports
        min_judge_stake: u64,
    } = 0,

    /// Post a new task and lock SOL/SPL reward into escrow.
    #[codama(account(name = "poster", signer, writable))]
    #[codama(account(name = "config", writable))]
    #[codama(account(name = "task", writable))]
    #[codama(account(name = "escrow", writable))]
    #[codama(account(name = "judge_pool"))]
    #[codama(account(name = "system_program"))]
    #[codama(account(name = "event_authority"))]
    #[codama(account(name = "gradience_program"))]
    #[codama(account(name = "permission", writable))]
    #[codama(account(name = "permission_program"))]
    #[codama(account(name = "poster_token_account", writable, optional))]
    #[codama(account(name = "escrow_ata", writable, optional))]
    #[codama(account(name = "mint_account", optional))]
    #[codama(account(name = "token_program", optional))]
    #[codama(account(name = "associated_token_program", optional))]
    PostTask {
        /// Evaluation reference CID
        eval_ref: String,
        /// Submission deadline timestamp
        deadline: i64,
        /// Judge deadline timestamp
        judge_deadline: i64,
        /// 0 = designated judge, 1 = pool mode
        judge_mode: u8,
        /// Designated judge pubkey (ignored in pool mode)
        judge: [u8; 32],
        /// Task category id
        category: u8,
        /// Reward mint (SOL path uses [0; 32])
        mint: [u8; 32],
        /// Minimum required stake to apply
        min_stake: u64,
        /// Reward amount (lamports)
        reward: u64,
    } = 1,

    /// Apply for a task and lock required stake into escrow.
    #[codama(account(name = "agent", signer, writable))]
    #[codama(account(name = "task"))]
    #[codama(account(name = "escrow", writable))]
    #[codama(account(name = "application", writable))]
    #[codama(account(name = "reputation", writable))]
    #[codama(account(name = "system_program"))]
    #[codama(account(name = "event_authority"))]
    #[codama(account(name = "gradience_program"))]
    #[codama(account(name = "agent_token_account", writable, optional))]
    #[codama(account(name = "escrow_ata", writable, optional))]
    #[codama(account(name = "mint_account", optional))]
    #[codama(account(name = "token_program", optional))]
    ApplyForTask {} = 2,

    /// Submit or overwrite an agent result for a task.
    #[codama(account(name = "agent", signer, writable))]
    #[codama(account(name = "task", writable))]
    #[codama(account(name = "application"))]
    #[codama(account(name = "submission", writable))]
    #[codama(account(name = "system_program"))]
    #[codama(account(name = "event_authority"))]
    #[codama(account(name = "gradience_program"))]
    SubmitResult {
        /// Result CID reference
        result_ref: String,
        /// Trace CID reference
        trace_ref: String,
        /// Runtime environment metadata
        runtime_env: RuntimeEnvInput,
    } = 3,

    /// Judge task result and pay out reward (SOL path).
    #[codama(account(name = "judge", signer, writable))]
    #[codama(account(name = "task", writable))]
    #[codama(account(name = "escrow", writable))]
    #[codama(account(name = "poster_account", writable))]
    #[codama(account(name = "winner_account", writable))]
    #[codama(account(name = "winner_application"))]
    #[codama(account(name = "winner_submission"))]
    #[codama(account(name = "winner_reputation", writable))]
    #[codama(account(name = "judge_stake", writable))]
    #[codama(account(name = "treasury", writable))]
    #[codama(account(name = "system_program"))]
    #[codama(account(name = "event_authority"))]
    #[codama(account(name = "gradience_program"))]
    #[codama(account(name = "judge_token_account", writable, optional))]
    #[codama(account(name = "escrow_ata", writable, optional))]
    #[codama(account(name = "winner_token_account", writable, optional))]
    #[codama(account(name = "poster_token_account", writable, optional))]
    #[codama(account(name = "treasury_ata", writable, optional))]
    #[codama(account(name = "mint_account", optional))]
    #[codama(account(name = "token_program", optional))]
    #[codama(account(name = "associated_token_program", optional))]
    JudgeAndPay {
        /// Winner agent pubkey
        winner: [u8; 32],
        /// Final score
        score: u8,
        /// Optional reason CID
        reason_ref: Option<String>,
    } = 4,

    /// Cancel an open task and refund reward/stakes.
    #[codama(account(name = "poster", signer, writable))]
    #[codama(account(name = "task", writable))]
    #[codama(account(name = "escrow", writable))]
    #[codama(account(name = "treasury", writable))]
    #[codama(account(name = "system_program"))]
    #[codama(account(name = "event_authority"))]
    #[codama(account(name = "gradience_program"))]
    #[codama(account(name = "poster_token_account", writable, optional))]
    #[codama(account(name = "escrow_ata", writable, optional))]
    #[codama(account(name = "treasury_ata", writable, optional))]
    #[codama(account(name = "mint_account", optional))]
    #[codama(account(name = "token_program", optional))]
    #[codama(account(name = "associated_token_program", optional))]
    CancelTask {} = 5,

    /// Refund an expired task when deadline has passed.
    #[codama(account(name = "anyone", signer, writable))]
    #[codama(account(name = "poster", writable, optional))]
    #[codama(account(name = "task", writable))]
    #[codama(account(name = "escrow", writable))]
    #[codama(account(name = "system_program"))]
    #[codama(account(name = "event_authority"))]
    #[codama(account(name = "gradience_program"))]
    #[codama(account(name = "poster_token_account", writable, optional))]
    #[codama(account(name = "escrow_ata", writable, optional))]
    #[codama(account(name = "mint_account", optional))]
    #[codama(account(name = "token_program", optional))]
    RefundExpired {} = 6,

    /// Force-refund after judge deadline + delay, with judge slash.
    #[codama(account(name = "anyone", signer, writable))]
    #[codama(account(name = "poster_account", writable))]
    #[codama(account(name = "most_active_agent", writable))]
    #[codama(account(name = "config"))]
    #[codama(account(name = "task", writable))]
    #[codama(account(name = "escrow", writable))]
    #[codama(account(name = "judge_stake", writable))]
    #[codama(account(name = "judge_account", writable))]
    #[codama(account(name = "judge_reputation"))]
    #[codama(account(name = "treasury", writable))]
    #[codama(account(name = "system_program"))]
    #[codama(account(name = "event_authority"))]
    #[codama(account(name = "gradience_program"))]
    #[codama(account(name = "poster_token_account", writable, optional))]
    #[codama(account(name = "most_active_agent_token_account", writable, optional))]
    #[codama(account(name = "escrow_ata", writable, optional))]
    #[codama(account(name = "treasury_ata", writable, optional))]
    #[codama(account(name = "mint_account", optional))]
    #[codama(account(name = "token_program", optional))]
    #[codama(account(name = "associated_token_program", optional))]
    ForceRefund {} = 7,

    /// Register as judge with staked SOL and category pools.
    #[codama(account(name = "judge", signer, writable))]
    #[codama(account(name = "config"))]
    #[codama(account(name = "stake", writable))]
    #[codama(account(name = "reputation"))]
    #[codama(account(name = "system_program"))]
    #[codama(account(name = "event_authority"))]
    #[codama(account(name = "gradience_program"))]
    RegisterJudge {
        /// Category ids to register into (0..=7, unique, non-empty)
        categories: Vec<u8>,
        /// Judge stake amount in lamports
        stake_amount: u64,
    } = 8,

    /// Unstake judge stake after cooldown and remove from all pools.
    #[codama(account(name = "judge", signer, writable))]
    #[codama(account(name = "stake", writable))]
    #[codama(account(name = "system_program"))]
    #[codama(account(name = "event_authority"))]
    #[codama(account(name = "gradience_program"))]
    UnstakeJudge {} = 9,

    /// Update treasury and/or minimum judge stake.
    #[codama(account(name = "authority", signer))]
    #[codama(account(name = "config", writable))]
    UpgradeConfig {
        /// Optional new treasury pubkey bytes.
        new_treasury: Option<[u8; 32]>,
        /// Optional new min judge stake (>0).
        new_min_judge_stake: Option<u64>,
    } = 10,

    /// Receive VRF randomness from MagicBlock oracle via CPI.
    #[codama(account(name = "program_identity", signer))]
    #[codama(account(name = "vrf_result", writable))]
    ReceiveVrfRandomness {
        /// Task ID the randomness is for.
        task_id: u64,
    } = 11,

    /// Create a MagicBlock Permission PDA for a task account.
    #[codama(account(name = "task", signer))]
    #[codama(account(name = "permission", writable))]
    #[codama(account(name = "payer", signer, writable))]
    #[codama(account(name = "system_program"))]
    #[codama(account(name = "permission_program"))]
    CreateTaskPermission {} = 12,

    /// Bind a Solana owner to an EVM address for cross-chain identity.
    #[codama(account(name = "owner", signer, writable))]
    #[codama(account(name = "identity_binding", writable))]
    #[codama(account(name = "system_program"))]
    BindIdentity {
        /// EVM address to bind (20 bytes).
        evm_address: [u8; 20],
        /// Solana ed25519 signature over the binding message.
        sol_signature: [u8; 64],
        /// EVM secp256k1 signature over the binding message.
        evm_signature: [u8; 65],
    } = 13,

    /// Invoked via CPI to emit event data in instruction args (prevents log truncation).
    #[codama(account(name = "event_authority", signer))]
    EmitEvent {} = 228,
}
