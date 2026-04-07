// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @notice 0.8.24-compatible interface for the Gradience Reputation Verifier.
 * @dev Decouples AgentArenaEVM from the legacy ^0.6.8 ReputationVerifier implementation.
 */
interface IReputationVerifier {
    struct Snapshot {
        uint16 globalScore;
        uint16[8] categoryScores;
        bytes32 sourceChain;
        uint64 timestamp;
        bytes32 signerPubkey;
        bool exists;
    }

    function getSnapshot(bytes32 agentPubkey) external view returns (Snapshot memory snapshot, bool exists);

    function verifyReputation(
        bytes calldata payload,
        bytes32 signatureR,
        bytes32 signatureS
    ) external view returns (bool);
}
