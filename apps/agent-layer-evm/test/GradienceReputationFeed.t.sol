// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {GradienceReputationFeed} from "../src/GradienceReputationFeed.sol";

contract GradienceReputationFeedTest is Test {
    GradienceReputationFeed feed;
    address owner = address(1);
    address oracleAddr;
    uint256 oracleKey;
    address evmAddr = address(3);
    bytes32 solanaPubkey = bytes32(uint256(123));

    function setUp() public {
        (oracleAddr, oracleKey) = makeAddrAndKey("oracle");
        GradienceReputationFeed impl = new GradienceReputationFeed();
        bytes memory initData = abi.encodeWithSelector(GradienceReputationFeed.initialize.selector, owner, oracleAddr);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        feed = GradienceReputationFeed(address(proxy));
    }

    function _signUpdate(
        address evmAddress,
        bytes32 solanaPubkey_,
        uint16 globalScore,
        uint16[8] memory categoryScores,
        bytes32 merkleRoot,
        uint64 timestamp,
        uint256 chainId
    ) internal pure returns (bytes32 digest, bytes memory signature) {
        digest = keccak256(
            abi.encode(
                evmAddress,
                solanaPubkey_,
                globalScore,
                categoryScores,
                merkleRoot,
                timestamp,
                chainId
            )
        );
        // Tests use raw digest; oracle service must use the same encoding.
    }

    function test_updateReputationWithValidSignature() public {
        uint16[8] memory cats = [uint16(10), 20, 30, 40, 50, 60, 70, 80];
        uint64 timestamp = uint64(block.timestamp);
        bytes32 merkleRoot = bytes32(uint256(0xabc));

        (bytes32 digest,) = _signUpdate(evmAddr, solanaPubkey, 75, cats, merkleRoot, timestamp, block.chainid);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oracleKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        feed.updateReputation(evmAddr, solanaPubkey, 75, cats, merkleRoot, timestamp, block.chainid, signature);

        GradienceReputationFeed.AggregatedReputation memory rep = feed.getReputation(evmAddr);
        assertEq(rep.globalScore, 75);
        assertEq(rep.categoryScores[0], 10);
        assertEq(rep.categoryScores[7], 80);
        assertEq(rep.oracle, oracleAddr);
        assertEq(rep.lastUpdatedAt, timestamp);
        assertTrue(rep.exists);

        GradienceReputationFeed.AggregatedReputation memory repBySol = feed.getReputationBySolana(solanaPubkey);
        assertEq(repBySol.globalScore, 75);
    }

    function test_revertWithInvalidSignature() public {
        uint16[8] memory cats;
        uint64 timestamp = uint64(block.timestamp);
        bytes32 digest = keccak256("wrong message");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oracleKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert(GradienceReputationFeed.InvalidSignature.selector);
        feed.updateReputation(evmAddr, bytes32(0), 50, cats, bytes32(0), timestamp, block.chainid, signature);
    }

    function test_revertWrongChainId() public {
        uint16[8] memory cats;
        uint64 timestamp = uint64(block.timestamp);
        (bytes32 digest,) = _signUpdate(evmAddr, bytes32(0), 50, cats, bytes32(0), timestamp, 999);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oracleKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert(abi.encodeWithSelector(GradienceReputationFeed.WrongChainId.selector, block.chainid, 999));
        feed.updateReputation(evmAddr, bytes32(0), 50, cats, bytes32(0), timestamp, 999, signature);
    }

    function test_revertStaleTimestamp() public {
        uint16[8] memory cats = [uint16(10), 20, 30, 40, 50, 60, 70, 80];
        uint64 timestamp = uint64(block.timestamp);
        bytes32 merkleRoot = bytes32(uint256(0xabc));

        // First valid update
        (bytes32 digest1,) = _signUpdate(evmAddr, solanaPubkey, 75, cats, merkleRoot, timestamp, block.chainid);
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(oracleKey, digest1);
        feed.updateReputation(evmAddr, solanaPubkey, 75, cats, merkleRoot, timestamp, block.chainid, abi.encodePacked(r1, s1, v1));

        // Second update with same timestamp must revert
        (bytes32 digest2,) = _signUpdate(evmAddr, solanaPubkey, 80, cats, merkleRoot, timestamp, block.chainid);
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(oracleKey, digest2);
        vm.expectRevert(abi.encodeWithSelector(GradienceReputationFeed.StaleTimestamp.selector, timestamp, timestamp));
        feed.updateReputation(evmAddr, solanaPubkey, 80, cats, merkleRoot, timestamp, block.chainid, abi.encodePacked(r2, s2, v2));
    }

    function test_updateReputationByRelayer() public {
        // Anyone can relay as long as signature is valid
        uint16[8] memory cats = [uint16(5), 5, 5, 5, 5, 5, 5, 5];
        uint64 timestamp = uint64(block.timestamp);
        bytes32 merkleRoot = bytes32(0);

        (bytes32 digest,) = _signUpdate(evmAddr, solanaPubkey, 60, cats, merkleRoot, timestamp, block.chainid);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oracleKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        address relayer = address(0xdead);
        vm.prank(relayer);
        feed.updateReputation(evmAddr, solanaPubkey, 60, cats, merkleRoot, timestamp, block.chainid, signature);

        GradienceReputationFeed.AggregatedReputation memory rep = feed.getReputation(evmAddr);
        assertEq(rep.globalScore, 60);
        assertEq(rep.oracle, oracleAddr);
    }

    function test_ownerCanChangeOracle() public {
        (address newOracleAddr,) = makeAddrAndKey("newOracle");
        vm.prank(owner);
        feed.setOracle(newOracleAddr);
        assertEq(feed.oracle(), newOracleAddr);
    }

    function test_revertWhenNonOwnerChangesOracle() public {
        vm.expectRevert();
        feed.setOracle(address(4));
    }
}
