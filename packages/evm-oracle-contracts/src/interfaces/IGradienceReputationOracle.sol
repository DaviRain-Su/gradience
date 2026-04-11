// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IGradienceReputationOracle
 * @notice ERC-8004-compatible reputation oracle interface for Gradience Protocol
 */
interface IGradienceReputationOracle {
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------
    error InvalidSignature();
    error InvalidNonce();
    error NotRelayer();
    error StaleData();
    error AgentNotFound();
    error ZeroAddress();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event ReputationUpdated(
        bytes32 indexed agentId,
        uint16 globalScore,
        uint64 updatedAt,
        uint64 nonce,
        bytes32 merkleRoot
    );

    event OracleSignerUpdated(address indexed signer);
    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event MaxAgeUpdated(uint256 maxAge);

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------
    struct ReputationPayload {
        bytes32 agentId;
        uint16 globalScore;
        uint16[8] categoryScores;
        uint64 updatedAt;
        uint8 confidence;
        uint64 nonce;
        bytes32 merkleRoot;
        string sourceChain;
    }

    struct AttestationMetadata {
        bytes32 agentId;
        uint64 updatedAt;
        bytes32 merkleRoot;
        string attestationURI;
        address signer;
    }

    // -------------------------------------------------------------------------
    // State View Functions
    // -------------------------------------------------------------------------
    function oracleSigner() external view returns (address);
    function maxAgeSeconds() external view returns (uint256);
    function nonces(bytes32 agentId) external view returns (uint64);
    function relayers(address account) external view returns (bool);

    // -------------------------------------------------------------------------
    // Core Functions
    // -------------------------------------------------------------------------
    /**
     * @notice Update reputation for an agent. Callable only by whitelisted relayers.
     * @param payload The reputation payload
     * @param signature ECDSA signature from oracleSigner
     */
    function updateReputation(ReputationPayload calldata payload, bytes calldata signature) external;

    /**
     * @notice ERC-8004 compatible reputation query
     * @param agentId The agent identifier
     * @return value Global reputation score as int128
     * @return decimals Number of decimals (2)
     * @return count Number of updates (nonce)
     */
    function getReputation(bytes32 agentId)
        external
        view
        returns (int128 value, uint8 decimals, uint256 count);

    /**
     * @notice Get detailed reputation payload for an agent
     */
    function getDetailedReputation(bytes32 agentId) external view returns (ReputationPayload memory);

    /**
     * @notice Get latest attestation metadata
     */
    function getLatestAttestation(bytes32 agentId) external view returns (AttestationMetadata memory);

    /**
     * @notice Verify an ECDSA signature against the oracleSigner
     */
    function verifySignature(ReputationPayload calldata payload, bytes calldata signature)
        external
        view
        returns (bool);

    /**
     * @notice Check if the stored reputation data is fresh enough
     */
    function isFresh(bytes32 agentId, uint256 maxAge) external view returns (bool);

    // -------------------------------------------------------------------------
    // Admin Functions
    // -------------------------------------------------------------------------
    function setOracleSigner(address newSigner) external;
    function addRelayer(address relayer) external;
    function removeRelayer(address relayer) external;
    function setMaxAgeSeconds(uint256 maxAge) external;
}
