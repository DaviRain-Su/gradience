// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC2612} from "@openzeppelin/contracts/interfaces/IERC2612.sol";

/**
 * @title X402Settlement
 * @notice Lightweight escrow for EVM X402 micropayments.
 * @dev Supports ERC-2612 permit() for gasless authorization and standard approve()/transferFrom() fallback.
 */
contract X402Settlement is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Authorization {
        address payer;
        address recipient;
        address token;
        uint256 maxAmount;
        uint256 lockedAmount;
        uint256 deadline;
        bytes32 nonce;
        bool exists;
        bool settled;
        bool rolledBack;
    }

    mapping(bytes32 => Authorization) public authorizations;
    mapping(address => mapping(bytes32 => bool)) public usedNonces;

    error InvalidChannelId();
    error ChannelAlreadyExists(bytes32 channelId);
    error UnauthorizedCaller(address caller);
    error ChannelNotFound(bytes32 channelId);
    error AlreadySettled(bytes32 channelId);
    error AlreadyRolledBack(bytes32 channelId);
    error SettlementTooHigh(uint256 requested, uint256 max);
    error DeadlineNotReached(bytes32 channelId);
    error PermitFailed();
    error InvalidToken();

    event Locked(
        bytes32 indexed channelId,
        address indexed payer,
        address indexed recipient,
        address token,
        uint256 maxAmount
    );
    event Settled(
        bytes32 indexed channelId,
        uint256 actualAmount,
        uint256 refunded
    );
    event RolledBack(bytes32 indexed channelId);

    /**
     * @notice Lock funds using ERC-2612 permit signature.
     */
    function lockWithPermit(
        bytes32 channelId,
        address payer,
        address recipient,
        address token,
        uint256 maxAmount,
        uint256 deadline,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (channelId == bytes32(0)) revert InvalidChannelId();
        if (authorizations[channelId].exists) revert ChannelAlreadyExists(channelId);
        if (token.code.length == 0) revert InvalidToken();
        if (usedNonces[payer][nonce]) revert PermitFailed();

        // Execute permit on the ERC-20 token
        try IERC2612(token).permit(payer, address(this), maxAmount, deadline, v, r, s) {
            // success
        } catch {
            revert PermitFailed();
        }

        // Transfer funds from payer to this contract
        SafeERC20.safeTransferFrom(IERC20(token), payer, address(this), maxAmount);
        usedNonces[payer][nonce] = true;

        authorizations[channelId] = Authorization({
            payer: payer,
            recipient: recipient,
            token: token,
            maxAmount: maxAmount,
            lockedAmount: maxAmount,
            deadline: deadline,
            nonce: nonce,
            exists: true,
            settled: false,
            rolledBack: false
        });

        emit Locked(channelId, payer, recipient, token, maxAmount);
    }

    /**
     * @notice Lock funds using standard approve()/transferFrom().
     */
    function lockWithApproval(
        bytes32 channelId,
        address payer,
        address recipient,
        address token,
        uint256 maxAmount,
        bytes32 nonce
    ) external {
        if (channelId == bytes32(0)) revert InvalidChannelId();
        if (authorizations[channelId].exists) revert ChannelAlreadyExists(channelId);
        if (token.code.length == 0) revert InvalidToken();

        SafeERC20.safeTransferFrom(IERC20(token), payer, address(this), maxAmount);

        authorizations[channelId] = Authorization({
            payer: payer,
            recipient: recipient,
            token: token,
            maxAmount: maxAmount,
            lockedAmount: maxAmount,
            deadline: block.timestamp + 1 hours, // default deadline
            nonce: nonce,
            exists: true,
            settled: false,
            rolledBack: false
        });

        emit Locked(channelId, payer, recipient, token, maxAmount);
    }

    /**
     * @notice Settle the channel by transferring actualAmount to recipient and refunding the rest.
     */
    function settle(bytes32 channelId, uint256 actualAmount) external nonReentrant {
        Authorization storage auth = authorizations[channelId];
        if (!auth.exists) revert ChannelNotFound(channelId);
        if (msg.sender != auth.recipient) revert UnauthorizedCaller(msg.sender);
        if (auth.settled) revert AlreadySettled(channelId);
        if (auth.rolledBack) revert AlreadyRolledBack(channelId);
        if (actualAmount > auth.maxAmount) revert SettlementTooHigh(actualAmount, auth.maxAmount);

        auth.settled = true;
        uint256 refund = auth.maxAmount - actualAmount;

        if (actualAmount > 0) {
            SafeERC20.safeTransfer(IERC20(auth.token), auth.recipient, actualAmount);
        }
        if (refund > 0) {
            SafeERC20.safeTransfer(IERC20(auth.token), auth.payer, refund);
        }

        emit Settled(channelId, actualAmount, refund);
    }

    /**
     * @notice Rollback the channel, refunding all locked funds to the payer.
     */
    function rollback(bytes32 channelId) external nonReentrant {
        Authorization storage auth = authorizations[channelId];
        if (!auth.exists) revert ChannelNotFound(channelId);
        if (auth.settled) revert AlreadySettled(channelId);
        if (auth.rolledBack) revert AlreadyRolledBack(channelId);

        if (msg.sender != auth.recipient) {
            if (msg.sender != auth.payer || block.timestamp <= auth.deadline) {
                revert DeadlineNotReached(channelId);
            }
        }

        auth.rolledBack = true;
        SafeERC20.safeTransfer(IERC20(auth.token), auth.payer, auth.lockedAmount);

        emit RolledBack(channelId);
    }
}
