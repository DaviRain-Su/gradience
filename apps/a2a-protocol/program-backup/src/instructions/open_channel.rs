use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView, cpi::Seed, error::ProgramError, sysvars::clock::Clock,
    sysvars::Sysvar, Address, ProgramResult,
};

use crate::{
    constants::CHANNEL_SEED,
    errors::A2AProtocolError,
    state::{
        ChannelStatus, NetworkConfig, PaymentChannel, NETWORK_CONFIG_DISCRIMINATOR,
        PAYMENT_CHANNEL_DISCRIMINATOR, PAYMENT_CHANNEL_LEN,
    },
    utils::{
        create_pda_account, is_zero_pubkey, read_borsh_account, verify_owner, verify_signer,
        verify_system_program, verify_writable, write_borsh_account,
    },
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct OpenChannelData {
    pub channel_id: u64,
    pub mediator: [u8; 32],
    pub token_mint: [u8; 32],
    pub deposit_amount: u64,
    pub expires_at: i64,
}

pub fn process_open_channel(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = OpenChannelData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    if data.channel_id == 0 || data.deposit_amount == 0 || data.expires_at <= 0 {
        return Err(A2AProtocolError::DeadlineInvalid.into());
    }
    if is_zero_pubkey(&data.mediator) {
        return Err(A2AProtocolError::Unauthorized.into());
    }

    let [payer, payee, channel, config, system_program] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    verify_signer(payer)?;
    verify_writable(payer)?;
    verify_writable(channel)?;
    verify_owner(config, program_id)?;
    verify_system_program(system_program)?;

    if channel.data_len() > 0 || channel.lamports() > 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let network_config: NetworkConfig = read_borsh_account(config, NETWORK_CONFIG_DISCRIMINATOR)?;
    let clock = Clock::get()?;
    if data.expires_at <= clock.unix_timestamp {
        return Err(A2AProtocolError::DeadlineInvalid.into());
    }
    if data.deposit_amount < network_config.min_channel_deposit {
        return Err(A2AProtocolError::ChannelInsufficientDeposit.into());
    }

    let channel_id_bytes = data.channel_id.to_le_bytes();
    let (channel_pda, channel_bump) = Address::find_program_address(
        &[
            CHANNEL_SEED,
            payer.address().as_ref(),
            payee.address().as_ref(),
            channel_id_bytes.as_ref(),
        ],
        program_id,
    );
    if channel.address() != &channel_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let channel_bump_seed = [channel_bump];
    create_pda_account(
        payer,
        PAYMENT_CHANNEL_LEN,
        program_id,
        channel,
        [
            Seed::from(CHANNEL_SEED),
            Seed::from(payer.address().as_ref()),
            Seed::from(payee.address().as_ref()),
            Seed::from(channel_id_bytes.as_ref()),
            Seed::from(channel_bump_seed.as_slice()),
        ],
    )?;

    write_borsh_account(
        channel,
        PAYMENT_CHANNEL_DISCRIMINATOR,
        &PaymentChannel {
            channel_id: data.channel_id,
            payer: payer.address().to_bytes(),
            payee: payee.address().to_bytes(),
            mediator: data.mediator,
            token_mint: data.token_mint,
            deposit_amount: data.deposit_amount,
            spent_amount: 0,
            nonce: 0,
            expires_at: data.expires_at,
            dispute_deadline: 0,
            status: ChannelStatus::Open,
            pending_settle_amount: 0,
            bump: channel_bump,
        },
    )
}
