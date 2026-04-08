pub mod accounts;
pub mod data;
pub mod instruction;
pub mod processor;

pub use accounts::BindIdentityAccounts;
pub use data::BindIdentityData;
pub use instruction::BindIdentity;
pub use processor::process_bind_identity;
