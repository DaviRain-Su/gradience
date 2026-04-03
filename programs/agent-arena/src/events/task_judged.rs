use alloc::vec::Vec;
use codama::CodamaType;

use crate::traits::{EventDiscriminator, EventDiscriminators, EventSerialize};

#[derive(CodamaType)]
pub struct TaskJudgedEvent {
    pub task_id: u64,
    pub winner: [u8; 32],
    pub score: u8,
    pub agent_payout: u64,
    pub judge_fee: u64,
    pub protocol_fee: u64,
}

impl EventDiscriminator for TaskJudgedEvent {
    const DISCRIMINATOR: u8 = EventDiscriminators::TaskJudged as u8;
}

impl EventSerialize for TaskJudgedEvent {
    #[inline(always)]
    fn to_bytes_inner(&self) -> Vec<u8> {
        let mut data = Vec::with_capacity(Self::DATA_LEN);
        data.extend_from_slice(&self.task_id.to_le_bytes());
        data.extend_from_slice(&self.winner);
        data.push(self.score);
        data.extend_from_slice(&self.agent_payout.to_le_bytes());
        data.extend_from_slice(&self.judge_fee.to_le_bytes());
        data.extend_from_slice(&self.protocol_fee.to_le_bytes());
        data
    }
}

impl TaskJudgedEvent {
    pub const DATA_LEN: usize = 8 + 32 + 1 + 8 + 8 + 8;
}
