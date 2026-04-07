// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @notice Social graph for Gradience users and agents.
 * @dev Follow/unfollow relationships with bidirectional indexing for Subgraph.
 */
contract SocialGraph is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // target => follower => isFollowing
    mapping(address => mapping(address => bool)) public following;
    // follower => list of followed addresses
    mapping(address => address[]) public followings;
    // target => list of followers
    mapping(address => address[]) public followers;

    event Followed(address indexed follower, address indexed target);
    event Unfollowed(address indexed follower, address indexed target);

    error SelfFollow();
    error AlreadyFollowing(address follower, address target);
    error NotFollowing(address follower, address target);

    function initialize(address owner_) external initializer {
        __Ownable_init(owner_);
    }

    function follow(address target) external {
        if (target == msg.sender) revert SelfFollow();
        if (following[target][msg.sender]) revert AlreadyFollowing(msg.sender, target);

        following[target][msg.sender] = true;
        followings[msg.sender].push(target);
        followers[target].push(msg.sender);

        emit Followed(msg.sender, target);
    }

    function unfollow(address target) external {
        if (!following[target][msg.sender]) revert NotFollowing(msg.sender, target);

        following[target][msg.sender] = false;
        _removeFromArray(followings[msg.sender], target);
        _removeFromArray(followers[target], msg.sender);

        emit Unfollowed(msg.sender, target);
    }

    function isFollowing(address from, address to) external view returns (bool) {
        return following[to][from];
    }

    function getFollowings(address user) external view returns (address[] memory) {
        return followings[user];
    }

    function getFollowers(address user) external view returns (address[] memory) {
        return followers[user];
    }

    function _removeFromArray(address[] storage arr, address value) internal {
        uint256 length = arr.length;
        for (uint256 i = 0; i < length; i++) {
            if (arr[i] == value) {
                arr[i] = arr[length - 1];
                arr.pop();
                break;
            }
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
