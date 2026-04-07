// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IJudgeRegistry {
    struct JudgePoolConfig {
        uint8 poolSize;
        uint8 quorum;
        uint8 category;
    }

    function register(uint8 category) external;
    function unregister(uint8 category) external;
    function isEligibleForCategory(address judge, uint8 category) external view returns (bool);
    function selectJudge(uint8 category, uint256 randomness) external view returns (address judge);
    function selectJudgePool(
        uint8 category,
        uint256 randomness,
        JudgePoolConfig calldata config
    ) external view returns (address[] memory judges);
    function slash(address judge, uint256 amount, string calldata reason) external;
    function totalSlashed(address judge) external view returns (uint256);
}
