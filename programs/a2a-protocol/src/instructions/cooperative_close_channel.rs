use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{account::AccountView, error::ProgramError, Address, ProgramResult};

use crate::{
    errors::A2AProtocolError,
    state::{
        ChannelStatus, PaymentChannel, PAYMENT_CHANNEL_DISCRIMINATOR,
    },
    utils::{read_borsh_account, verify_owner, verify_signer, verify_writable, write_borsh_account},
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct CooperativeCloseChannelData {
    pub channel_id: u64,
    pub nonce: u64,
    pub spent_amount: u64,
    pub payer_sig_r: [u8; 32],
    pub payer_sig_s: [u8; 32],
    pub payee_sig_r: [u8; 32],
    pub payee_sig_s: [u8; 32],
}

pub fn process_cooperative_close_channel(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = CooperativeCloseChannelData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    if data.channel_id == 0 || data.nonce == 0 {
        return Err(A2AProtocolError::NonceReplay.into());
    }
    if data.payer_sig_r == [0u8; 32]
        || data.payer_sig_s == [0u8; 32]
        || data.payee_sig_r == [0u8; 32]
        || data.payee_sig_s == [0u8; 32]
    {
        return Err(A2AProtocolError::InvalidSignature.into());
    }

    let [payer, payee, channel] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    verify_signer(payer)?;
    verify_signer(payee)?;
    verify_writable(channel)?;
    verify_owner(channel, program_id)?;

    let mut channel_state: PaymentChannel =
        read_borsh_account(channel, PAYMENT_CHANNEL_DISCRIMINATOR)?;
    if channel_state.channel_id != data.channel_id {
        return Err(ProgramError::InvalidAccountData);
    }
    if channel_state.status != ChannelStatus::Open && channel_state.status != ChannelStatus::Disputed {
        return Err(A2AProtocolError::InvalidStateTransition.into());
    }
    if channel_state.payer != payer.address().to_bytes()
        || channel_state.payee != payee.address().to_bytes()
    {
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
    channel_state.status = ChannelStatus::Settled;
    channel_state.dispute_deadline = 0;
    write_borsh_account(channel, PAYMENT_CHANNEL_DISCRIMINATOR, &channel_state)
}
