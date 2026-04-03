use alloc::vec::Vec;
use codama::CodamaType;

use crate::traits::{EventDiscriminator, EventDiscriminators, EventSerialize};

#[derive(CodamaType)]
pub struct TaskCancelledEvent {
    pub task_id: u64,
    pub poster: [u8; 32],
    pub refund_amount: u64,
    pub protocol_fee: u64,
}

impl EventDiscriminator for TaskCancelledEvent {
    const DISCRIMINATOR: u8 = EventDiscriminators::TaskCancelled as u8;
}

impl EventSerialize for TaskCancelledEvent {
    #[inline(always)]
    fn to_bytes_inner(&self) -> Vec<u8> {
        let mut data = Vec::with_capacity(Self::DATA_LEN);
        data.extend_from_slice(&self.task_id.to_le_bytes());
        data.extend_from_slice(&self.poster);
        data.extend_from_slice(&self.refund_amount.to_le_bytes());
        data.extend_from_slice(&self.protocol_fee.to_le_bytes());
        data
    }
}

impl TaskCancelledEvent {
    pub const DATA_LEN: usize = 8 + 32 + 8 + 8;
}
