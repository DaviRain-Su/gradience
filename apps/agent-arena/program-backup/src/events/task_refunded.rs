use alloc::vec::Vec;
use codama::CodamaType;

use crate::traits::{EventDiscriminator, EventDiscriminators, EventSerialize};

pub const TASK_REFUND_REASON_EXPIRED: u8 = 0;
pub const TASK_REFUND_REASON_CANCELLED: u8 = 1;
pub const TASK_REFUND_REASON_LOW_SCORE: u8 = 2;
pub const TASK_REFUND_REASON_FORCE_REFUND: u8 = 3;

#[derive(CodamaType)]
pub struct TaskRefundedEvent {
    pub task_id: u64,
    pub reason: u8,
    pub amount: u64,
}

impl EventDiscriminator for TaskRefundedEvent {
    const DISCRIMINATOR: u8 = EventDiscriminators::TaskRefunded as u8;
}

impl EventSerialize for TaskRefundedEvent {
    #[inline(always)]
    fn to_bytes_inner(&self) -> Vec<u8> {
        let mut data = Vec::with_capacity(Self::DATA_LEN);
        data.extend_from_slice(&self.task_id.to_le_bytes());
        data.push(self.reason);
        data.extend_from_slice(&self.amount.to_le_bytes());
        data
    }
}

impl TaskRefundedEvent {
    pub const DATA_LEN: usize = 8 + 1 + 8;
}
