// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract TestPermitERC20 is ERC20, ERC20Permit {
    constructor() ERC20("Test Permit Token", "TPERM") ERC20Permit("Test Permit Token") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
