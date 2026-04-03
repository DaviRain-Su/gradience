use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{account::AccountView, error::ProgramError, Address, ProgramResult};

use crate::{
    errors::A2AProtocolError,
    state::{
        ChannelStatus, NetworkConfig, PaymentChannel, SubtaskOrder, SubtaskStatus,
        NETWORK_CONFIG_DISCRIMINATOR, PAYMENT_CHANNEL_DISCRIMINATOR, SUBTASK_ORDER_DISCRIMINATOR,
    },
    utils::{read_borsh_account, verify_owner, verify_signer, verify_writable, write_borsh_account},
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct SettleSubtaskData {
    pub parent_task_id: u64,
    pub subtask_id: u32,
    pub settle_amount: u64,
}

pub fn process_settle_subtask(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = SettleSubtaskData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let [actor, subtask, channel, config] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    verify_signer(actor)?;
    verify_writable(subtask)?;
    verify_writable(channel)?;
    verify_owner(subtask, program_id)?;
    verify_owner(channel, program_id)?;
    verify_owner(config, program_id)?;

    let config_state: NetworkConfig = read_borsh_account(config, NETWORK_CONFIG_DISCRIMINATOR)?;
    let mut subtask_state: SubtaskOrder = read_borsh_account(subtask, SUBTASK_ORDER_DISCRIMINATOR)?;
    if subtask_state.parent_task_id != data.parent_task_id || subtask_state.subtask_id != data.subtask_id {
        return Err(ProgramError::InvalidAccountData);
    }
    if subtask_state.status != SubtaskStatus::Delivered && subtask_state.status != SubtaskStatus::Disputed {
        return Err(A2AProtocolError::InvalidStateTransition.into());
    }
    if subtask_state.delivery_hash == [0u8; 32] {
        return Err(A2AProtocolError::HashEmpty.into());
    }

    let actor_bytes = actor.address().to_bytes();
    if actor_bytes != subtask_state.requester && actor_bytes != config_state.arbitration_authority {
        return Err(A2AProtocolError::Unauthorized.into());
    }
    if data.settle_amount == 0 || data.settle_amount > subtask_state.budget {
        return Err(A2AProtocolError::SettlementAmountInvalid.into());
    }

    let mut channel_state: PaymentChannel =
        read_borsh_account(channel, PAYMENT_CHANNEL_DISCRIMINATOR)?;
    if subtask_state.escrow_channel_id != 0 && channel_state.channel_id != subtask_state.escrow_channel_id {
        return Err(ProgramError::InvalidAccountData);
    }
    if channel_state.status != ChannelStatus::Open
        && channel_state.status != ChannelStatus::Disputed
        && channel_state.status != ChannelStatus::Closing
    {
        return Err(A2AProtocolError::InvalidStateTransition.into());
    }

    let next_spent_amount = channel_state
        .spent_amount
        .checked_add(data.settle_amount)
        .ok_or(A2AProtocolError::SettlementAmountInvalid)?;
    if next_spent_amount > channel_state.deposit_amount {
        return Err(A2AProtocolError::SettlementAmountInvalid.into());
    }

    channel_state.spent_amount = next_spent_amount;
    channel_state.pending_settle_amount = data.settle_amount;
    channel_state.status = if next_spent_amount == channel_state.deposit_amount {
        ChannelStatus::Settled
    } else {
        ChannelStatus::Closing
    };
    subtask_state.status = SubtaskStatus::Settled;

    write_borsh_account(channel, PAYMENT_CHANNEL_DISCRIMINATOR, &channel_state)?;
    write_borsh_account(subtask, SUBTASK_ORDER_DISCRIMINATOR, &subtask_state)
}
