// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @notice On-chain reputation feed for Gradience Oracle.
 * @dev Multi-chain deployments accept eventual consistency (max 10 min drift).
 *      Each update records lastUpdatedAt and the signing oracle for auditability.
 */
contract GradienceReputationFeed is Ownable {
    struct AggregatedReputation {
        uint16 globalScore;
        uint16[8] categoryScores;
        uint64 lastUpdatedAt;
        bytes32 merkleRoot;
        address oracle;
        bool exists;
    }

    address public oracle;

    mapping(address => AggregatedReputation) public feed;
    mapping(bytes32 => AggregatedReputation) public feedBySolanaPubkey;

    event ReputationUpdated(
        address indexed evmAddress,
        bytes32 solanaPubkey,
        uint16 globalScore,
        uint64 lastUpdatedAt,
        address indexed oracle
    );
    event OracleUpdated(address indexed previousOracle, address indexed newOracle);

    error NotOracle(address caller);
    error ZeroAddress();
    error WrongChainId(uint256 expected, uint256 actual);

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle(msg.sender);
        _;
    }

    constructor(address owner_, address oracle_) Ownable(owner_) {
        if (oracle_ == address(0)) revert ZeroAddress();
        oracle = oracle_;
    }

    function setOracle(address oracle_) external onlyOwner {
        if (oracle_ == address(0)) revert ZeroAddress();
        address previous = oracle;
        oracle = oracle_;
        emit OracleUpdated(previous, oracle_);
    }

    function updateReputation(
        address evmAddress,
        bytes32 solanaPubkey,
        uint16 globalScore,
        uint16[8] calldata categoryScores,
        bytes32 merkleRoot,
        uint256 chainId
    ) external onlyOracle {
        if (chainId != block.chainid) revert WrongChainId(block.chainid, chainId);

        AggregatedReputation memory rep = AggregatedReputation({
            globalScore: globalScore,
            categoryScores: categoryScores,
            lastUpdatedAt: uint64(block.timestamp),
            merkleRoot: merkleRoot,
            oracle: msg.sender,
            exists: true
        });

        feed[evmAddress] = rep;
        if (solanaPubkey != bytes32(0)) {
            feedBySolanaPubkey[solanaPubkey] = rep;
        }

        emit ReputationUpdated(evmAddress, solanaPubkey, globalScore, rep.lastUpdatedAt, msg.sender);
    }

    function getReputation(address evmAddress) external view returns (AggregatedReputation memory) {
        return feed[evmAddress];
    }

    function getReputationBySolana(bytes32 solanaPubkey) external view returns (AggregatedReputation memory) {
        return feedBySolanaPubkey[solanaPubkey];
    }
}
