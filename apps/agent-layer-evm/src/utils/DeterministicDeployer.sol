// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @notice Deterministic CREATE2 deployer for cross-chain identical addresses.
 * @dev Salt should be derived consistently, e.g. keccak256("GRADIENCE_V1_<NAME>").
 */
contract DeterministicDeployer {
    event Deployed(address indexed deployed, bytes32 salt, bytes32 bytecodeHash);

    function deploy(bytes32 salt, bytes calldata creationCode) external payable returns (address deployed) {
        if (creationCode.length == 0) revert EmptyBytecode();

        // Copy calldata to memory because create2 reads from memory, not calldata.
        bytes memory initCode = creationCode;
        bytes32 initCodeHash = keccak256(initCode);

        assembly {
            deployed := create2(callvalue(), add(initCode, 0x20), mload(initCode), salt)
        }

        if (deployed == address(0)) revert DeploymentFailed(salt);

        emit Deployed(deployed, salt, initCodeHash);
    }

    function computeAddress(bytes32 salt, bytes32 bytecodeHash) external view returns (address) {
        return _computeAddress(salt, bytecodeHash);
    }

    function _computeAddress(bytes32 salt, bytes32 bytecodeHash) internal view returns (address addr) {
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash));
        addr = address(uint160(uint256(hash)));
    }

    error EmptyBytecode();
    error DeploymentFailed(bytes32 salt);
}
