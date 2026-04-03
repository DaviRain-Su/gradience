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
pub struct OpenChannelDisputeData {
    pub channel_id: u64,
    pub nonce: u64,
    pub spent_amount: u64,
    pub dispute_deadline: i64,
    pub payer_sig_r: [u8; 32],
    pub payer_sig_s: [u8; 32],
    pub payee_sig_r: [u8; 32],
    pub payee_sig_s: [u8; 32],
}

pub fn process_open_channel_dispute(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = OpenChannelDisputeData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    if data.channel_id == 0 || data.nonce == 0 {
        return Err(A2AProtocolError::NonceReplay.into());
    }
    if data.dispute_deadline <= 0 {
        return Err(A2AProtocolError::DeadlineInvalid.into());
    }
    if data.payer_sig_r == [0u8; 32]
        || data.payer_sig_s == [0u8; 32]
        || data.payee_sig_r == [0u8; 32]
        || data.payee_sig_s == [0u8; 32]
    {
        return Err(A2AProtocolError::InvalidSignature.into());
    }

    let [complainant, channel, config] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    verify_signer(complainant)?;
    verify_writable(channel)?;
    verify_owner(channel, program_id)?;
    verify_owner(config, program_id)?;

    let clock = Clock::get()?;
    let config_state: NetworkConfig = read_borsh_account(config, NETWORK_CONFIG_DISCRIMINATOR)?;
    if data.dispute_deadline <= clock.unix_timestamp {
        return Err(A2AProtocolError::DisputeWindowClosed.into());
    }
    let max_deadline = clock
        .unix_timestamp
        .checked_add(i64::try_from(config_state.max_dispute_slots).unwrap_or(i64::MAX))
        .ok_or(A2AProtocolError::DeadlineInvalid)?;
    if data.dispute_deadline > max_deadline {
        return Err(A2AProtocolError::DeadlineInvalid.into());
    }

    let mut channel_state: PaymentChannel =
        read_borsh_account(channel, PAYMENT_CHANNEL_DISCRIMINATOR)?;
    if channel_state.channel_id != data.channel_id {
        return Err(ProgramError::InvalidAccountData);
    }
    if channel_state.status != ChannelStatus::Open && channel_state.status != ChannelStatus::Disputed {
        return Err(A2AProtocolError::InvalidStateTransition.into());
    }
    let complainant_bytes = complainant.address().to_bytes();
    if complainant_bytes != channel_state.payer && complainant_bytes != channel_state.payee {
        return Err(A2AProtocolError::Unauthorized.into());
    }
    if data.nonce <= channel_state.nonce {
        return Err(A2AProtocolError::NonceReplay.into());
    }
    if data.spent_amount > channel_state.deposit_amount {
        return Err(A2AProtocolError::SettlementAmountInvalid.into());
    }

    channel_state.nonce = data.nonce;
    channel_state.spent_amount = data.spent_amount;
    channel_state.pending_settle_amount = data.spent_amount;
    channel_state.dispute_deadline = data.dispute_deadline;
    channel_state.status = ChannelStatus::Disputed;
    write_borsh_account(channel, PAYMENT_CHANNEL_DISCRIMINATOR, &channel_state)
}
