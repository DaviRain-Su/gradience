use alloc::vec::Vec;
use pinocchio::error::ProgramError;

use crate::traits::InstructionData;

pub const MEMBER_SIZE: usize = 33; // 1 byte flags + 32 bytes pubkey

/// Parsed instruction data for CreateTaskPermission.
/// Mirrors MagicBlock SDK `MembersArgs`.
///
/// Layout:
///   [members_discriminant: u8] (0 = null, 1 = Some)
///   if 1:
///     [members_len: u32 LE]
///     [member_0: 33 bytes]
///     ...
pub struct CreateTaskPermissionData {
    pub members: Option<Vec<Member>>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Member {
    pub flags: u8,
    pub pubkey: [u8; 32],
}

impl<'a> TryFrom<&'a [u8]> for CreateTaskPermissionData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        if data.is_empty() {
            return Err(ProgramError::InvalidInstructionData);
        }

        let discriminant = data[0];
        match discriminant {
            0 => Ok(CreateTaskPermissionData { members: None }),
            1 => {
                if data.len() < 1 + 4 {
                    return Err(ProgramError::InvalidInstructionData);
                }
                let len = u32::from_le_bytes(
                    data[1..5]
                        .try_into()
                        .map_err(|_| ProgramError::InvalidInstructionData)?,
                ) as usize;
                let expected_len = 1 + 4 + len * MEMBER_SIZE;
                if data.len() < expected_len {
                    return Err(ProgramError::InvalidInstructionData);
                }

                let mut members = Vec::with_capacity(len);
                let mut offset = 5;
                for _ in 0..len {
                    let flags = data[offset];
                    offset += 1;
                    let mut pubkey = [0u8; 32];
                    pubkey.copy_from_slice(&data[offset..offset + 32]);
                    offset += 32;
                    members.push(Member { flags, pubkey });
                }

                Ok(CreateTaskPermissionData {
                    members: Some(members),
                })
            }
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}

impl<'a> InstructionData<'a> for CreateTaskPermissionData {
    const LEN: usize = usize::MAX;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_members_args_null() {
        let data = [0u8];
        let parsed = CreateTaskPermissionData::try_from(&data[..]).unwrap();
        assert!(parsed.members.is_none());
    }

    #[test]
    fn test_members_args_two_members() {
        let mut buf = Vec::new();
        buf.push(1); // Some discriminant
        buf.extend_from_slice(&2u32.to_le_bytes());
        buf.push(0x01); // flags for member 1
        buf.extend_from_slice(&[1u8; 32]);
        buf.push(0x02); // flags for member 2
        buf.extend_from_slice(&[2u8; 32]);

        let parsed = CreateTaskPermissionData::try_from(&buf[..]).unwrap();
        let members = parsed.members.unwrap();
        assert_eq!(members.len(), 2);
        assert_eq!(members[0].flags, 0x01);
        assert_eq!(members[0].pubkey, [1u8; 32]);
        assert_eq!(members[1].flags, 0x02);
        assert_eq!(members[1].pubkey, [2u8; 32]);
    }

    #[test]
    fn test_members_args_invalid_discriminant() {
        let data = [2u8];
        let parsed = CreateTaskPermissionData::try_from(&data[..]);
        assert!(matches!(parsed, Err(ProgramError::InvalidInstructionData)));
    }

    #[test]
    fn test_members_args_too_short() {
        let data = [1u8]; // Some but missing length
        let parsed = CreateTaskPermissionData::try_from(&data[..]);
        assert!(matches!(parsed, Err(ProgramError::InvalidInstructionData)));
    }
}
