use alloc::vec::Vec;
use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::error::ProgramError;
use crate::state::PubkeyBytes;
use crate::traits::InstructionData;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct InitializeEvmAuthorityData {
    pub relayers: Vec<PubkeyBytes>,
    pub max_relayer_age_slots: u64,
}

impl<'a> TryFrom<&'a [u8]> for InitializeEvmAuthorityData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        Self::deserialize(&mut &data[..]).map_err(|_| ProgramError::InvalidInstructionData)
    }
}

impl<'a> InstructionData<'a> for InitializeEvmAuthorityData {
    const LEN: usize = 4 + (32 * 8) + 8; // vec prefix + max relayers + u64
}
