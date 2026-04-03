//! Update profile instruction

use borsh::BorshDeserialize;
use pinocchio::{account::AccountView, error::ProgramError, Address};

use crate::{constants::*, errors::AgentMError, state::Profile};

#[derive(BorshDeserialize)]
struct UpdateProfileData {
    display_name: String,
    bio: String,
    avatar_url: String,
    updated_at: i64,
}

pub fn update_profile(
    _program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> Result<(), ProgramError> {
    let accounts_iter = &mut accounts.iter();
    let user = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;
    let profile_account = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;

    if !user.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let parsed = parse_profile_data(data)?;
    if parsed.display_name.len() > MAX_DISPLAY_NAME_LEN {
        return Err(AgentMError::DisplayNameTooLong.into());
    }
    if parsed.bio.len() > MAX_BIO_LEN {
        return Err(AgentMError::BioTooLong.into());
    }
    if parsed.avatar_url.len() > MAX_AVATAR_URL_LEN {
        return Err(AgentMError::InvalidProfileData.into());
    }

    let profile = Profile {
        discriminator: Profile::DISCRIMINATOR,
        version: 1,
        user: crate::addr_to_bytes(user.address()),
        display_name: parsed.display_name,
        bio: parsed.bio,
        avatar_url: parsed.avatar_url,
        updated_at: parsed.updated_at,
    };

    let mut profile_data = profile_account.try_borrow_mut()?;
    let serialized = borsh::to_vec(&profile).map_err(|_| ProgramError::InvalidAccountData)?;
    if profile_data.len() < serialized.len() {
        return Err(ProgramError::AccountDataTooSmall);
    }
    profile_data[..serialized.len()].copy_from_slice(&serialized);

    Ok(())
}

fn parse_profile_data(data: &[u8]) -> Result<UpdateProfileData, ProgramError> {
    if let Ok(parsed) = UpdateProfileData::try_from_slice(data) {
        return Ok(parsed);
    }

    let display_name =
        String::from_utf8(data.to_vec()).map_err(|_| AgentMError::InvalidProfileData)?;
    Ok(UpdateProfileData {
        display_name,
        bio: String::new(),
        avatar_url: String::new(),
        updated_at: 0,
    })
}
