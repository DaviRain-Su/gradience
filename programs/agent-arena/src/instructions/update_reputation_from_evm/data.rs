use alloc::string::String;
use alloc::vec::Vec;
use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::error::ProgramError;
use crate::state::PubkeyBytes;
use crate::traits::InstructionData;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct EvmReputationUpdate {
    pub agent: PubkeyBytes,
    pub chain_id: u64,
    pub nonce: u64,
    pub completed: u32,
    pub total_applied_delta: u32,
    pub score_sum: u64,
    pub category: u8,
    pub source: String,
    pub proof: Vec<u8>,
}

impl<'a> TryFrom<&'a [u8]> for EvmReputationUpdate {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        Self::deserialize(&mut &data[..]).map_err(|_| ProgramError::InvalidInstructionData)
    }
}

impl<'a> InstructionData<'a> for EvmReputationUpdate {
    // Variable length due to String and Vec<u8>; set a reasonable upper bound
    const LEN: usize = 32 + 8 + 8 + 4 + 4 + 8 + 1 + 4 + 64 + 4 + 64;
}
