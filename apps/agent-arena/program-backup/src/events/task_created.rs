use alloc::vec::Vec;
use codama::CodamaType;

use crate::traits::{EventDiscriminator, EventDiscriminators, EventSerialize};

#[derive(CodamaType)]
pub struct TaskCreatedEvent {
    pub task_id: u64,
    pub poster: [u8; 32],
    pub judge: [u8; 32],
    pub reward: u64,
    pub category: u8,
    pub deadline: i64,
}

impl EventDiscriminator for TaskCreatedEvent {
    const DISCRIMINATOR: u8 = EventDiscriminators::TaskCreated as u8;
}

impl EventSerialize for TaskCreatedEvent {
    #[inline(always)]
    fn to_bytes_inner(&self) -> Vec<u8> {
        let mut data = Vec::with_capacity(Self::DATA_LEN);
        data.extend_from_slice(&self.task_id.to_le_bytes());
        data.extend_from_slice(&self.poster);
        data.extend_from_slice(&self.judge);
        data.extend_from_slice(&self.reward.to_le_bytes());
        data.push(self.category);
        data.extend_from_slice(&self.deadline.to_le_bytes());
        data
    }
}

impl TaskCreatedEvent {
    pub const DATA_LEN: usize = 8 + 32 + 32 + 8 + 1 + 8;
}
