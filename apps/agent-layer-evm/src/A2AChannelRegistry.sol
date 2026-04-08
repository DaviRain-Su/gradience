// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @notice A2A Channel Registry for Gradience Agent-to-Agent communication.
 * @dev Stores lightweight channel metadata on-chain while message payloads
 * remain off-chain (IPFS / Arweave / private relay). Only message hashes
 * are anchored on-chain for integrity and ordering guarantees.
 */
contract A2AChannelRegistry {
    struct Channel {
        address[] participants;
        bytes32 lastMessageHash;
        uint64 lastAnchorAt;
        bool exists;
    }

    mapping(bytes32 => Channel) public channels;

    error ChannelAlreadyExists(bytes32 channelId);
    error ChannelNotFound(bytes32 channelId);
    error NotParticipant(bytes32 channelId, address caller);
    error InvalidParticipants();
    error InvalidMessageHash();

    event ChannelCreated(bytes32 indexed channelId, address[] participants);
    event MessageAnchored(
        bytes32 indexed channelId,
        bytes32 messageHash,
        bytes32 previousHash,
        address sender
    );

    /**
     * @notice Create a new A2A channel between participants.
     * @param channelId Unique channel identifier (derived off-chain from participants + nonce).
     * @param participants Ordered list of participant addresses.
     */
    function createChannel(bytes32 channelId, address[] calldata participants) external {
        if (participants.length < 2) revert InvalidParticipants();
        if (channels[channelId].exists) revert ChannelAlreadyExists(channelId);

        // Validate uniqueness and non-zero addresses
        for (uint256 i = 0; i < participants.length; i++) {
            if (participants[i] == address(0)) revert InvalidParticipants();
            for (uint256 j = i + 1; j < participants.length; j++) {
                if (participants[i] == participants[j]) revert InvalidParticipants();
            }
        }

        channels[channelId] = Channel({
            participants: participants,
            lastMessageHash: bytes32(0),
            lastAnchorAt: 0,
            exists: true
        });

        emit ChannelCreated(channelId, participants);
    }

    /**
     * @notice Anchor a message hash to an existing channel.
     * @param channelId The channel to anchor the message to.
     * @param messageHash sha256 hash of the encrypted message envelope.
     * @param previousHash sha256 hash of the previous message envelope in the chain.
     */
    function anchorMessage(bytes32 channelId, bytes32 messageHash, bytes32 previousHash) external {
        if (messageHash == bytes32(0)) revert InvalidMessageHash();

        Channel storage ch = channels[channelId];
        if (!ch.exists) revert ChannelNotFound(channelId);
        if (!_isParticipant(ch, msg.sender)) revert NotParticipant(channelId, msg.sender);

        ch.lastMessageHash = messageHash;
        ch.lastAnchorAt = uint64(block.timestamp);

        emit MessageAnchored(channelId, messageHash, previousHash, msg.sender);
    }

    /**
     * @notice Retrieve channel metadata.
     */
    function getChannel(bytes32 channelId) external view returns (Channel memory) {
        return channels[channelId];
    }

    /**
     * @notice Verify whether a caller is a channel participant.
     */
    function isParticipant(bytes32 channelId, address addr) external view returns (bool) {
        Channel storage ch = channels[channelId];
        return ch.exists && _isParticipant(ch, addr);
    }

    function _isParticipant(Channel storage ch, address addr) internal view returns (bool) {
        for (uint256 i = 0; i < ch.participants.length; i++) {
            if (ch.participants[i] == addr) return true;
        }
        return false;
    }
}
