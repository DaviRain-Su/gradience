pub mod accounts;
pub mod data;
pub mod instruction;
pub mod processor;

pub use accounts::UpdateReputationFromEvmAccounts;
pub use data::EvmReputationUpdate;
pub use instruction::UpdateReputationFromEvm;
pub use processor::process_update_reputation_from_evm;

// InstructionData alias for macro compatibility
pub type UpdateReputationFromEvmData = EvmReputationUpdate;
