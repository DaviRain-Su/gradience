//! AgentM Core Program
//!
//! On-chain program for AgentM user management, social graph, and messaging.

use pinocchio::{account::AccountView, entrypoint, error::ProgramError, Address};

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

/// Convert an Address reference to a [u8; 32] for state storage
pub fn addr_to_bytes(address: &Address) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(address.as_ref());
    bytes
}

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> Result<(), ProgramError> {
    let (discriminator, data) = instruction_data
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;

    match discriminator {
        0 => initialize(program_id, accounts, data),
        1 => register_user(program_id, accounts, data),
        2 => update_profile(program_id, accounts, data),
        3 => follow_user(program_id, accounts, data),
        4 => unfollow_user(program_id, accounts, data),
        5 => send_message(program_id, accounts, data),
        6 => create_agent(program_id, accounts, data),
        7 => update_agent_config(program_id, accounts, data),
        8 => update_reputation(program_id, accounts, data),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}
