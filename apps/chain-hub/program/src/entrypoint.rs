use pinocchio::{account::AccountView, entrypoint, error::ProgramError, Address, ProgramResult};

use crate::instructions::{process_delegation_task, process_initialize, process_register_skill};

entrypoint!(process_instruction);

#[repr(u8)]
pub enum ChainHubInstructionDiscriminators {
    Initialize = 0,
    RegisterSkill = 1,
    DelegationTask = 2,
}

impl TryFrom<u8> for ChainHubInstructionDiscriminators {
    type Error = ProgramError;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Self::Initialize),
            1 => Ok(Self::RegisterSkill),
            2 => Ok(Self::DelegationTask),
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}

pub fn process_instruction(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let (discriminator, payload) = instruction_data
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;

    match ChainHubInstructionDiscriminators::try_from(*discriminator)? {
        ChainHubInstructionDiscriminators::Initialize => {
            process_initialize(program_id, accounts, payload)
        }
        ChainHubInstructionDiscriminators::RegisterSkill => {
            process_register_skill(program_id, accounts, payload)
        }
        ChainHubInstructionDiscriminators::DelegationTask => {
            process_delegation_task(program_id, accounts, payload)
        }
    }
}
