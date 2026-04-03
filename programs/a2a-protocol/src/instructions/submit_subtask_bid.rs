use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView, cpi::Seed, error::ProgramError, sysvars::clock::Clock,
    sysvars::Sysvar, Address, ProgramResult,
};

use crate::{
    constants::BID_SEED,
    errors::A2AProtocolError,
    state::{
        BidStatus, NetworkConfig, SubtaskBid, SubtaskOrder, SubtaskStatus, NETWORK_CONFIG_DISCRIMINATOR,
        SUBTASK_BID_DISCRIMINATOR, SUBTASK_BID_LEN, SUBTASK_ORDER_DISCRIMINATOR,
    },
    utils::{
        create_pda_account, is_zero_pubkey, read_borsh_account, verify_owner, verify_signer,
        verify_system_program, verify_writable, write_borsh_account,
    },
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct SubmitSubtaskBidData {
    pub parent_task_id: u64,
    pub subtask_id: u32,
    pub quote_amount: u64,
    pub stake_amount: u64,
    pub eta_seconds: u32,
    pub commitment_hash: [u8; 32],
}

pub fn process_submit_subtask_bid(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = SubmitSubtaskBidData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    if data.parent_task_id == 0 || data.subtask_id == 0 || data.quote_amount == 0 || data.eta_seconds == 0 {
        return Err(A2AProtocolError::DeadlineInvalid.into());
    }
    if is_zero_pubkey(&data.commitment_hash) {
        return Err(A2AProtocolError::HashEmpty.into());
    }

    let [bidder, bid, subtask, config, system_program] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    verify_signer(bidder)?;
    verify_writable(bidder)?;
    verify_writable(bid)?;
    verify_writable(subtask)?;
    verify_owner(subtask, program_id)?;
    verify_owner(config, program_id)?;
    verify_system_program(system_program)?;

    let config_state: NetworkConfig = read_borsh_account(config, NETWORK_CONFIG_DISCRIMINATOR)?;
    if data.stake_amount < config_state.min_bid_stake {
        return Err(A2AProtocolError::InvalidBidStake.into());
    }

    let subtask_state: SubtaskOrder = read_borsh_account(subtask, SUBTASK_ORDER_DISCRIMINATOR)?;
    if subtask_state.parent_task_id != data.parent_task_id || subtask_state.subtask_id != data.subtask_id {
        return Err(ProgramError::InvalidAccountData);
    }
    if subtask_state.status != SubtaskStatus::Bidding {
        return Err(A2AProtocolError::BidWindowClosed.into());
    }
    let clock = Clock::get()?;
    if clock.unix_timestamp > subtask_state.bid_deadline {
        return Err(A2AProtocolError::BidWindowClosed.into());
    }

    if bid.data_len() > 0 || bid.lamports() > 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }
    let parent_task_id_bytes = data.parent_task_id.to_le_bytes();
    let subtask_id_bytes = data.subtask_id.to_le_bytes();
    let (bid_pda, bid_bump) = Address::find_program_address(
        &[
            BID_SEED,
            parent_task_id_bytes.as_ref(),
            subtask_id_bytes.as_ref(),
            bidder.address().as_ref(),
        ],
        program_id,
    );
    if bid.address() != &bid_pda {
        return Err(ProgramError::InvalidSeeds);
    }
    let bid_bump_seed = [bid_bump];
    create_pda_account(
        bidder,
        SUBTASK_BID_LEN,
        program_id,
        bid,
        [
            Seed::from(BID_SEED),
            Seed::from(parent_task_id_bytes.as_ref()),
            Seed::from(subtask_id_bytes.as_ref()),
            Seed::from(bidder.address().as_ref()),
            Seed::from(bid_bump_seed.as_slice()),
        ],
    )?;

    write_borsh_account(
        bid,
        SUBTASK_BID_DISCRIMINATOR,
        &SubtaskBid {
            parent_task_id: data.parent_task_id,
            subtask_id: data.subtask_id,
            bidder: bidder.address().to_bytes(),
            quote_amount: data.quote_amount,
            stake_amount: data.stake_amount,
            eta_seconds: data.eta_seconds,
            commitment_hash: data.commitment_hash,
            status: BidStatus::Open,
            bump: bid_bump,
        },
    )
}
