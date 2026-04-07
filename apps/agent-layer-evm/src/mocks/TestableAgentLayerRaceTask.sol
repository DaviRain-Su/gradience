// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentLayerRaceTask} from "../AgentLayerRaceTask.sol";

/**
 * @notice Test helper that exposes constructor-based initialization for unit tests.
 * Production deployments should use ERC1967Proxy + AgentLayerRaceTask.initialize().
 */
contract TestableAgentLayerRaceTask is AgentLayerRaceTask {
    constructor(address owner_, address treasury_) {
        _initialize(owner_, treasury_);
    }
}
