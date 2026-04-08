use pinocchio::error::ProgramError;

use crate::traits::InstructionData;

/// Parsed instruction data for BindIdentity.
pub struct BindIdentityData {
    pub evm_address: [u8; 20],
    pub sol_signature: [u8; 64],
    pub evm_signature: [u8; 65],
}

impl<'a> TryFrom<&'a [u8]> for BindIdentityData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        if data.len() != 20 + 64 + 65 {
            return Err(ProgramError::InvalidInstructionData);
        }

        let mut evm_address = [0u8; 20];
        evm_address.copy_from_slice(&data[..20]);

        let mut sol_signature = [0u8; 64];
        sol_signature.copy_from_slice(&data[20..84]);

        let mut evm_signature = [0u8; 65];
        evm_signature.copy_from_slice(&data[84..149]);

        Ok(Self {
            evm_address,
            sol_signature,
            evm_signature,
        })
    }
}

impl<'a> InstructionData<'a> for BindIdentityData {
    const LEN: usize = 149;
}
