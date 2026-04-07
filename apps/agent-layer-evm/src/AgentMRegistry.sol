// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @notice Registry for Gradience users and agents.
 * @dev Metadata is stored off-chain (IPFS/Arweave); chain holds URI + version for cache-busting.
 */
contract AgentMRegistry is Ownable {
    struct UserProfile {
        bool exists;
        string username;
        string ensName;         // optional fallback display name (e.g. vitalik.eth)
        string metadataURI;
        uint64 createdAt;
        uint64 updatedAt;
        uint64 version;
    }

    struct AgentProfile {
        bool exists;
        address owner;
        string metadataURI;
        uint64 createdAt;
        bool isActive;
    }

    mapping(address => UserProfile) public users;
    mapping(string => address) public usernameToAddress;
    mapping(uint256 => AgentProfile) public agents;
    mapping(address => uint256[]) public userAgents;
    uint256 public agentCount;

    uint256 public constant MAX_REF_LEN = 256;

    event UserRegistered(address indexed user, string username, string metadataURI, uint64 version);
    event ProfileUpdated(address indexed user, string metadataURI, uint64 version, string ensName);
    event AgentCreated(address indexed owner, uint256 indexed agentId, string metadataURI);
    event AgentUpdated(uint256 indexed agentId, string metadataURI, bool isActive);

    error UsernameTaken(string username);
    error InvalidUsername();
    error EmptyMetadata();
    error MetadataTooLong();
    error UserNotRegistered(address user);

    constructor(address owner_) Ownable(owner_) {}

    function registerUser(string calldata username, string calldata metadataURI, string calldata ensName) external {
        if (users[msg.sender].exists) revert UserNotRegistered(msg.sender); // already registered guard
        _validateUsername(username);
        _validateMetadata(metadataURI);
        if (bytes(ensName).length > MAX_REF_LEN) revert MetadataTooLong();
        if (usernameToAddress[username] != address(0)) revert UsernameTaken(username);

        users[msg.sender] = UserProfile({
            exists: true,
            username: username,
            ensName: ensName,
            metadataURI: metadataURI,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp),
            version: 1
        });
        usernameToAddress[username] = msg.sender;
        emit UserRegistered(msg.sender, username, metadataURI, 1);
    }

    function updateProfile(string calldata metadataURI, string calldata ensName) external {
        if (!users[msg.sender].exists) revert UserNotRegistered(msg.sender);
        _validateMetadata(metadataURI);
        if (bytes(ensName).length > MAX_REF_LEN) revert MetadataTooLong();

        UserProfile storage u = users[msg.sender];
        u.metadataURI = metadataURI;
        u.ensName = ensName;
        u.updatedAt = uint64(block.timestamp);
        u.version += 1;
        emit ProfileUpdated(msg.sender, metadataURI, u.version, ensName);
    }

    function createAgent(string calldata metadataURI) external returns (uint256 agentId) {
        if (!users[msg.sender].exists) revert UserNotRegistered(msg.sender);
        _validateMetadata(metadataURI);

        agentId = ++agentCount;
        agents[agentId] = AgentProfile({
            exists: true,
            owner: msg.sender,
            metadataURI: metadataURI,
            createdAt: uint64(block.timestamp),
            isActive: true
        });
        userAgents[msg.sender].push(agentId);
        emit AgentCreated(msg.sender, agentId, metadataURI);
    }

    function updateAgent(uint256 agentId, string calldata metadataURI, bool isActive) external {
        AgentProfile storage a = agents[agentId];
        if (!a.exists || a.owner != msg.sender) revert UserNotRegistered(msg.sender);
        _validateMetadata(metadataURI);
        a.metadataURI = metadataURI;
        a.isActive = isActive;
        emit AgentUpdated(agentId, metadataURI, isActive);
    }

    function _validateUsername(string calldata username) internal pure {
        bytes memory b = bytes(username);
        if (b.length < 3 || b.length > 32) revert InvalidUsername();
    }

    function _validateMetadata(string calldata metadataURI) internal pure {
        if (bytes(metadataURI).length == 0) revert EmptyMetadata();
        if (bytes(metadataURI).length > MAX_REF_LEN) revert MetadataTooLong();
    }
}
