use pinocchio::{account::AccountView, entrypoint, error::ProgramError, Address, ProgramResult};

use crate::instructions::{
    process_archive_thread, process_assign_subtask_bid, process_cancel_subtask_order,
    process_cooperative_close_channel, process_create_subtask_order, process_create_thread,
    process_initialize_network_config, process_open_channel, process_open_channel_dispute,
    process_post_message, process_resolve_channel_dispute, process_settle_subtask,
    process_submit_subtask_bid, process_submit_subtask_delivery, process_upsert_agent_profile,
};

entrypoint!(process_instruction);

#[repr(u8)]
pub enum A2AInstructionDiscriminators {
    InitializeNetworkConfig = 0,
    UpsertAgentProfile = 1,
    CreateThread = 2,
    PostMessage = 3,
    ArchiveThread = 4,
    OpenChannel = 5,
    CooperativeCloseChannel = 6,
    OpenChannelDispute = 7,
    ResolveChannelDispute = 8,
    CreateSubtaskOrder = 9,
    SubmitSubtaskBid = 10,
    AssignSubtaskBid = 11,
    SubmitSubtaskDelivery = 12,
    SettleSubtask = 13,
    CancelSubtaskOrder = 14,
}

impl TryFrom<u8> for A2AInstructionDiscriminators {
    type Error = ProgramError;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Self::InitializeNetworkConfig),
            1 => Ok(Self::UpsertAgentProfile),
            2 => Ok(Self::CreateThread),
            3 => Ok(Self::PostMessage),
            4 => Ok(Self::ArchiveThread),
            5 => Ok(Self::OpenChannel),
            6 => Ok(Self::CooperativeCloseChannel),
            7 => Ok(Self::OpenChannelDispute),
            8 => Ok(Self::ResolveChannelDispute),
            9 => Ok(Self::CreateSubtaskOrder),
            10 => Ok(Self::SubmitSubtaskBid),
            11 => Ok(Self::AssignSubtaskBid),
            12 => Ok(Self::SubmitSubtaskDelivery),
            13 => Ok(Self::SettleSubtask),
            14 => Ok(Self::CancelSubtaskOrder),
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
    match A2AInstructionDiscriminators::try_from(*discriminator)? {
        A2AInstructionDiscriminators::InitializeNetworkConfig => {
            process_initialize_network_config(program_id, accounts, payload)
        }
        A2AInstructionDiscriminators::UpsertAgentProfile => {
            process_upsert_agent_profile(program_id, accounts, payload)
        }
        A2AInstructionDiscriminators::CreateThread => {
            process_create_thread(program_id, accounts, payload)
        }
        A2AInstructionDiscriminators::PostMessage => {
            process_post_message(program_id, accounts, payload)
        }
        A2AInstructionDiscriminators::ArchiveThread => {
            process_archive_thread(program_id, accounts, payload)
        }
        A2AInstructionDiscriminators::OpenChannel => {
            process_open_channel(program_id, accounts, payload)
        }
        A2AInstructionDiscriminators::CooperativeCloseChannel => {
            process_cooperative_close_channel(program_id, accounts, payload)
        }
        A2AInstructionDiscriminators::OpenChannelDispute => {
            process_open_channel_dispute(program_id, accounts, payload)
        }
        A2AInstructionDiscriminators::ResolveChannelDispute => {
            process_resolve_channel_dispute(program_id, accounts, payload)
        }
        A2AInstructionDiscriminators::CreateSubtaskOrder => {
            process_create_subtask_order(program_id, accounts, payload)
        }
        A2AInstructionDiscriminators::SubmitSubtaskBid => {
            process_submit_subtask_bid(program_id, accounts, payload)
        }
        A2AInstructionDiscriminators::AssignSubtaskBid => {
            process_assign_subtask_bid(program_id, accounts, payload)
        }
        A2AInstructionDiscriminators::SubmitSubtaskDelivery => {
            process_submit_subtask_delivery(program_id, accounts, payload)
        }
        A2AInstructionDiscriminators::SettleSubtask => {
            process_settle_subtask(program_id, accounts, payload)
        }
        A2AInstructionDiscriminators::CancelSubtaskOrder => {
            process_cancel_subtask_order(program_id, accounts, payload)
        }
    }
}
