// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {X402Settlement} from "../src/X402Settlement.sol";
import {TestPermitERC20} from "../src/mocks/TestPermitERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract X402SettlementTest is Test {
    X402Settlement public settlement;
    TestPermitERC20 public token;

   address internal payer;
    uint256 internal payerKey;
    address recipient = address(2);
    address other = address(3);

    bytes32 constant CHANNEL_ID = keccak256("channel-1");
    uint256 constant MAX_AMOUNT = 1000e18;
    uint256 constant DEADLINE = type(uint256).max;

    function setUp() public {
        settlement = new X402Settlement();
        token = new TestPermitERC20();
        (payer, payerKey) = makeAddrAndKey("payer");
        token.mint(payer, 10_000e18);
    }

    function test_lockWithPermit() public {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                payer,
                address(settlement),
                MAX_AMOUNT,
                token.nonces(payer),
                DEADLINE
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerKey, digest);

        settlement.lockWithPermit(
            CHANNEL_ID,
            payer,
            recipient,
            address(token),
            MAX_AMOUNT,
            DEADLINE,
            bytes32(uint256(token.nonces(payer))),
            v,
            r,
            s
        );

        (address authPayer, address authRecipient,, uint256 authMaxAmount,,,, bool authExists,,) = settlement.authorizations(CHANNEL_ID);
        assertTrue(authExists);
        assertEq(authPayer, payer);
        assertEq(authRecipient, recipient);
        assertEq(authMaxAmount, MAX_AMOUNT);
        assertEq(token.balanceOf(address(settlement)), MAX_AMOUNT);
    }

    function test_lockWithApproval() public {
        vm.startPrank(payer);
        token.approve(address(settlement), MAX_AMOUNT);
        vm.stopPrank();

        settlement.lockWithApproval(CHANNEL_ID, payer, recipient, address(token), MAX_AMOUNT, bytes32(uint256(1)));

        (,,,,,,, bool authExists,,) = settlement.authorizations(CHANNEL_ID);
        assertTrue(authExists);
        assertEq(token.balanceOf(address(settlement)), MAX_AMOUNT);
    }

    function test_settle_partial() public {
        _lockChannel();

        uint256 actualAmount = 400e18;
        uint256 refund = MAX_AMOUNT - actualAmount;

        uint256 recipientBefore = token.balanceOf(recipient);
        uint256 payerBefore = token.balanceOf(payer);

        vm.prank(recipient);
        settlement.settle(CHANNEL_ID, actualAmount);

        assertEq(token.balanceOf(recipient) - recipientBefore, actualAmount);
        assertEq(token.balanceOf(payer) - payerBefore, refund);

        (,,,,,,,, bool authSettled,) = settlement.authorizations(CHANNEL_ID);
        assertTrue(authSettled);
    }

    function test_settle_revertIfExceedsMax() public {
        _lockChannel();
        vm.prank(recipient);
        vm.expectRevert(abi.encodeWithSelector(X402Settlement.SettlementTooHigh.selector, MAX_AMOUNT + 1, MAX_AMOUNT));
        settlement.settle(CHANNEL_ID, MAX_AMOUNT + 1);
    }

    function test_settle_revertIfNotRecipient() public {
        _lockChannel();
        vm.prank(other);
        vm.expectRevert(abi.encodeWithSelector(X402Settlement.UnauthorizedCaller.selector, other));
        settlement.settle(CHANNEL_ID, 100e18);
    }

    function test_rollback_byRecipient() public {
        _lockChannel();
        uint256 payerBefore = token.balanceOf(payer);

        vm.prank(recipient);
        settlement.rollback(CHANNEL_ID);

        assertEq(token.balanceOf(payer) - payerBefore, MAX_AMOUNT);
        (,,,,,,,,, bool authRolledBack) = settlement.authorizations(CHANNEL_ID);
        assertTrue(authRolledBack);
    }

    function test_rollback_byPayerAfterDeadline() public {
        _lockChannel();
        vm.warp(block.timestamp + 2 hours);

        uint256 payerBefore = token.balanceOf(payer);
        vm.prank(payer);
        settlement.rollback(CHANNEL_ID);

        assertEq(token.balanceOf(payer) - payerBefore, MAX_AMOUNT);
    }

    function test_rollback_revertIfPayerBeforeDeadline() public {
        _lockChannel();
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(X402Settlement.DeadlineNotReached.selector, CHANNEL_ID));
        settlement.rollback(CHANNEL_ID);
    }

    function test_rollback_revertIfAlreadySettled() public {
        _lockChannel();
        vm.prank(recipient);
        settlement.settle(CHANNEL_ID, 100e18);

        vm.prank(recipient);
        vm.expectRevert(abi.encodeWithSelector(X402Settlement.AlreadySettled.selector, CHANNEL_ID));
        settlement.rollback(CHANNEL_ID);
    }

    function _lockChannel() internal {
        vm.startPrank(payer);
        token.approve(address(settlement), MAX_AMOUNT);
        vm.stopPrank();
        settlement.lockWithApproval(CHANNEL_ID, payer, recipient, address(token), MAX_AMOUNT, bytes32(uint256(1)));
    }
}
