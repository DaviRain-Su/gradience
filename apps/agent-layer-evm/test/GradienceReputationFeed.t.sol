// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {GradienceReputationFeed} from "../src/GradienceReputationFeed.sol";

contract GradienceReputationFeedTest is Test {
    GradienceReputationFeed feed;
    address owner = address(1);
    address oracle = address(2);
    address evmAddr = address(3);
    bytes32 solanaPubkey = bytes32(uint256(123));

    function setUp() public {
        feed = new GradienceReputationFeed(owner, oracle);
    }

    function test_updateReputationByOracle() public {
        uint16[8] memory cats = [uint16(10), 20, 30, 40, 50, 60, 70, 80];

        vm.prank(oracle);
        feed.updateReputation(evmAddr, solanaPubkey, 75, cats, bytes32(uint256(0xabc)));

        GradienceReputationFeed.AggregatedReputation memory rep = feed.getReputation(evmAddr);
        assertEq(rep.globalScore, 75);
        assertEq(rep.categoryScores[0], 10);
        assertEq(rep.categoryScores[7], 80);
        assertEq(rep.oracle, oracle);
        assertTrue(rep.exists);

        GradienceReputationFeed.AggregatedReputation memory repBySol = feed.getReputationBySolana(solanaPubkey);
        assertEq(repBySol.globalScore, 75);
    }

    function test_revertWhenNonOracleUpdates() public {
        uint16[8] memory cats;
        vm.expectRevert(abi.encodeWithSelector(GradienceReputationFeed.NotOracle.selector, address(this)));
        feed.updateReputation(evmAddr, bytes32(0), 50, cats, bytes32(0));
    }

    function test_ownerCanChangeOracle() public {
        address newOracle = address(4);
        vm.prank(owner);
        feed.setOracle(newOracle);
        assertEq(feed.oracle(), newOracle);
    }

    function test_revertWhenNonOwnerChangesOracle() public {
        vm.expectRevert();
        feed.setOracle(address(4));
    }
}
