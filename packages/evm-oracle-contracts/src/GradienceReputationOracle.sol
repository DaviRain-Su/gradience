// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGradienceReputationOracle} from "./interfaces/IGradienceReputationOracle.sol";

/**
 * @title GradienceReputationOracle
 * @notice ERC-8004-compatible reputation oracle for Gradience Protocol
 * @dev All reputation data originates from Solana and is pushed to this EVM contract
 *      via whitelisted relayers carrying ECDSA signatures from the oracleSigner.
 */
contract GradienceReputationOracle is IGradienceReputationOracle {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    uint8 public constant CATEGORY_COUNT = 8;
    uint8 public constant SCORE_DECIMALS = 2;

    // -------------------------------------------------------------------------
    // State Variables
    // -------------------------------------------------------------------------
    address public oracleSigner;
    uint256 public maxAgeSeconds;

    mapping(bytes32 => uint64) public nonces;
    mapping(address => bool) public relayers;
    mapping(bytes32 => ReputationPayload) public reputations;
    mapping(bytes32 => AttestationMetadata) public attestations;

    address public owner;

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyRelayer() {
        if (!relayers[msg.sender]) {
            revert NotRelayer();
        }
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _oracleSigner, address _initialRelayer, uint256 _maxAgeSeconds) {
        if (_oracleSigner == address(0) || _initialRelayer == address(0)) {
            revert ZeroAddress();
        }

        owner = msg.sender;
        oracleSigner = _oracleSigner;
        relayers[_initialRelayer] = true;
        maxAgeSeconds = _maxAgeSeconds == 0 ? 86400 : _maxAgeSeconds;
    }

    // -------------------------------------------------------------------------
    // External Functions
    // -------------------------------------------------------------------------

    /// @inheritdoc IGradienceReputationOracle
    function updateReputation(ReputationPayload calldata payload, bytes calldata signature)
        external
        override
        onlyRelayer
    {
        // Strict monotonic nonce check
        if (payload.nonce <= nonces[payload.agentId]) {
            revert InvalidNonce();
        }

        // Signature verification
        if (!_verifySignature(payload, signature)) {
            revert InvalidSignature();
        }

        // Store reputation
        reputations[payload.agentId] = payload;
        nonces[payload.agentId] = payload.nonce;

        // Store attestation metadata
        attestations[payload.agentId] = AttestationMetadata({
            agentId: payload.agentId,
            updatedAt: payload.updatedAt,
            merkleRoot: payload.merkleRoot,
            attestationURI: _buildAttestationURI(payload.agentId),
            signer: oracleSigner
        });

        emit ReputationUpdated(
            payload.agentId,
            payload.globalScore,
            payload.updatedAt,
            payload.nonce,
            payload.merkleRoot
        );
    }

    /// @inheritdoc IGradienceReputationOracle
    function getReputation(bytes32 agentId)
        external
        view
        override
        returns (int128 value, uint8 decimals, uint256 count)
    {
        ReputationPayload storage payload = reputations[agentId];

        // Return zeros if never updated
        if (payload.updatedAt == 0) {
            return (0, SCORE_DECIMALS, 0);
        }

        value = int128(uint128(payload.globalScore));
        decimals = SCORE_DECIMALS;
        count = nonces[agentId];
    }

    /// @inheritdoc IGradienceReputationOracle
    function getDetailedReputation(bytes32 agentId)
        external
        view
        override
        returns (ReputationPayload memory)
    {
        ReputationPayload storage payload = reputations[agentId];
        if (payload.updatedAt == 0) {
            revert AgentNotFound();
        }
        return payload;
    }

    /// @inheritdoc IGradienceReputationOracle
    function getLatestAttestation(bytes32 agentId)
        external
        view
        override
        returns (AttestationMetadata memory)
    {
        AttestationMetadata storage meta = attestations[agentId];
        if (meta.updatedAt == 0) {
            revert AgentNotFound();
        }
        return meta;
    }

    /// @inheritdoc IGradienceReputationOracle
    function verifySignature(ReputationPayload calldata payload, bytes calldata signature)
        external
        view
        override
        returns (bool)
    {
        return _verifySignature(payload, signature);
    }

    function _verifySignature(ReputationPayload calldata payload, bytes calldata signature)
        internal
        view
        returns (bool)
    {
        bytes32 hash = _hashPayload(payload);
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(signature);

        address recovered = ecrecover(ethHash, v, r, s);
        return recovered == oracleSigner && recovered != address(0);
    }

    /// @inheritdoc IGradienceReputationOracle
    function isFresh(bytes32 agentId, uint256 maxAge) external view override returns (bool) {
        ReputationPayload storage payload = reputations[agentId];
        if (payload.updatedAt == 0) return false;

        uint256 age = block.timestamp > payload.updatedAt ? block.timestamp - payload.updatedAt : 0;
        return age <= maxAge;
    }

    // -------------------------------------------------------------------------
    // Admin Functions
    // -------------------------------------------------------------------------

    function setOracleSigner(address newSigner) external override onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        oracleSigner = newSigner;
        emit OracleSignerUpdated(newSigner);
    }

    function addRelayer(address relayer) external override onlyOwner {
        if (relayer == address(0)) revert ZeroAddress();
        relayers[relayer] = true;
        emit RelayerAdded(relayer);
    }

    function removeRelayer(address relayer) external override onlyOwner {
        relayers[relayer] = false;
        emit RelayerRemoved(relayer);
    }

    function setMaxAgeSeconds(uint256 maxAge) external override onlyOwner {
        maxAgeSeconds = maxAge;
        emit MaxAgeUpdated(maxAge);
    }

    // -------------------------------------------------------------------------
    // Internal Helpers
    // -------------------------------------------------------------------------

    function _hashPayload(ReputationPayload calldata payload) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                payload.agentId,
                payload.globalScore,
                payload.categoryScores,
                payload.updatedAt,
                payload.confidence,
                payload.nonce,
                payload.merkleRoot,
                payload.sourceChain
            )
        );
    }

    function _splitSignature(bytes calldata sig)
        internal
        pure
        returns (bytes32 r, bytes32 s, uint8 v)
    {
        require(sig.length == 65, "Invalid signature length");

        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }

        if (v < 27) {
            v += 27;
        }
    }

    function _buildAttestationURI(bytes32 agentId) internal pure returns (string memory) {
        // Build a deterministic URI: gradience://reputation/{agentIdHex}
        return string.concat("gradience://reputation/", _bytes32ToHex(agentId));
    }

    function _bytes32ToHex(bytes32 data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            str[i * 2] = alphabet[uint8(data[i] >> 4)];
            str[1 + i * 2] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }
}
