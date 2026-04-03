// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {Ed25519} from "./libraries/Ed25519.sol";

contract ReputationVerifier {
    uint64 public constant MAX_FUTURE_SKEW = 600;
    bytes32 public constant SOLANA_CHAIN_HASH =
        0x6eef29ebb03aa2144a1a6b6212ce74f504a34db799b8161a21140017e80d3d8a;

    struct ReputationPayload {
        bytes32 agentPubkey;
        uint16 globalScore;
        uint16[8] categoryScores;
        bytes32 sourceChain;
        uint64 timestamp;
    }

    struct ReputationSnapshot {
        uint16 globalScore;
        uint16[8] categoryScores;
        bytes32 sourceChain;
        uint64 timestamp;
        bytes32 signerPubkey;
    }

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Ed25519SignerUpdated(bytes32 indexed previousSigner, bytes32 indexed newSigner);
    event MaxAttestationAgeUpdated(uint64 previousValue, uint64 newValue);
    event ReputationStored(bytes32 indexed agentPubkey, uint16 globalScore, uint64 timestamp);

    address public owner;
    bytes32 public ed25519Signer;
    uint64 public maxAttestationAge;

    mapping(bytes32 => ReputationSnapshot) private _snapshots;
    mapping(bytes32 => bool) private _snapshotExists;

    modifier onlyOwner() {
        require(msg.sender == owner, "OWNABLE: caller is not owner");
        _;
    }

    constructor(bytes32 signer_, uint64 maxAttestationAge_) public {
        require(signer_ != bytes32(0), "INVALID_SIGNER");
        owner = msg.sender;
        ed25519Signer = signer_;
        maxAttestationAge = maxAttestationAge_;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "INVALID_OWNER");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setEd25519Signer(bytes32 signer_) external onlyOwner {
        require(signer_ != bytes32(0), "INVALID_SIGNER");
        bytes32 previous = ed25519Signer;
        ed25519Signer = signer_;
        emit Ed25519SignerUpdated(previous, signer_);
    }

    function setMaxAttestationAge(uint64 maxAttestationAge_) external onlyOwner {
        uint64 previous = maxAttestationAge;
        maxAttestationAge = maxAttestationAge_;
        emit MaxAttestationAgeUpdated(previous, maxAttestationAge_);
    }

    function verifyReputation(
        ReputationPayload calldata payload,
        bytes32 signatureR,
        bytes32 signatureS
    ) external view returns (bool) {
        ReputationPayload memory payloadCopy = payload;
        if (!_isPayloadValid(payloadCopy)) {
            return false;
        }
        bytes memory encoded = abi.encode(
            payload.agentPubkey,
            payload.globalScore,
            payload.categoryScores,
            payload.sourceChain,
            payload.timestamp
        );
        return Ed25519.verify(ed25519Signer, signatureR, signatureS, encoded);
    }

    function submitReputation(
        ReputationPayload calldata payload,
        bytes32 signatureR,
        bytes32 signatureS
    ) external returns (bool) {
        ReputationPayload memory payloadCopy = payload;
        if (!_isPayloadValid(payloadCopy)) {
            revert("INVALID_PAYLOAD");
        }
        bytes memory encoded = abi.encode(
            payload.agentPubkey,
            payload.globalScore,
            payload.categoryScores,
            payload.sourceChain,
            payload.timestamp
        );
        if (!Ed25519.verify(ed25519Signer, signatureR, signatureS, encoded)) {
            revert("INVALID_SIGNATURE");
        }

        ReputationSnapshot storage existing = _snapshots[payload.agentPubkey];
        if (_snapshotExists[payload.agentPubkey]) {
            require(payload.timestamp > existing.timestamp, "NON_MONOTONIC_TIMESTAMP");
        }

        existing.globalScore = payload.globalScore;
        existing.categoryScores = payload.categoryScores;
        existing.sourceChain = payload.sourceChain;
        existing.timestamp = payload.timestamp;
        existing.signerPubkey = ed25519Signer;
        _snapshotExists[payload.agentPubkey] = true;

        emit ReputationStored(payload.agentPubkey, payload.globalScore, payload.timestamp);
        return true;
    }

    function getSnapshot(
        bytes32 agentPubkey
    ) external view returns (ReputationSnapshot memory snapshot, bool exists) {
        return (_snapshots[agentPubkey], _snapshotExists[agentPubkey]);
    }

    function _isPayloadValid(ReputationPayload memory payload) internal view returns (bool) {
        uint256 nowTs = block.timestamp;
        if (payload.sourceChain != SOLANA_CHAIN_HASH) {
            return false;
        }
        if (payload.timestamp == 0) {
            return false;
        }
        uint256 payloadTimestamp = uint256(payload.timestamp);
        uint256 maxFutureSkew = uint256(MAX_FUTURE_SKEW);
        if (nowTs > type(uint256).max - maxFutureSkew) {
            return false;
        }
        if (payloadTimestamp > nowTs + maxFutureSkew) {
            return false;
        }
        uint256 maxAge = uint256(maxAttestationAge);
        if (maxAge > 0 && nowTs > maxAge) {
            if (payloadTimestamp < nowTs - maxAge) {
                return false;
            }
        }
        return true;
    }
}
