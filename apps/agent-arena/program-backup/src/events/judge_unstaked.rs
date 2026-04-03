use alloc::vec::Vec;
use codama::CodamaType;

use crate::traits::{EventDiscriminator, EventDiscriminators, EventSerialize};

#[derive(CodamaType)]
pub struct JudgeUnstakedEvent {
    pub judge: [u8; 32],
    pub returned_stake: u64,
    pub categories: Vec<u8>,
}

impl EventDiscriminator for JudgeUnstakedEvent {
    const DISCRIMINATOR: u8 = EventDiscriminators::JudgeUnstaked as u8;
}

impl EventSerialize for JudgeUnstakedEvent {
    #[inline(always)]
    fn to_bytes_inner(&self) -> Vec<u8> {
        let categories_len = self.categories.len() as u32;
        let mut data = Vec::with_capacity(Self::BASE_DATA_LEN + self.categories.len());
        data.extend_from_slice(&self.judge);
        data.extend_from_slice(&self.returned_stake.to_le_bytes());
        data.extend_from_slice(&categories_len.to_le_bytes());
        data.extend_from_slice(self.categories.as_slice());
        data
    }
}

impl JudgeUnstakedEvent {
    pub const BASE_DATA_LEN: usize = 32 + 8 + 4;
}
