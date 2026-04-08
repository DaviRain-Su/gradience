//! VRF helper for MagicBlock integration.
//!
//! The MagicBlock ephemeral-vrf program verifies VRF proofs on-chain during
//! `ProvideRandomness` and only invokes our callback (`ReceiveVrfRandomness`)
//! via a signed CPI once the proof is valid.  Gradience therefore does not
//! need to re-verify the proof inside the callback handler.
//!
//! See: https://github.com/magicblock-labs/ephemeral-vrf

/// Derive a deterministic judge index from on-chain randomness.
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
    fn test_select_judge_index() {
        assert_eq!(select_judge_index(7, 3), 1);
        assert_eq!(select_judge_index(10, 5), 0);
        assert_eq!(select_judge_index(0, 1), 0);
        assert_eq!(select_judge_index(100, 0), 0);
    }
}
