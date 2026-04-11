use alloc::vec;
use borsh::BorshDeserialize;
use ed25519_dalek::Verifier;
use pinocchio::{account::AccountView, error::ProgramError, Address, ProgramResult};

use crate::{
    constants::MAX_CATEGORIES,
    errors::GradienceProgramError,
    instructions::UpdateReputationFromEvm,
    state::{
        EVM_AUTHORITY_SEED, EVM_AUTHORITY_DISCRIMINATOR, REPUTATION_DISCRIMINATOR,
        EvmAuthority, Reputation,
    },
    utils::verify_owned_by,
};

const REPUTATION_SEED: &[u8] = b"reputation";

#[inline(always)]
fn address_to_bytes(address: &Address) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(address.as_ref());
    bytes
}

pub fn process_update_reputation_from_evm(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let ix = UpdateReputationFromEvm::try_from((instruction_data, accounts))?;

    // 1. Verify reputation PDA
    let (reputation_pda, _) = Address::find_program_address(
        &[REPUTATION_SEED, ix.data.agent.as_ref()],
        program_id,
    );
    if ix.accounts.reputation.address() != &reputation_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    // 2. Verify evm_authority PDA
    let (evm_authority_pda, _) = Address::find_program_address(
        &[EVM_AUTHORITY_SEED],
        program_id,
    );
    if ix.accounts.evm_authority.address() != &evm_authority_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    verify_owned_by(ix.accounts.reputation, program_id)?;
    verify_owned_by(ix.accounts.evm_authority, program_id)?;

    // 3. Parse reputation
    let mut reputation: Reputation = {
        let data = ix.accounts.reputation.try_borrow()?;
        if data.len() < 2 || data[0] != crate::state::ACCOUNT_VERSION_V1 || data[1] != REPUTATION_DISCRIMINATOR {
            return Err(ProgramError::InvalidAccountData);
        }
        Reputation::deserialize(&mut &data[2..]).map_err(|_| ProgramError::InvalidAccountData)?
    };

    // 4. Nonce replay protection
    if ix.data.nonce <= reputation.evm_sync_nonce {
        return Err(GradienceProgramError::EvmNonceTooOld.into());
    }

    // 5. Parse evm_authority and verify relayer
    let evm_authority: EvmAuthority = {
        let data = ix.accounts.evm_authority.try_borrow()?;
        if data.len() < 2 || data[0] != crate::state::ACCOUNT_VERSION_V1 || data[1] != EVM_AUTHORITY_DISCRIMINATOR {
            return Err(GradienceProgramError::EvmAuthorityNotInitialized.into());
        }
        EvmAuthority::deserialize(&mut &data[2..]).map_err(|_| ProgramError::InvalidAccountData)?
    };

    let relayer_pubkey = address_to_bytes(ix.accounts.relayer.address());
    if !evm_authority.relayers.iter().any(|r| r.as_slice() == relayer_pubkey.as_slice()) {
        return Err(GradienceProgramError::UnauthorizedRelayer.into());
    }

    // 6. Verify Ed25519 signature
    let message = build_relayer_message(&ix.data);
    if !verify_ed25519(&relayer_pubkey, &message, &ix.data.proof) {
        return Err(GradienceProgramError::InvalidRelayerSignature.into());
    }

    // 7. Merge EVM reputation
    merge_evm_reputation(
        &mut reputation,
        ix.data.completed,
        ix.data.total_applied_delta,
        ix.data.score_sum,
        ix.data.category,
    )?;

    // 8. Update nonce and write back
    reputation.evm_sync_nonce = ix.data.nonce;
    let mut serialized = borsh::to_vec(&reputation).map_err(|_| ProgramError::InvalidAccountData)?;
    let mut out = vec![crate::state::ACCOUNT_VERSION_V1, REPUTATION_DISCRIMINATOR];
    out.append(&mut serialized);

    {
        let mut data = ix.accounts.reputation.try_borrow_mut()?;
        data[..out.len()].copy_from_slice(&out);
    }

    Ok(())
}

fn build_relayer_message(ix: &crate::instructions::update_reputation_from_evm::data::EvmReputationUpdate) -> [u8; 32] {
    use const_crypto::sha2::Sha256;
    let chain_id_le = ix.chain_id.to_le_bytes();
    let nonce_le = ix.nonce.to_le_bytes();
    let completed_le = ix.completed.to_le_bytes();
    let total_applied_le = ix.total_applied_delta.to_le_bytes();
    let score_sum_le = ix.score_sum.to_le_bytes();
    let category_le = ix.category.to_le_bytes();
    let source_bytes = ix.source.as_bytes();

    Sha256::new()
        .update(&ix.agent)
        .update(&chain_id_le)
        .update(&nonce_le)
        .update(&completed_le)
        .update(&total_applied_le)
        .update(&score_sum_le)
        .update(&category_le)
        .update(source_bytes)
        .finalize()
}

fn verify_ed25519(public_key: &[u8; 32], message: &[u8; 32], signature: &[u8]) -> bool {
    if signature.len() != 64 {
        return false;
    }
    let sig_bytes: [u8; 64] = signature.try_into().unwrap_or([0u8; 64]);
    let Ok(verifying_key) = ed25519_dalek::VerifyingKey::from_bytes(public_key) else {
        return false;
    };
    let Ok(sig) = ed25519_dalek::Signature::from_slice(&sig_bytes) else {
        return false;
    };
    verifying_key.verify(message, &sig).is_ok()
}

fn merge_evm_reputation(
    reputation: &mut Reputation,
    completed_delta: u32,
    total_applied_delta: u32,
    score_sum: u64,
    category: u8,
) -> ProgramResult {
    if completed_delta == 0 && total_applied_delta == 0 {
        return Ok(());
    }

    // Update global.completed
    let prev_global_completed = reputation.global.completed;
    let next_global_completed = prev_global_completed
        .checked_add(completed_delta)
        .ok_or(GradienceProgramError::Overflow)?;

    // Update global.avg_score (weighted average)
    if completed_delta > 0 {
        let prev_avg = (reputation.global.avg_score as u128)
            .checked_mul(prev_global_completed as u128)
            .unwrap_or(0);
        let new_avg = (prev_avg + score_sum as u128)
            .checked_div(next_global_completed as u128)
            .ok_or(GradienceProgramError::Overflow)?;
        reputation.global.avg_score = u16::try_from(new_avg)
            .map_err(|_| ProgramError::from(GradienceProgramError::Overflow))?;
    }

    reputation.global.completed = next_global_completed;

    // Update global.total_applied
    reputation.global.total_applied = reputation.global.total_applied
        .checked_add(total_applied_delta)
        .ok_or(GradienceProgramError::Overflow)?;

    // Update global.win_rate
    reputation.global.win_rate = if reputation.global.total_applied == 0 {
        0
    } else {
        let wr = (reputation.global.completed as u128)
            .checked_mul(10_000)
            .and_then(|v| v.checked_div(reputation.global.total_applied as u128))
            .ok_or(GradienceProgramError::Overflow)?;
        u16::try_from(wr).map_err(|_| ProgramError::from(GradienceProgramError::Overflow))?
    };

    // Update category if specified
    if category != 255 && (category as usize) < MAX_CATEGORIES && completed_delta > 0 {
        let cat = &mut reputation.by_category[category as usize];
        let prev_cat_completed = cat.completed;
        let next_cat_completed = prev_cat_completed
            .checked_add(completed_delta)
            .ok_or(GradienceProgramError::Overflow)?;

        let prev_cat_avg = (cat.avg_score as u128)
            .checked_mul(prev_cat_completed as u128)
            .unwrap_or(0);
        let new_cat_avg = (prev_cat_avg + score_sum as u128)
            .checked_div(next_cat_completed as u128)
            .ok_or(GradienceProgramError::Overflow)?;

        cat.completed = next_cat_completed;
        cat.avg_score = u16::try_from(new_cat_avg)
            .map_err(|_| ProgramError::from(GradienceProgramError::Overflow))?;
    }

    Ok(())
}
