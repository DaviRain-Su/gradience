// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentArenaEVM} from "../AgentArenaEVM.sol";

/**
 * @notice Test helper that exposes constructor-based initialization for unit tests.
 * Production deployments should use ERC1967Proxy + AgentArenaEVM.initialize().
 */
contract TestableAgentArenaEVM is AgentArenaEVM {
    constructor(address owner_, address treasury_) {
        _initialize(owner_, treasury_);
    }
}
