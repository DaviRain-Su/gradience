use pinocchio::{account::AccountView, entrypoint, error::ProgramError, Address, ProgramResult};

use crate::{
    instructions::{process_emit_event, process_initialize, process_post_task},
    traits::GradienceInstructionDiscriminators,
};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let (discriminator, instruction_data) = instruction_data
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;

    let ix_discriminator = GradienceInstructionDiscriminators::try_from(*discriminator)?;

    match ix_discriminator {
        GradienceInstructionDiscriminators::Initialize => {
            process_initialize(program_id, accounts, instruction_data)
        }
        GradienceInstructionDiscriminators::PostTask => {
            process_post_task(program_id, accounts, instruction_data)
        }
        GradienceInstructionDiscriminators::EmitEvent => {
            process_emit_event(program_id, accounts)
        }
    }
}
