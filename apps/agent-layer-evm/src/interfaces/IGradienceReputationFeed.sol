// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGradienceReputationFeed {
    struct AggregatedReputation {
        uint16 globalScore;
        uint16[8] categoryScores;
        uint64 lastUpdatedAt;
        bytes32 merkleRoot;
        address oracle;
        bool exists;
    }

    function getReputation(address evmAddress) external view returns (AggregatedReputation memory);
    function getReputationBySolana(bytes32 solanaPubkey) external view returns (AggregatedReputation memory);
}
