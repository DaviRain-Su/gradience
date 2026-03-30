use codama::CodamaInstructions;

/// Instructions for the Pinocchio Counter Program.
#[allow(clippy::large_enum_variant)]
#[repr(C, u8)]
#[derive(Clone, Debug, PartialEq, CodamaInstructions)]
pub enum PinocchioCounterInstruction {
    /// Create a new counter for the authority.
    #[codama(account(name = "payer", signer, writable))]
    #[codama(account(name = "authority", signer))]
    #[codama(account(name = "counter", writable))]
    #[codama(account(name = "system_program"))]
    #[codama(account(name = "event_authority"))]
    #[codama(account(name = "gradience_program"))]
    CreateCounter {
        /// Bump for the counter PDA
        bump: u8,
    } = 0,

    /// Increment the counter value by 1.
    #[codama(account(name = "authority", signer))]
    #[codama(account(name = "counter", writable))]
    #[codama(account(name = "event_authority"))]
    #[codama(account(name = "gradience_program"))]
    Increment {} = 1,

    /// Close the counter and reclaim rent.
    #[codama(account(name = "authority", signer))]
    #[codama(account(name = "counter", writable))]
    #[codama(account(name = "destination", writable))]
    #[codama(account(name = "event_authority"))]
    #[codama(account(name = "gradience_program"))]
    CloseCounter {} = 2,

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
    } = 3,

    /// Invoked via CPI to emit event data in instruction args (prevents log truncation).
    #[codama(account(name = "event_authority", signer))]
    EmitEvent {} = 228,
}
