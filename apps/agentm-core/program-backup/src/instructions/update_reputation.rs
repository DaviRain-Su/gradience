//! Update reputation instruction

use borsh::BorshDeserialize;
use pinocchio::{account::AccountView, error::ProgramError, Address};

use crate::{constants::MAX_REPUTATION_SCORE_BPS, errors::AgentMError, state::Reputation};

#[derive(BorshDeserialize)]
struct UpdateReputationData {
    score_bps: u16,
    won: bool,
    updated_at: i64,
}

pub fn update_reputation(
    _program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> Result<(), ProgramError> {
    let args = UpdateReputationData::try_from_slice(data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    if args.score_bps > MAX_REPUTATION_SCORE_BPS {
        return Err(AgentMError::InvalidReputationScore.into());
    }

    let accounts_iter = &mut accounts.iter();
    let authority = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;
    let agent_account = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;
    let reputation_account = accounts_iter
        .next()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;

    if !authority.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let agent = crate::addr_to_bytes(agent_account.address());
    let mut reputation_data = reputation_account.try_borrow_mut()?;
    let mut reputation = if reputation_data.starts_with(&Reputation::DISCRIMINATOR) {
        let mut rep_slice: &[u8] = &reputation_data;
        Reputation::deserialize(&mut rep_slice).map_err(|_| ProgramError::InvalidAccountData)?
    } else {
        Reputation::new(agent, args.updated_at)
    };

    if reputation.agent != agent {
        return Err(AgentMError::ReputationAccountMismatch.into());
    }

    reputation.apply_review(args.score_bps, args.won, args.updated_at);
    let serialized = borsh::to_vec(&reputation).map_err(|_| ProgramError::InvalidAccountData)?;
    if reputation_data.len() < serialized.len() {
        return Err(ProgramError::AccountDataTooSmall);
    }
    reputation_data[..serialized.len()].copy_from_slice(&serialized);

    Ok(())
}
