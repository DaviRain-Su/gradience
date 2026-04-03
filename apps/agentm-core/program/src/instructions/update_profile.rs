//! Update profile instruction
use pinocchio::{account_info::AccountInfo, program_error::ProgramError, pubkey::Pubkey};
use crate::{constants::*, errors::AgentMError, state::Profile};

pub fn update_profile(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> Result<(), ProgramError> {
    let accounts_iter = &mut accounts.iter();
    let user = accounts_iter.next().ok_or(ProgramError::NotEnoughAccountKeys)?;
    let profile_account = accounts_iter.next().ok_or(ProgramError::NotEnoughAccountKeys)?;
    
    if !user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Parse profile data (simplified)
    let display_name = String::from_utf8(data.to_vec()).unwrap_or_default();
    
    if display_name.len() > MAX_DISPLAY_NAME_LEN {
        return Err(AgentMError::DisplayNameTooLong.into());
    }
    
    let profile = Profile {
        discriminator: Profile::DISCRIMINATOR,
        version: 1,
        user: user.key().to_bytes(),
        display_name,
        bio: String::new(),
        avatar_url: String::new(),
        updated_at: 0,
    };
    
    let mut profile_data = profile_account.try_borrow_mut_data()?;
    let serialized = borsh::to_vec(&profile).map_err(|_| ProgramError::InvalidAccountData)?;
    profile_data[..serialized.len()].copy_from_slice(&serialized);
    
    Ok(())
}
