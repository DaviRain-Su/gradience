// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {AgentLayerRaceTask} from "../src/AgentLayerRaceTask.sol";

/**
 * @notice Foundry fuzz tests for fee distribution invariants.
 */
contract AgentLayerRaceTaskFuzzTest is Test {
    AgentLayerRaceTask arena;
    address treasury = address(4);

    function setUp() public {
        AgentLayerRaceTask impl = new AgentLayerRaceTask();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeWithSelector(AgentLayerRaceTask.initialize.selector, address(this), treasury)
        );
        arena = AgentLayerRaceTask(address(proxy));
    }

    function testFuzz_ProtocolFeeNeverExceedsMax(uint96 reward, uint8 score) public {
        vm.assume(reward > 0.001 ether);
        vm.assume(score >= 60 && score <= 100);

        uint256 expectedFee = (uint256(reward) * arena.PROTOCOL_FEE_BPS()) / arena.BPS_DENOMINATOR();
        uint256 expectedJudgeFee = (uint256(reward) * arena.JUDGE_FEE_BPS()) / arena.BPS_DENOMINATOR();
        uint256 winnerPayout = uint256(reward) - expectedFee - expectedJudgeFee;

        assertLe(expectedFee, uint256(reward) / 50); // 2%
        assertLe(expectedJudgeFee, uint256(reward) / 33); // 3%
        assertEq(winnerPayout + expectedFee + expectedJudgeFee, uint256(reward));
    }

    function testFuzz_CancelPenaltySplitFairly(uint96 reward, uint8 applicantCount) public {
        vm.assume(reward >= 0.01 ether);
        uint256 count = bound(applicantCount, 1, 50);

        uint256 penalty = (uint256(reward) * 500) / arena.BPS_DENOMINATOR();
        uint256 perApplicant = penalty / count;
        uint256 totalDistributed = perApplicant * count;

        assertLe(totalDistributed, penalty);
        assertEq(penalty - totalDistributed, penalty % count);
    }
}
