use pinocchio::{account::AccountView, entrypoint, error::ProgramError, Address, ProgramResult};

use crate::instructions::{
    process_activate_delegation_task, process_cancel_delegation_task,
    process_complete_delegation_task, process_delegation_task, process_initialize,
    process_record_delegation_execution, process_register_protocol, process_register_skill,
    process_set_skill_status, process_update_protocol_status, process_upgrade_config,
};

entrypoint!(process_instruction);

#[repr(u8)]
pub enum ChainHubInstructionDiscriminators {
    Initialize = 0,
    RegisterSkill = 1,
    SetSkillStatus = 2,
    RegisterProtocol = 3,
    UpdateProtocolStatus = 4,
    DelegationTask = 5,
    ActivateDelegationTask = 6,
    RecordDelegationExecution = 7,
    CompleteDelegationTask = 8,
    CancelDelegationTask = 9,
    UpgradeConfig = 10,
}

impl TryFrom<u8> for ChainHubInstructionDiscriminators {
    type Error = ProgramError;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Self::Initialize),
            1 => Ok(Self::RegisterSkill),
            2 => Ok(Self::SetSkillStatus),
            3 => Ok(Self::RegisterProtocol),
            4 => Ok(Self::UpdateProtocolStatus),
            5 => Ok(Self::DelegationTask),
            6 => Ok(Self::ActivateDelegationTask),
            7 => Ok(Self::RecordDelegationExecution),
            8 => Ok(Self::CompleteDelegationTask),
            9 => Ok(Self::CancelDelegationTask),
            10 => Ok(Self::UpgradeConfig),
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
        ChainHubInstructionDiscriminators::SetSkillStatus => {
            process_set_skill_status(program_id, accounts, payload)
        }
        ChainHubInstructionDiscriminators::RegisterProtocol => {
            process_register_protocol(program_id, accounts, payload)
        }
        ChainHubInstructionDiscriminators::UpdateProtocolStatus => {
            process_update_protocol_status(program_id, accounts, payload)
        }
        ChainHubInstructionDiscriminators::DelegationTask => {
            process_delegation_task(program_id, accounts, payload)
        }
        ChainHubInstructionDiscriminators::ActivateDelegationTask => {
            process_activate_delegation_task(program_id, accounts, payload)
        }
        ChainHubInstructionDiscriminators::RecordDelegationExecution => {
            process_record_delegation_execution(program_id, accounts, payload)
        }
        ChainHubInstructionDiscriminators::CompleteDelegationTask => {
            process_complete_delegation_task(program_id, accounts, payload)
        }
        ChainHubInstructionDiscriminators::CancelDelegationTask => {
            process_cancel_delegation_task(program_id, accounts, payload)
        }
        ChainHubInstructionDiscriminators::UpgradeConfig => {
            process_upgrade_config(program_id, accounts, payload)
        }
    }
}
