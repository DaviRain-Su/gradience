use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView, error::ProgramError, sysvars::clock::Clock, sysvars::Sysvar, Address,
    ProgramResult,
};

use crate::{
    errors::A2AProtocolError,
    state::{
        ChannelStatus, NetworkConfig, PaymentChannel, NETWORK_CONFIG_DISCRIMINATOR,
        PAYMENT_CHANNEL_DISCRIMINATOR,
    },
    utils::{read_borsh_account, verify_owner, verify_signer, verify_writable, write_borsh_account},
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct ResolveChannelDisputeData {
    pub channel_id: u64,
    pub final_spent_amount: u64,
}

pub fn process_resolve_channel_dispute(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = ResolveChannelDisputeData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let [arbiter, channel, config] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    verify_signer(arbiter)?;
    verify_writable(channel)?;
    verify_owner(channel, program_id)?;
    verify_owner(config, program_id)?;

    let config_state: NetworkConfig = read_borsh_account(config, NETWORK_CONFIG_DISCRIMINATOR)?;
    if config_state.arbitration_authority != arbiter.address().to_bytes() {
        return Err(A2AProtocolError::Unauthorized.into());
    }

    let mut channel_state: PaymentChannel =
        read_borsh_account(channel, PAYMENT_CHANNEL_DISCRIMINATOR)?;
    if channel_state.channel_id != data.channel_id {
        return Err(ProgramError::InvalidAccountData);
    }
    if channel_state.status != ChannelStatus::Disputed {
        return Err(A2AProtocolError::InvalidStateTransition.into());
    }
    let clock = Clock::get()?;
    if channel_state.dispute_deadline > 0 && clock.unix_timestamp > channel_state.dispute_deadline {
        return Err(A2AProtocolError::DisputeWindowClosed.into());
    }
    if data.final_spent_amount > channel_state.deposit_amount {
        return Err(A2AProtocolError::SettlementAmountInvalid.into());
    }

    channel_state.spent_amount = data.final_spent_amount;
    channel_state.pending_settle_amount = data.final_spent_amount;
    channel_state.status = ChannelStatus::Settled;
    channel_state.dispute_deadline = 0;
    write_borsh_account(channel, PAYMENT_CHANNEL_DISCRIMINATOR, &channel_state)
}
