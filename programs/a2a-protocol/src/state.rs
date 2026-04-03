use borsh::{BorshDeserialize, BorshSerialize};

pub type PubkeyBytes = [u8; 32];

pub const ACCOUNT_HEADER_LEN: usize = 2;
pub const ACCOUNT_VERSION_V1: u8 = 1;

pub const NETWORK_CONFIG_DISCRIMINATOR: u8 = 0xA1;
pub const AGENT_PROFILE_DISCRIMINATOR: u8 = 0xA2;
pub const MESSAGE_THREAD_DISCRIMINATOR: u8 = 0xA3;
pub const MESSAGE_ENVELOPE_DISCRIMINATOR: u8 = 0xA4;
pub const PAYMENT_CHANNEL_DISCRIMINATOR: u8 = 0xA5;
pub const SUBTASK_ORDER_DISCRIMINATOR: u8 = 0xA6;
pub const SUBTASK_BID_DISCRIMINATOR: u8 = 0xA7;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct NetworkConfig {
    pub upgrade_authority: PubkeyBytes,
    pub arbitration_authority: PubkeyBytes,
    pub min_channel_deposit: u64,
    pub min_bid_stake: u64,
    pub max_message_bytes: u32,
    pub max_dispute_slots: u64,
    pub bump: u8,
}

pub const NETWORK_CONFIG_DATA_LEN: usize = 32 + 32 + 8 + 8 + 4 + 8 + 1;
pub const NETWORK_CONFIG_LEN: usize = ACCOUNT_HEADER_LEN + NETWORK_CONFIG_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct AgentProfile {
    pub agent: PubkeyBytes,
    pub authority: PubkeyBytes,
    pub capability_mask: u64,
    pub transport_flags: u16,
    pub last_heartbeat_slot: u64,
    pub metadata_uri_hash: PubkeyBytes,
    pub status: u8,
    pub bump: u8,
}

pub const AGENT_PROFILE_DATA_LEN: usize = 32 + 32 + 8 + 2 + 8 + 32 + 1 + 1;
pub const AGENT_PROFILE_LEN: usize = ACCOUNT_HEADER_LEN + AGENT_PROFILE_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[borsh(use_discriminant = true)]
#[repr(u8)]
pub enum ThreadStatus {
    Draft = 0,
    Active = 1,
    Archived = 2,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct MessageThread {
    pub thread_id: u64,
    pub creator: PubkeyBytes,
    pub counterparty: PubkeyBytes,
    pub policy_hash: PubkeyBytes,
    pub message_count: u32,
    pub latest_message_slot: u64,
    pub status: ThreadStatus,
    pub bump: u8,
}

pub const MESSAGE_THREAD_DATA_LEN: usize = 8 + 32 + 32 + 32 + 4 + 8 + 1 + 1;
pub const MESSAGE_THREAD_LEN: usize = ACCOUNT_HEADER_LEN + MESSAGE_THREAD_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct MessageEnvelope {
    pub thread_id: u64,
    pub sequence: u32,
    pub from_agent: PubkeyBytes,
    pub to_agent: PubkeyBytes,
    pub message_type: u8,
    pub codec: u8,
    pub nonce: u64,
    pub created_at: i64,
    pub body_hash: PubkeyBytes,
    pub sig_r: PubkeyBytes,
    pub sig_s: PubkeyBytes,
    pub payment_microlamports: u64,
    pub flags: u16,
    pub bump: u8,
}

pub const MESSAGE_ENVELOPE_DATA_LEN: usize = 8 + 4 + 32 + 32 + 1 + 1 + 8 + 8 + 32 + 32 + 32 + 8 + 2 + 1;
pub const MESSAGE_ENVELOPE_LEN: usize = ACCOUNT_HEADER_LEN + MESSAGE_ENVELOPE_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[borsh(use_discriminant = true)]
#[repr(u8)]
pub enum ChannelStatus {
    Open = 0,
    Closing = 1,
    Disputed = 2,
    Settled = 3,
    Cancelled = 4,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct PaymentChannel {
    pub channel_id: u64,
    pub payer: PubkeyBytes,
    pub payee: PubkeyBytes,
    pub mediator: PubkeyBytes,
    pub token_mint: PubkeyBytes,
    pub deposit_amount: u64,
    pub spent_amount: u64,
    pub nonce: u64,
    pub expires_at: i64,
    pub dispute_deadline: i64,
    pub status: ChannelStatus,
    pub pending_settle_amount: u64,
    pub bump: u8,
}

pub const PAYMENT_CHANNEL_DATA_LEN: usize = 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 1;
pub const PAYMENT_CHANNEL_LEN: usize = ACCOUNT_HEADER_LEN + PAYMENT_CHANNEL_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[borsh(use_discriminant = true)]
#[repr(u8)]
pub enum SubtaskStatus {
    Drafting = 0,
    Bidding = 1,
    Assigned = 2,
    Delivered = 3,
    Settled = 4,
    Disputed = 5,
    Cancelled = 6,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct SubtaskOrder {
    pub parent_task_id: u64,
    pub subtask_id: u32,
    pub requester: PubkeyBytes,
    pub selected_agent: PubkeyBytes,
    pub budget: u64,
    pub bid_deadline: i64,
    pub execute_deadline: i64,
    pub requirement_hash: PubkeyBytes,
    pub delivery_hash: PubkeyBytes,
    pub escrow_channel_id: u64,
    pub status: SubtaskStatus,
    pub bump: u8,
}

pub const SUBTASK_ORDER_DATA_LEN: usize = 8 + 4 + 32 + 32 + 8 + 8 + 8 + 32 + 32 + 8 + 1 + 1;
pub const SUBTASK_ORDER_LEN: usize = ACCOUNT_HEADER_LEN + SUBTASK_ORDER_DATA_LEN;

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[borsh(use_discriminant = true)]
#[repr(u8)]
pub enum BidStatus {
    Open = 0,
    Won = 1,
    Lost = 2,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct SubtaskBid {
    pub parent_task_id: u64,
    pub subtask_id: u32,
    pub bidder: PubkeyBytes,
    pub quote_amount: u64,
    pub stake_amount: u64,
    pub eta_seconds: u32,
    pub commitment_hash: PubkeyBytes,
    pub status: BidStatus,
    pub bump: u8,
}

pub const SUBTASK_BID_DATA_LEN: usize = 8 + 4 + 32 + 8 + 8 + 4 + 32 + 1 + 1;
pub const SUBTASK_BID_LEN: usize = ACCOUNT_HEADER_LEN + SUBTASK_BID_DATA_LEN;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_lengths_match_expected_sizes() {
        assert_eq!(NETWORK_CONFIG_LEN, 95);
        assert_eq!(AGENT_PROFILE_LEN, 118);
        assert_eq!(MESSAGE_THREAD_LEN, 120);
        assert_eq!(MESSAGE_ENVELOPE_LEN, 203);
        assert_eq!(PAYMENT_CHANNEL_LEN, 188);
        assert_eq!(SUBTASK_ORDER_LEN, 176);
        assert_eq!(SUBTASK_BID_LEN, 100);
    }
}
