// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {DeterministicDeployer} from "../src/utils/DeterministicDeployer.sol";

contract DummyImpl {
    uint256 public value;
    constructor(uint256 v) {
        value = v;
    }
}

contract DeterministicDeployerTest is Test {
    DeterministicDeployer deployer;

    function setUp() public {
        deployer = new DeterministicDeployer();
    }

    function test_deployAndConfirmAddress() public {
        bytes32 salt = keccak256("GRADIENCE_V1_DummyImpl");
        bytes memory creationCode = abi.encodePacked(type(DummyImpl).creationCode, abi.encode(42));
        bytes32 bytecodeHash = keccak256(creationCode);

        address predicted = deployer.computeAddress(salt, bytecodeHash);
        address actual = deployer.deploy(salt, creationCode);

        assertEq(predicted, actual);
        assertGt(actual.code.length, 0);
        assertEq(DummyImpl(actual).value(), 42);
    }

    function test_computeAddressMatchesManualFormula() public {
        bytes32 salt = keccak256("GRADIENCE_V1_DummyImpl2");
        bytes memory creationCode = abi.encodePacked(type(DummyImpl).creationCode, abi.encode(99));
        bytes32 bytecodeHash = keccak256(creationCode);

        address fromContract = deployer.computeAddress(salt, bytecodeHash);

        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(deployer), salt, bytecodeHash));
        address manual = address(uint160(uint256(hash)));

        assertEq(fromContract, manual);
    }

    function test_revertOnDuplicateDeploy() public {
        bytes32 salt = keccak256("GRADIENCE_V1_Dup");
        bytes memory creationCode = abi.encodePacked(type(DummyImpl).creationCode, abi.encode(1));

        deployer.deploy(salt, creationCode);
        vm.expectRevert();
        deployer.deploy(salt, creationCode);
    }

    function test_revertEmptyBytecode() public {
        vm.expectRevert(DeterministicDeployer.EmptyBytecode.selector);
        deployer.deploy(bytes32(0), "");
    }
}
