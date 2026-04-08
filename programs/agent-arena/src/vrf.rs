//! VRF (Verifiable Random Function) placeholder for MagicBlock integration.
//!
//! NOTE: This is a pragmatic stub. Real MagicBlock VRF program layout is not
//! yet documented (GRA-207). Once the official VRF program ID and account
//! schema are published, replace `verify_vrf_proof_stub` with actual account
//! deserialization and curve25519 verification.

use pinocchio::address::Address;

/// VRF proof verification result.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum VRFVerifyResult {
    Valid,
    InvalidProof,
    InvalidRandomness,
}

/// Verifiable-random-function proof placeholder.
///
/// In a full implementation this would contain a Curve25519/Ed25519 signature
/// and auxiliary points. For now we store a 64-byte opaque blob so the
/// instruction account layout stays stable.
pub struct VRFProof {
    pub data: [u8; 64],
}

impl VRFProof {
    pub fn from_bytes(bytes: &[u8]) -> Option<Self> {
        if bytes.len() != 64 {
            return None;
        }
        let mut data = [0u8; 64];
        data.copy_from_slice(bytes);
        Some(VRFProof { data })
    }
}

/// Stub verification of a VRF proof.
///
/// **DO NOT USE IN PRODUCTION.**
/// This always returns `Valid` for well-formed proofs so that downstream
/// judge-selection instructions can be wired and tested end-to-end.
/// Replace with real elliptic-curve VRF verification once MagicBlock
/// documents their on-chain proof format.
pub fn verify_vrf_proof_stub(
    _vrf_pubkey: &Address,
    _proof: &VRFProof,
    _seed: &[u8],
) -> VRFVerifyResult {
    // TODO(GHA): Integrate real VRF verification when MagicBlock SDK stabilizes.
    VRFVerifyResult::Valid
}

/// Derive a deterministic judge index from on-chain randomness.
///
/// callers should already have verified the VRF proof.
pub fn select_judge_index(randomness: u64, candidate_count: usize) -> usize {
    if candidate_count == 0 {
        return 0;
    }
    (randomness as usize) % candidate_count
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vrf_proof_from_bytes() {
        let bytes = [1u8; 64];
        let proof = VRFProof::from_bytes(&bytes).unwrap();
        assert_eq!(proof.data, bytes);

        assert!(VRFProof::from_bytes(&[1u8; 63]).is_none());
        assert!(VRFProof::from_bytes(&[1u8; 65]).is_none());
    }

    #[test]
    fn test_verify_stub_always_valid() {
        let pk = Address::default();
        let proof = VRFProof::from_bytes(&[0u8; 64]).unwrap();
        assert_eq!(
            verify_vrf_proof_stub(&pk, &proof, b"seed"),
            VRFVerifyResult::Valid
        );
    }

    #[test]
    fn test_select_judge_index() {
        assert_eq!(select_judge_index(7, 3), 1);
        assert_eq!(select_judge_index(10, 5), 0);
        assert_eq!(select_judge_index(0, 1), 0);
        assert_eq!(select_judge_index(100, 0), 0);
    }
}
