use alloc::{string::String, vec::Vec};
use codama::CodamaType;

use crate::traits::{EventDiscriminator, EventDiscriminators, EventSerialize};

#[derive(CodamaType)]
pub struct SubmissionReceivedEvent {
    pub task_id: u64,
    pub agent: [u8; 32],
    pub result_ref: String,
    pub trace_ref: String,
    pub submission_slot: u64,
}

impl EventDiscriminator for SubmissionReceivedEvent {
    const DISCRIMINATOR: u8 = EventDiscriminators::SubmissionReceived as u8;
}

impl EventSerialize for SubmissionReceivedEvent {
    #[inline(always)]
    fn to_bytes_inner(&self) -> Vec<u8> {
        let mut data = Vec::new();
        data.extend_from_slice(&self.task_id.to_le_bytes());
        data.extend_from_slice(&self.agent);
        data.extend_from_slice(&(self.result_ref.len() as u32).to_le_bytes());
        data.extend_from_slice(self.result_ref.as_bytes());
        data.extend_from_slice(&(self.trace_ref.len() as u32).to_le_bytes());
        data.extend_from_slice(self.trace_ref.as_bytes());
        data.extend_from_slice(&self.submission_slot.to_le_bytes());
        data
    }
}
