// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract JudgeRegistry is Ownable {
    struct JudgePoolConfig {
        uint8 poolSize;
        uint8 quorum;
        uint8 category;
    }

    error InvalidCategory(uint8 category);
    error InvalidPoolConfig();
    error AlreadyRegistered(address judge, uint8 category);
    error NotRegistered(address judge, uint8 category);
    error InsufficientPool(uint8 requested, uint8 available);
    error ZeroAmount();

    event JudgeRegistered(address indexed judge, uint8 indexed category);
    event JudgeUnregistered(address indexed judge, uint8 indexed category);
    event JudgeSlashed(address indexed judge, uint256 amount, string reason);
    event ArenaSet(address indexed arena);

    /// @notice Maps judge => category => registered
    mapping(address => mapping(uint8 => bool)) public registrations;

    address public arena;

    /// @notice Per-category list of registered judges
    mapping(uint8 => address[]) private _judgesByCategory;

    /// @notice Position of a judge in _judgesByCategory to enable O(1) removal
    mapping(uint8 => mapping(address => uint256)) private _indexInCategory;

    /// @notice Track total slashed per judge for analytics
    mapping(address => uint256) public totalSlashed;

    constructor(address initialOwner) Ownable(initialOwner) {}

    function register(uint8 category) external {
        if (category > 7) revert InvalidCategory(category);
        if (registrations[msg.sender][category]) revert AlreadyRegistered(msg.sender, category);

        registrations[msg.sender][category] = true;
        _judgesByCategory[category].push(msg.sender);
        _indexInCategory[category][msg.sender] = _judgesByCategory[category].length;

        emit JudgeRegistered(msg.sender, category);
    }

    function unregister(uint8 category) external {
        if (category > 7) revert InvalidCategory(category);
        if (!registrations[msg.sender][category]) revert NotRegistered(msg.sender, category);

        _removeFromCategory(category, msg.sender);
        registrations[msg.sender][category] = false;

        emit JudgeUnregistered(msg.sender, category);
    }

    function setArena(address arena_) external onlyOwner {
        arena = arena_;
        emit ArenaSet(arena_);
    }

    function slash(address judge, uint256 amount, string calldata reason) external {
        if (msg.sender != owner() && msg.sender != arena) revert OwnableUnauthorizedAccount(msg.sender);
        if (amount == 0) revert ZeroAmount();
        totalSlashed[judge] += amount;
        emit JudgeSlashed(judge, amount, reason);
    }

    function isEligibleForCategory(address judge, uint8 category) external view returns (bool) {
        return registrations[judge][category];
    }

    function selectJudgePool(
        uint8 category,
        uint256 randomness,
        JudgePoolConfig calldata config
    ) external view returns (address[] memory judges) {
        if (category > 7) revert InvalidCategory(category);
        if (config.poolSize == 0 || config.quorum == 0 || config.quorum > config.poolSize)
            revert InvalidPoolConfig();

        address[] storage pool = _judgesByCategory[category];
        uint256 available = pool.length;
        if (available < config.poolSize) revert InsufficientPool(config.poolSize, uint8(available));

        address[] memory workingPool = new address[](available);
        for (uint256 i = 0; i < available; i++) {
            workingPool[i] = pool[i];
        }

        judges = new address[](config.poolSize);
        uint256 seed = randomness;

        for (uint8 i = 0; i < config.poolSize; i++) {
            seed = uint256(keccak256(abi.encodePacked(seed, i)));
            uint256 index = seed % available;
            judges[i] = workingPool[index];
            // Without replacement: swap selected to end and shrink available
            workingPool[index] = workingPool[available - 1];
            available--;
        }
    }

    function selectJudge(uint8 category, uint256 randomness) external view returns (address judge) {
        if (category > 7) revert InvalidCategory(category);
        address[] storage pool = _judgesByCategory[category];
        if (pool.length == 0) revert InsufficientPool(1, 0);
        uint256 index = uint256(keccak256(abi.encodePacked(randomness, block.number))) % pool.length;
        return pool[index];
    }

    function getJudgesByCategory(uint8 category) external view returns (address[] memory) {
        return _judgesByCategory[category];
    }

    function _removeFromCategory(uint8 category, address judge) internal {
        uint256 idx = _indexInCategory[category][judge];
        uint256 lastIdx = _judgesByCategory[category].length;
        if (idx != lastIdx) {
            address lastJudge = _judgesByCategory[category][lastIdx - 1];
            _judgesByCategory[category][idx - 1] = lastJudge;
            _indexInCategory[category][lastJudge] = idx;
        }
        _judgesByCategory[category].pop();
        delete _indexInCategory[category][judge];
    }
}
