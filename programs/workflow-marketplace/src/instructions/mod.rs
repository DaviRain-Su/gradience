use pinocchio::{account::AccountView, address::Address, error::ProgramError, ProgramResult};

pub mod initialize;

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
        _ => Err(ProgramError::InvalidInstructionData),
    }
}
