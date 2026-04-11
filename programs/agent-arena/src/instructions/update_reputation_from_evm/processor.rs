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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        constants::MAX_CATEGORIES,
        state::{
            ACCOUNT_VERSION_V1, EVM_AUTHORITY_DISCRIMINATOR, REPUTATION_DISCRIMINATOR,
            ReputationStats, CategoryStats, PubkeyBytes, EvmAuthority,
        },
        instructions::update_reputation_from_evm::data::EvmReputationUpdate,
    };
    use core::mem::size_of;
    use pinocchio::account::{AccountView, RuntimeAccount, NOT_BORROWED};
    use solana_address::Address;
    use alloc::string::String;
    use alloc::vec::Vec;
    use ed25519_dalek::Signer;

    struct MockAccount {
        _buf: Vec<u8>,
        view: AccountView,
    }

    impl MockAccount {
        fn new(address: Address, owner: Address, is_signer: bool, initial_data: &[u8], capacity: usize) -> Self {
            let runtime_size = size_of::<RuntimeAccount>();
            let total_size = runtime_size + capacity;
            let mut buf = Vec::with_capacity(total_size);
            buf.resize(total_size, 0u8);
            let raw = buf.as_mut_ptr() as *mut RuntimeAccount;
            unsafe {
                (*raw).borrow_state = NOT_BORROWED;
                (*raw).is_signer = if is_signer { 1 } else { 0 };
                (*raw).is_writable = 1;
                (*raw).executable = 0;
                (*raw).resize_delta = 0;
                (*raw).address = address;
                (*raw).owner = owner;
                (*raw).lamports = 1;
                (*raw).data_len = initial_data.len() as u64;
                let data_ptr = (raw as *mut u8).add(runtime_size);
                core::ptr::copy_nonoverlapping(initial_data.as_ptr(), data_ptr, initial_data.len());
            }
            let view = unsafe { AccountView::new_unchecked(raw) };
            Self { _buf: buf, view }
        }
    }

    fn make_reputation(agent: PubkeyBytes, nonce: u64) -> Reputation {
        let mut by_category = [CategoryStats::default(); MAX_CATEGORIES];
        for (idx, stats) in by_category.iter_mut().enumerate() {
            stats.category = idx as u8;
        }
        Reputation {
            agent,
            global: ReputationStats::default(),
            by_category,
            bump: 1,
            evm_sync_nonce: nonce,
        }
    }

    fn make_evm_authority(relayers: Vec<PubkeyBytes>) -> EvmAuthority {
        EvmAuthority {
            owner: [0u8; 32],
            relayers,
            max_relayer_age_slots: 100,
            bump: 1,
        }
    }

    fn reputation_data(rep: &Reputation) -> Vec<u8> {
        let mut out = vec![ACCOUNT_VERSION_V1, REPUTATION_DISCRIMINATOR];
        out.append(&mut borsh::to_vec(rep).unwrap());
        out
    }

    fn evm_authority_data(auth: &EvmAuthority) -> Vec<u8> {
        let mut out = vec![ACCOUNT_VERSION_V1, EVM_AUTHORITY_DISCRIMINATOR];
        out.append(&mut borsh::to_vec(auth).unwrap());
        out
    }

    #[test]
    fn test_process_update_reputation_from_evm_success() {
        let program_id = Address::new_from_array([99u8; 32]);

        // Relayer keypair
        let relayer_secret: [u8; 32] = [1u8; 32];
        let relayer_signing = ed25519_dalek::SigningKey::from_bytes(&relayer_secret);
        let relayer_pubkey = relayer_signing.verifying_key().to_bytes();

        let agent_bytes: [u8; 32] = [2u8; 32];

        let (reputation_pda, _) = Address::find_program_address(&[REPUTATION_SEED, &agent_bytes], &program_id);
        let (evm_authority_pda, _) = Address::find_program_address(&[EVM_AUTHORITY_SEED], &program_id);

        let reputation = make_reputation(agent_bytes, 0);
        let rep_data = reputation_data(&reputation);
        let evm_auth = make_evm_authority(vec![relayer_pubkey]);
        let auth_data = evm_authority_data(&evm_auth);

        let reputation_account = MockAccount::new(reputation_pda, program_id, false, &rep_data, 512);
        let evm_authority_account = MockAccount::new(evm_authority_pda, program_id, false, &auth_data, 512);
        let relayer_account = MockAccount::new(Address::new_from_array(relayer_pubkey), program_id, true, &[], 0);
        let agent_account = MockAccount::new(Address::new_from_array(agent_bytes), program_id, false, &[], 0);
        let system_account = MockAccount::new(pinocchio_system::ID, pinocchio_system::ID, false, &[], 0);

        let accounts: [AccountView; 5] = [
            relayer_account.view,
            agent_account.view,
            reputation_account.view,
            evm_authority_account.view,
            system_account.view,
        ];

        let update = EvmReputationUpdate {
            agent: agent_bytes,
            chain_id: 1,
            nonce: 1,
            completed: 5,
            total_applied_delta: 10,
            score_sum: 350,
            category: 0,
            source: String::from("test"),
            proof: Vec::new(),
        };
        let message = build_relayer_message(&update);
        let signature = relayer_signing.sign(&message);

        let mut ix_data = borsh::to_vec(&EvmReputationUpdate {
            proof: signature.to_bytes().to_vec(),
            ..update
        }).unwrap();

        let result = process_update_reputation_from_evm(&program_id, &accounts, &ix_data);
        assert!(result.is_ok(), "Expected success: {:?}", result);

        // Verify nonce updated and data written back
        let rep: Reputation = {
            let data = accounts[2].try_borrow().unwrap();
            assert_eq!(data[0], ACCOUNT_VERSION_V1);
            assert_eq!(data[1], REPUTATION_DISCRIMINATOR);
            Reputation::deserialize(&mut &data[2..]).unwrap()
        };
        assert_eq!(rep.evm_sync_nonce, 1);
        assert_eq!(rep.global.completed, 5);
        assert_eq!(rep.global.total_applied, 10);
        assert_eq!(rep.global.avg_score, 70);
        assert_eq!(rep.by_category[0].completed, 5);
    }

    #[test]
    fn test_process_update_reputation_from_evm_nonce_too_old() {
        let program_id = Address::new_from_array([99u8; 32]);
        let relayer_secret: [u8; 32] = [1u8; 32];
        let relayer_signing = ed25519_dalek::SigningKey::from_bytes(&relayer_secret);
        let relayer_pubkey = relayer_signing.verifying_key().to_bytes();
        let agent_bytes: [u8; 32] = [2u8; 32];

        let (reputation_pda, _) = Address::find_program_address(&[REPUTATION_SEED, &agent_bytes], &program_id);
        let (evm_authority_pda, _) = Address::find_program_address(&[EVM_AUTHORITY_SEED], &program_id);

        let reputation = make_reputation(agent_bytes, 5);
        let rep_data = reputation_data(&reputation);
        let evm_auth = make_evm_authority(vec![relayer_pubkey]);
        let auth_data = evm_authority_data(&evm_auth);

        let reputation_account = MockAccount::new(reputation_pda, program_id, false, &rep_data, 512);
        let evm_authority_account = MockAccount::new(evm_authority_pda, program_id, false, &auth_data, 512);
        let relayer_account = MockAccount::new(Address::new_from_array(relayer_pubkey), program_id, true, &[], 0);
        let agent_account = MockAccount::new(Address::new_from_array(agent_bytes), program_id, false, &[], 0);
        let system_account = MockAccount::new(pinocchio_system::ID, pinocchio_system::ID, false, &[], 0);

        let accounts = [relayer_account.view, agent_account.view, reputation_account.view, evm_authority_account.view, system_account.view];

        let update = EvmReputationUpdate {
            agent: agent_bytes,
            chain_id: 1,
            nonce: 3, // less than 5
            completed: 1,
            total_applied_delta: 1,
            score_sum: 50,
            category: 255,
            source: String::from("test"),
            proof: Vec::new(),
        };
        let message = build_relayer_message(&update);
        let signature = relayer_signing.sign(&message);
        let ix_data = borsh::to_vec(&EvmReputationUpdate {
            proof: signature.to_bytes().to_vec(),
            ..update
        }).unwrap();

        let result = process_update_reputation_from_evm(&program_id, &accounts, &ix_data);
        assert_eq!(result, Err(GradienceProgramError::EvmNonceTooOld.into()));
    }

    #[test]
    fn test_process_update_reputation_from_evm_unauthorized_relayer() {
        let program_id = Address::new_from_array([99u8; 32]);
        let authorized_secret: [u8; 32] = [7u8; 32];
        let authorized_pubkey = ed25519_dalek::SigningKey::from_bytes(&authorized_secret).verifying_key().to_bytes();

        let unauthorized_secret: [u8; 32] = [1u8; 32];
        let unauthorized_signing = ed25519_dalek::SigningKey::from_bytes(&unauthorized_secret);
        let unauthorized_pubkey = unauthorized_signing.verifying_key().to_bytes();

        let agent_bytes: [u8; 32] = [2u8; 32];
        let (reputation_pda, _) = Address::find_program_address(&[REPUTATION_SEED, &agent_bytes], &program_id);
        let (evm_authority_pda, _) = Address::find_program_address(&[EVM_AUTHORITY_SEED], &program_id);

        let reputation = make_reputation(agent_bytes, 0);
        let rep_data = reputation_data(&reputation);
        let evm_auth = make_evm_authority(vec![authorized_pubkey]); // only authorized is allowed
        let auth_data = evm_authority_data(&evm_auth);

        let reputation_account = MockAccount::new(reputation_pda, program_id, false, &rep_data, 512);
        let evm_authority_account = MockAccount::new(evm_authority_pda, program_id, false, &auth_data, 512);
        let relayer_account = MockAccount::new(Address::new_from_array(unauthorized_pubkey), program_id, true, &[], 0);
        let agent_account = MockAccount::new(Address::new_from_array(agent_bytes), program_id, false, &[], 0);
        let system_account = MockAccount::new(pinocchio_system::ID, pinocchio_system::ID, false, &[], 0);

        let accounts = [relayer_account.view, agent_account.view, reputation_account.view, evm_authority_account.view, system_account.view];

        let update = EvmReputationUpdate {
            agent: agent_bytes,
            chain_id: 1,
            nonce: 1,
            completed: 1,
            total_applied_delta: 1,
            score_sum: 50,
            category: 255,
            source: String::from("test"),
            proof: Vec::new(),
        };
        let message = build_relayer_message(&update);
        let signature = unauthorized_signing.sign(&message);
        let ix_data = borsh::to_vec(&EvmReputationUpdate {
            proof: signature.to_bytes().to_vec(),
            ..update
        }).unwrap();

        let result = process_update_reputation_from_evm(&program_id, &accounts, &ix_data);
        assert_eq!(result, Err(GradienceProgramError::UnauthorizedRelayer.into()));
    }

    #[test]
    fn test_process_update_reputation_from_evm_invalid_signature() {
        let program_id = Address::new_from_array([99u8; 32]);
        let relayer_secret: [u8; 32] = [1u8; 32];
        let relayer_signing = ed25519_dalek::SigningKey::from_bytes(&relayer_secret);
        let relayer_pubkey = relayer_signing.verifying_key().to_bytes();

        let wrong_secret: [u8; 32] = [8u8; 32];
        let wrong_signing = ed25519_dalek::SigningKey::from_bytes(&wrong_secret);

        let agent_bytes: [u8; 32] = [2u8; 32];
        let (reputation_pda, _) = Address::find_program_address(&[REPUTATION_SEED, &agent_bytes], &program_id);
        let (evm_authority_pda, _) = Address::find_program_address(&[EVM_AUTHORITY_SEED], &program_id);

        let reputation = make_reputation(agent_bytes, 0);
        let rep_data = reputation_data(&reputation);
        let evm_auth = make_evm_authority(vec![relayer_pubkey]);
        let auth_data = evm_authority_data(&evm_auth);

        let reputation_account = MockAccount::new(reputation_pda, program_id, false, &rep_data, 512);
        let evm_authority_account = MockAccount::new(evm_authority_pda, program_id, false, &auth_data, 512);
        let relayer_account = MockAccount::new(Address::new_from_array(relayer_pubkey), program_id, true, &[], 0);
        let agent_account = MockAccount::new(Address::new_from_array(agent_bytes), program_id, false, &[], 0);
        let system_account = MockAccount::new(pinocchio_system::ID, pinocchio_system::ID, false, &[], 0);

        let accounts = [relayer_account.view, agent_account.view, reputation_account.view, evm_authority_account.view, system_account.view];

        let update = EvmReputationUpdate {
            agent: agent_bytes,
            chain_id: 1,
            nonce: 1,
            completed: 1,
            total_applied_delta: 1,
            score_sum: 50,
            category: 255,
            source: String::from("test"),
            proof: Vec::new(),
        };
        let message = build_relayer_message(&update);
        let wrong_signature = wrong_signing.sign(&message);
        let ix_data = borsh::to_vec(&EvmReputationUpdate {
            proof: wrong_signature.to_bytes().to_vec(),
            ..update
        }).unwrap();

        let result = process_update_reputation_from_evm(&program_id, &accounts, &ix_data);
        assert_eq!(result, Err(GradienceProgramError::InvalidRelayerSignature.into()));
    }

    #[test]
    fn test_merge_evm_reputation_updates_correctly() {
        let mut reputation = make_reputation([0u8; 32], 0);
        reputation.global.completed = 10;
        reputation.global.total_applied = 20;
        reputation.global.avg_score = 50;

        merge_evm_reputation(&mut reputation, 5, 5, 400, 1).unwrap();

        assert_eq!(reputation.global.completed, 15);
        assert_eq!(reputation.global.total_applied, 25);
        assert_eq!(reputation.global.avg_score, 60); // (10*50 + 400) / 15 = 60
        assert_eq!(reputation.by_category[1].completed, 5);
        assert_eq!(reputation.by_category[1].avg_score, 80); // 400 / 5 = 80
    }

    #[test]
    fn test_build_relayer_message_deterministic() {
        let update1 = EvmReputationUpdate {
            agent: [1u8; 32],
            chain_id: 1,
            nonce: 2,
            completed: 3,
            total_applied_delta: 4,
            score_sum: 5,
            category: 6,
            source: String::from("src"),
            proof: vec![],
        };
        let update2 = EvmReputationUpdate {
            agent: [1u8; 32],
            chain_id: 1,
            nonce: 2,
            completed: 3,
            total_applied_delta: 4,
            score_sum: 5,
            category: 6,
            source: String::from("src"),
            proof: vec![9u8; 64], // different proof should not affect message
        };
        assert_eq!(build_relayer_message(&update1), build_relayer_message(&update2));
    }

    #[test]
    fn test_verify_ed25519_valid_and_invalid() {
        let signing_key = ed25519_dalek::SigningKey::from_bytes(&[5u8; 32]);
        let pubkey = signing_key.verifying_key().to_bytes();
        let message = [10u8; 32];
        let signature = signing_key.sign(&message);

        assert!(verify_ed25519(&pubkey, &message, &signature.to_bytes()));

        let bad_sig = [0u8; 64];
        assert!(!verify_ed25519(&pubkey, &message, &bad_sig));
    }
}
