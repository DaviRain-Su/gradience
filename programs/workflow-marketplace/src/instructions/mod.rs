use pinocchio::{account::AccountView, address::Address, error::ProgramError, ProgramResult};

pub mod initialize;
pub mod create_workflow;
pub mod purchase_workflow;
pub mod review_workflow;
pub mod update_workflow;
pub mod toggle_workflow;
pub mod delete_workflow;

/// Process instruction
pub fn process_instruction(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    if instruction_data.is_empty() {
        return Err(ProgramError::InvalidInstructionData);
    }

    let instruction = instruction_data[0];
    let data = &instruction_data[1..];

    match instruction {
        0 => initialize::process(program_id, accounts, data),
        1 => create_workflow::process(program_id, accounts, data),
        2 => purchase_workflow::process(program_id, accounts, data),
        3 => review_workflow::process(program_id, accounts, data),
        4 => update_workflow::process(program_id, accounts, data),
        5 => toggle_workflow::process_deactivate(program_id, accounts, data),
        6 => toggle_workflow::process_activate(program_id, accounts, data),
        7 => delete_workflow::process(program_id, accounts, data),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}
