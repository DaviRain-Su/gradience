// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {GradienceReputationOracle} from "../src/GradienceReputationOracle.sol";
import {IGradienceReputationOracle} from "../src/interfaces/IGradienceReputationOracle.sol";

contract GradienceReputationOracleTest is Test {
    GradienceReputationOracle public oracle;

    address public owner;
    address public oracleSigner;
    address public relayer;
    address public stranger;

    uint256 public signerKey;

    bytes32 public constant AGENT_ID = bytes32(uint256(12345));

    function setUp() public {
        owner = address(this);
        relayer = makeAddr("relayer");
        stranger = makeAddr("stranger");

        (oracleSigner, signerKey) = makeAddrAndKey("signer");

        oracle = new GradienceReputationOracle(oracleSigner, relayer, 86400);
    }

    // =========================================================================
    // Deployment
    // =========================================================================
    function test_DeploymentState() public view {
        assertEq(oracle.oracleSigner(), oracleSigner);
        assertEq(oracle.maxAgeSeconds(), 86400);
        assertTrue(oracle.relayers(relayer));
        assertFalse(oracle.relayers(stranger));
        assertEq(oracle.nonces(AGENT_ID), 0);
        assertEq(oracle.CATEGORY_COUNT(), 8);
        assertEq(oracle.SCORE_DECIMALS(), 2);
    }

    function test_DeploymentZeroAddressReverts() public {
        vm.expectRevert(IGradienceReputationOracle.ZeroAddress.selector);
        new GradienceReputationOracle(address(0), relayer, 86400);

        vm.expectRevert(IGradienceReputationOracle.ZeroAddress.selector);
        new GradienceReputationOracle(oracleSigner, address(0), 86400);
    }

    // =========================================================================
    // updateReputation
    // =========================================================================
    function test_UpdateReputationSuccess() public {
        IGradienceReputationOracle.ReputationPayload memory payload = _createPayload(1);
        bytes memory signature = _signPayload(payload);

        vm.prank(relayer);
        vm.expectEmit(true, false, false, true);
        emit IGradienceReputationOracle.ReputationUpdated(
            AGENT_ID, 8750, uint64(block.timestamp), 1, bytes32(0)
        );
        oracle.updateReputation(payload, signature);

        (int128 value, uint8 decimals, uint256 count) = oracle.getReputation(AGENT_ID);
        assertEq(value, 8750);
        assertEq(decimals, 2);
        assertEq(count, 1);

        IGradienceReputationOracle.ReputationPayload memory stored = oracle.getDetailedReputation(AGENT_ID);
        assertEq(stored.agentId, AGENT_ID);
        assertEq(stored.globalScore, 8750);
        assertEq(stored.nonce, 1);
    }

    function test_UpdateReputationInvalidSignature() public {
        IGradienceReputationOracle.ReputationPayload memory payload = _createPayload(1);
        (address wrongSigner, uint256 wrongKey) = makeAddrAndKey("wrongSigner");
        bytes memory signature = _signPayloadWithKey(payload, wrongKey);

        vm.prank(relayer);
        vm.expectRevert(IGradienceReputationOracle.InvalidSignature.selector);
        oracle.updateReputation(payload, signature);
    }

    function test_UpdateReputationInvalidNonce() public {
        IGradienceReputationOracle.ReputationPayload memory payload1 = _createPayload(2);
        bytes memory sig1 = _signPayload(payload1);

        vm.prank(relayer);
        oracle.updateReputation(payload1, sig1);

        IGradienceReputationOracle.ReputationPayload memory payload2 = _createPayload(1);
        bytes memory sig2 = _signPayload(payload2);

        vm.prank(relayer);
        vm.expectRevert(IGradienceReputationOracle.InvalidNonce.selector);
        oracle.updateReputation(payload2, sig2);
    }

    function test_UpdateReputationNotRelayer() public {
        IGradienceReputationOracle.ReputationPayload memory payload = _createPayload(1);
        bytes memory signature = _signPayload(payload);

        vm.prank(stranger);
        vm.expectRevert(IGradienceReputationOracle.NotRelayer.selector);
        oracle.updateReputation(payload, signature);
    }

    // =========================================================================
    // getReputation
    // =========================================================================
    function test_GetReputationNeverUpdated() public view {
        (int128 value, uint8 decimals, uint256 count) = oracle.getReputation(bytes32(uint256(99999)));
        assertEq(value, 0);
        assertEq(decimals, 2);
        assertEq(count, 0);
    }

    // =========================================================================
    // getDetailedReputation / getLatestAttestation
    // =========================================================================
    function test_GetDetailedReputationNotFound() public {
        vm.expectRevert(IGradienceReputationOracle.AgentNotFound.selector);
        oracle.getDetailedReputation(bytes32(uint256(99999)));
    }

    function test_GetLatestAttestationNotFound() public {
        vm.expectRevert(IGradienceReputationOracle.AgentNotFound.selector);
        oracle.getLatestAttestation(bytes32(uint256(99999)));
    }

    function test_GetLatestAttestationSuccess() public {
        IGradienceReputationOracle.ReputationPayload memory payload = _createPayload(1);
        bytes memory signature = _signPayload(payload);

        vm.prank(relayer);
        oracle.updateReputation(payload, signature);

        IGradienceReputationOracle.AttestationMetadata memory meta = oracle.getLatestAttestation(AGENT_ID);
        assertEq(meta.agentId, AGENT_ID);
        assertEq(meta.signer, oracleSigner);
        assertEq(meta.updatedAt, payload.updatedAt);
    }

    // =========================================================================
    // verifySignature
    // =========================================================================
    function test_VerifySignatureValid() public view {
        IGradienceReputationOracle.ReputationPayload memory payload = _createPayload(1);
        bytes memory signature = _signPayload(payload);
        assertTrue(oracle.verifySignature(payload, signature));
    }

    function test_VerifySignatureTamperedPayload() public view {
        IGradienceReputationOracle.ReputationPayload memory payload = _createPayload(1);
        bytes memory signature = _signPayload(payload);

        payload.globalScore = 9999;
        assertFalse(oracle.verifySignature(payload, signature));
    }

    // =========================================================================
    // isFresh
    // =========================================================================
    function test_IsFresh() public {
        IGradienceReputationOracle.ReputationPayload memory payload = _createPayload(1);
        payload.updatedAt = uint64(block.timestamp);
        bytes memory signature = _signPayload(payload);

        vm.prank(relayer);
        oracle.updateReputation(payload, signature);

        assertTrue(oracle.isFresh(AGENT_ID, 86400));

        vm.warp(block.timestamp + 2 days);
        assertFalse(oracle.isFresh(AGENT_ID, 86400));
    }

    // =========================================================================
    // Admin
    // =========================================================================
    function test_SetOracleSigner() public {
        address newSigner = makeAddr("newSigner");
        oracle.setOracleSigner(newSigner);
        assertEq(oracle.oracleSigner(), newSigner);
    }

    function test_AddAndRemoveRelayer() public {
        address newRelayer = makeAddr("newRelayer");
        oracle.addRelayer(newRelayer);
        assertTrue(oracle.relayers(newRelayer));

        oracle.removeRelayer(newRelayer);
        assertFalse(oracle.relayers(newRelayer));
    }

    function test_SetMaxAgeSeconds() public {
        oracle.setMaxAgeSeconds(172800);
        assertEq(oracle.maxAgeSeconds(), 172800);
    }

    // =========================================================================
    // Helpers
    // =========================================================================
    function _createPayload(uint64 nonce)
        internal
        view
        returns (IGradienceReputationOracle.ReputationPayload memory)
    {
        uint16[8] memory categories;
        categories[0] = 9200;
        categories[1] = 8500;
        categories[4] = 8800;
        categories[7] = 7600;

        return IGradienceReputationOracle.ReputationPayload({
            agentId: AGENT_ID,
            globalScore: 8750,
            categoryScores: categories,
            updatedAt: uint64(block.timestamp),
            confidence: 94,
            nonce: nonce,
            merkleRoot: bytes32(0),
            sourceChain: "solana"
        });
    }

    function _signPayload(IGradienceReputationOracle.ReputationPayload memory payload)
        internal
        view
        returns (bytes memory)
    {
        return _signPayloadWithKey(payload, signerKey);
    }

    function _signPayloadWithKey(IGradienceReputationOracle.ReputationPayload memory payload, uint256 key)
        internal
        pure
        returns (bytes memory)
    {
        bytes32 hash = keccak256(
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

        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, ethHash);
        return abi.encodePacked(r, s, v);
    }
}
