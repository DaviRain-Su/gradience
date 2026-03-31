use alloc::vec::Vec;
use codama::CodamaType;

use crate::traits::{EventDiscriminator, EventDiscriminators, EventSerialize};

#[derive(CodamaType)]
pub struct TaskAppliedEvent {
    pub task_id: u64,
    pub agent: [u8; 32],
    pub stake: u64,
    pub slot: u64,
}

impl EventDiscriminator for TaskAppliedEvent {
    const DISCRIMINATOR: u8 = EventDiscriminators::TaskApplied as u8;
}

impl EventSerialize for TaskAppliedEvent {
    #[inline(always)]
    fn to_bytes_inner(&self) -> Vec<u8> {
        let mut data = Vec::with_capacity(Self::DATA_LEN);
        data.extend_from_slice(&self.task_id.to_le_bytes());
        data.extend_from_slice(&self.agent);
        data.extend_from_slice(&self.stake.to_le_bytes());
        data.extend_from_slice(&self.slot.to_le_bytes());
        data
    }
}

impl TaskAppliedEvent {
    pub const DATA_LEN: usize = 8 + 32 + 8 + 8;
}
