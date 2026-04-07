// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IReputationVerifier} from "../interfaces/IReputationVerifier.sol";

/**
 * @notice Test mock for IReputationVerifier.
 */
contract MockReputationVerifier is IReputationVerifier {
    mapping(bytes32 => Snapshot) private _snapshots;

    function setSnapshot(bytes32 agentPubkey, Snapshot calldata snapshot) external {
        _snapshots[agentPubkey] = snapshot;
    }

    function getSnapshot(bytes32 agentPubkey) external view override returns (Snapshot memory snapshot, bool exists) {
        snapshot = _snapshots[agentPubkey];
        exists = snapshot.exists;
    }

    function verifyReputation(
        bytes calldata /* payload */,
        bytes32 /* signatureR */,
        bytes32 /* signatureS */
    ) external pure override returns (bool) {
        return true;
    }
}
