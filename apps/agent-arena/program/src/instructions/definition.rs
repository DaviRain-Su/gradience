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

    /// Invoked via CPI to emit event data in instruction args (prevents log truncation).
    #[codama(account(name = "event_authority", signer))]
    EmitEvent {} = 228,
}
