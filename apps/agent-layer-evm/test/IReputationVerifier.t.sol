// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {IReputationVerifier} from "../src/interfaces/IReputationVerifier.sol";
import {MockReputationVerifier} from "../src/mocks/MockReputationVerifier.sol";

contract IReputationVerifierTest is Test {
    MockReputationVerifier verifier;
    bytes32 agentPubkey = bytes32(uint256(42));

    function setUp() public {
        verifier = new MockReputationVerifier();
    }

    function test_getSnapshot() public {
        IReputationVerifier.Snapshot memory snap = IReputationVerifier.Snapshot({
            globalScore: 80,
            categoryScores: [uint16(10), 20, 30, 40, 50, 60, 70, 80],
            sourceChain: bytes32(uint256(1)),
            timestamp: uint64(block.timestamp),
            signerPubkey: bytes32(uint256(99)),
            exists: true
        });
        verifier.setSnapshot(agentPubkey, snap);

        (IReputationVerifier.Snapshot memory got, bool exists) = verifier.getSnapshot(agentPubkey);
        assertTrue(exists);
        assertEq(got.globalScore, 80);
        assertEq(got.categoryScores[7], 80);
        assertEq(got.timestamp, snap.timestamp);
    }

    function test_verifyReputationAlwaysTrue() public view {
        assertTrue(verifier.verifyReputation("", bytes32(0), bytes32(0)));
    }
}
