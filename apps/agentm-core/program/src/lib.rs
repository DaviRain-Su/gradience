//! AgentM Core Program
//! 
//! On-chain program for AgentM user management, social graph, and messaging.

use pinocchio::{
    account_info::AccountInfo,
    entrypoint,
    program_error::ProgramError,
    pubkey::Pubkey,
};

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

// Program ID (placeholder - replace with actual)
entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> Result<(), ProgramError> {
    // Parse instruction discriminator
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
        _ => Err(ProgramError::InvalidInstructionData),
    }
}
