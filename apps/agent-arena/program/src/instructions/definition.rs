use alloc::string::String;
use codama::CodamaInstructions;

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

    /// Post a new task and lock SOL reward into escrow.
    #[codama(account(name = "poster", signer, writable))]
    #[codama(account(name = "config", writable))]
    #[codama(account(name = "task", writable))]
    #[codama(account(name = "escrow", writable))]
    #[codama(account(name = "judge_pool"))]
    #[codama(account(name = "system_program"))]
    #[codama(account(name = "event_authority"))]
    #[codama(account(name = "gradience_program"))]
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
        /// Minimum required stake to apply
        min_stake: u64,
        /// Reward amount (lamports)
        reward: u64,
    } = 1,

    /// Invoked via CPI to emit event data in instruction args (prevents log truncation).
    #[codama(account(name = "event_authority", signer))]
    EmitEvent {} = 228,
}
