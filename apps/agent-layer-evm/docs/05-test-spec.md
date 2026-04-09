# Phase 5: Test Spec — EVM Core Protocol Deployment (Multi-Chain, XLayer First)

> **目标链**: 任意 EVM Testnet（首发 XLayer Testnet, Chain ID 195）/ Anvil (local) / EVM testnet fork  
> **参考文档**: `03-technical-spec.md`, `04-task-breakdown.md`  
> **测试框架**: Foundry (`forge` + `cast`) + `forge-std`  
> **额外工具**: Slither (静态分析), Echidna (属性测试/可选)

---

## 1. 测试范围

| 合约                          | 测试文件                              | 优先级 | 说明                                          |
| ----------------------------- | ------------------------------------- | ------ | --------------------------------------------- |
| `AgentArenaEVM.sol`           | `test/AgentArenaEVM.t.sol`            | P0     | 任务生命周期、费用分配、错误码、重入          |
| `JudgeRegistry.sol`           | `test/JudgeRegistry.t.sol`            | P0     | Judge 注册/质押/解押/分配、权限               |
| `AgentMRegistry.sol`          | `test/AgentMRegistry.t.sol`           | P0     | 用户注册、Agent 创建、用户名冲突              |
| `SocialGraph.sol`             | `test/SocialGraph.t.sol`              | P0     | 关注/取关、事件、重复操作                     |
| `ReputationVerifier.sol`      | `test/ReputationVerifier.t.sol`       | P0     | Ed25519 签名验证、重放保护                    |
| `GradienceReputationFeed.sol` | `test/GradienceReputationFeed.t.sol`  | P0     | Oracle 签名、权限、更新逻辑                   |
| Cross-Chain E2E               | `test/CrossChainReputation.e2e.t.sol` | P1     | Solana → Oracle → EVM 声誉桥接（首发 XLayer） |
| Integration                   | `test/Integration.t.sol`              | P1     | 合约间交互：Arena + Judge + Feed              |

---

## 2. 测试环境

### 2.1 本地环境

```bash
cd apps/agent-layer-evm
forge test
forge coverage
```

### 2.2 测试网络

- **Anvil (local)**: 默认，用于单元测试和快速反馈（`anvil`）
- **EVM Testnet Fork（首选 XLayer Testnet）**: 用于需要真实区块哈希或预部署状态的集成测试（`anvil --fork-url https://testrpc.xlayer.tech`）

### 2.3 测试辅助合约/库

| 辅助项                    | 用途                                                                |
| ------------------------- | ------------------------------------------------------------------- |
| `MockERC20.sol`           | ERC20 支付路径测试                                                  |
| `MockVRFCoordinator.sol`  | Phase 2 VRF Judge 分配测试                                          |
| `ReentrancyAttacker.sol`  | 重入攻击模拟                                                        |
| `noble-ed25519` (Node.js) | 生成 ReputationVerifier 测试用的有效/无效签名（Foundry `ffi` 调用） |

---

## 3. AgentArenaEVM 测试规范

### 3.1 Happy Path — 任务全生命周期

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AgentArenaEVM.sol";
import "../src/JudgeRegistry.sol";
import "../src/GradienceReputationFeed.sol";

contract AgentArenaEVMHappyPathTest is Test {
    AgentArenaEVM public arena;
    JudgeRegistry public judgeRegistry;
    GradienceReputationFeed public reputationFeed;

    address poster = address(0x1);
    address agent = address(0x2);
    address judge = address(0x3);
    address treasury = address(0x4);

    function setUp() public {
        vm.startPrank(address(this));
        judgeRegistry = new JudgeRegistry();
        reputationFeed = new GradienceReputationFeed();
        arena = new AgentArenaEVM();
        arena.initialize(treasury, address(judgeRegistry), address(reputationFeed));
        vm.stopPrank();

        // Register judge with stake
        vm.deal(judge, 10 ether);
        vm.prank(judge);
        judgeRegistry.register{value: 1 ether}(new uint8[](1));
    }

    function test_CreateTaskWithETHReward() public {
        vm.deal(poster, 10 ether);
        vm.prank(poster);
        uint256 taskId = arena.postTask{value: 1 ether}(
            "eval-ref",
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            judge,
            1,
            0.1 ether,
            address(0)
        );

        (address taskPoster,,,,,,,,AgentArenaEVM.TaskState state,,) = arena.tasks(taskId);
        assertEq(taskPoster, poster);
        assertEq(uint(state), uint(AgentArenaEVM.TaskState.Open));
    }

    function test_ApplyWithETHStake() public {
        uint256 taskId = _createTask();
        vm.deal(agent, 10 ether);
        vm.prank(agent);
        arena.applyForTask{value: 0.1 ether}(taskId);

        AgentArenaEVM.ApplicationState appState = arena.applications(taskId, agent);
        assertEq(uint(appState), uint(AgentArenaEVM.ApplicationState.Applied));
    }

    function test_JudgeAndPay_Exact95_3_2_Split() public {
        uint256 taskId = _createTaskWithAppliedAgent();

        uint256 winnerBefore = agent.balance;
        uint256 judgeBefore = judge.balance;
        uint256 treasuryBefore = treasury.balance;
        uint256 reward = 1 ether;

        vm.prank(judge);
        arena.judgeAndPay(taskId, agent, 80);

        assertEq(agent.balance - winnerBefore, reward * 9500 / 10000);
        assertEq(judge.balance - judgeBefore, reward * 300 / 10000);
        assertEq(treasury.balance - treasuryBefore, reward * 200 / 10000);

        (,,,,,,,,AgentArenaEVM.TaskState state,,) = arena.tasks(taskId);
        assertEq(uint(state), uint(AgentArenaEVM.TaskState.Completed));
    }

    function test_ClaimStakeAfterCompletion() public {
        uint256 taskId = _createTaskWithAppliedAgent();
        address loser = address(0x5);
        vm.deal(loser, 10 ether);
        vm.prank(loser);
        arena.applyForTask{value: 0.1 ether}(taskId);

        vm.prank(judge);
        arena.judgeAndPay(taskId, agent, 80);

        uint256 before = loser.balance;
        vm.prank(loser);
        arena.claimStake(taskId);
        assertEq(loser.balance - before, 0.1 ether);
    }

    function _createTask() internal returns (uint256) {
        vm.deal(poster, 10 ether);
        vm.prank(poster);
        return arena.postTask{value: 1 ether}(
            "eval-ref",
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            judge,
            1,
            0.1 ether,
            address(0)
        );
    }

    function _createTaskWithAppliedAgent() internal returns (uint256) {
        uint256 taskId = _createTask();
        vm.deal(agent, 10 ether);
        vm.prank(agent);
        arena.applyForTask{value: 0.1 ether}(taskId);
        vm.prank(agent);
        arena.submitResult(taskId, "result-ref", "trace-ref");
        return taskId;
    }
}
```

### 3.2 Error Path — 所有 Custom Error 触发

```solidity
contract AgentArenaEVMErrorTest is Test {
    AgentArenaEVM public arena;

    function test_Revert_ZeroReward() public {
        vm.expectRevert(AgentArenaEVM.ZeroReward.selector);
        arena.postTask("ref", uint64(block.timestamp + 1 days), uint64(block.timestamp + 2 days), address(0), 0, 0, address(0));
    }

    function test_Revert_InvalidRefLength() public {
        vm.expectRevert(AgentArenaEVM.InvalidRefLength.selector);
        arena.postTask{value: 1 ether}(string(new bytes(257)), uint64(block.timestamp + 1 days), uint64(block.timestamp + 2 days), address(0), 0, 0, address(0));
    }

    function test_Revert_InvalidCategory() public {
        vm.expectRevert(AgentArenaEVM.InvalidCategory.selector);
        arena.postTask{value: 1 ether}("ref", uint64(block.timestamp + 1 days), uint64(block.timestamp + 2 days), address(0), 8, 0, address(0));
    }

    function test_Revert_InvalidDeadline() public {
        vm.expectRevert(AgentArenaEVM.InvalidDeadline.selector);
        arena.postTask{value: 1 ether}("ref", uint64(block.timestamp), uint64(block.timestamp + 1 days), address(0), 0, 0, address(0));
    }

    function test_Revert_InvalidJudgeDeadline() public {
        vm.expectRevert(AgentArenaEVM.InvalidJudgeDeadline.selector);
        arena.postTask{value: 1 ether}("ref", uint64(block.timestamp + 2 days), uint64(block.timestamp + 1 days), address(0), 0, 0, address(0));
    }

    function test_Revert_TaskNotFound() public {
        vm.expectRevert(AgentArenaEVM.TaskNotFound.selector);
        arena.applyForTask(999);
    }

    function test_Revert_DeadlinePassed() public {
        uint256 taskId = _createTaskWithDeadline(block.timestamp + 1 hours);
        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert(AgentArenaEVM.DeadlinePassed.selector);
        arena.applyForTask(taskId);
    }

    function test_Revert_AlreadyApplied() public {
        uint256 taskId = _createTask();
        vm.deal(address(0xA), 10 ether);
        vm.startPrank(address(0xA));
        arena.applyForTask{value: 0.1 ether}(taskId);
        vm.expectRevert(AgentArenaEVM.AlreadyApplied.selector);
        arena.applyForTask{value: 0.1 ether}(taskId);
        vm.stopPrank();
    }

    function test_Revert_InvalidStakeAmount() public {
        uint256 taskId = _createTask();
        vm.deal(address(0xA), 10 ether);
        vm.prank(address(0xA));
        vm.expectRevert(AgentArenaEVM.InvalidStakeAmount.selector);
        arena.applyForTask{value: 0.01 ether}(taskId);
    }

    function test_Revert_NotTaskJudge() public {
        uint256 taskId = _createTaskWithAppliedAgent();
        vm.prank(address(0xBAD));
        vm.expectRevert(AgentArenaEVM.NotTaskJudge.selector);
        arena.judgeAndPay(taskId, address(0xA), 80);
    }

    function test_Revert_InvalidScore() public {
        uint256 taskId = _createTaskWithAppliedAgent();
        vm.prank(judge);
        vm.expectRevert(AgentArenaEVM.InvalidScore.selector);
        arena.judgeAndPay(taskId, agent, 50);
    }

    // ... additional error tests
}
```

### 3.3 费用分配精确测试

```solidity
function test_FeeDistribution_95_3_2() public {
    uint256 taskId = _createTaskWithAppliedAgent();
    vm.prank(judge);
    arena.judgeAndPay(taskId, agent, 80);

    (,,,,,,,,,,uint8 score) = arena.tasks(taskId);
    assertEq(score, 80);
}

function test_Refund100PercentToPoster_ScoreBelow60() public {
    uint256 taskId = _createTaskWithAppliedAgent();
    uint256 posterBefore = poster.balance;

    vm.prank(judge);
    arena.judgeAndPay(taskId, agent, 50);

    assertEq(poster.balance - posterBefore, 1 ether);
    (,,,,,,,,AgentArenaEVM.TaskState state,,) = arena.tasks(taskId);
    assertEq(uint(state), uint(AgentArenaEVM.TaskState.Refunded));
}

function test_ClaimExpired_RefundsPosterAndStakes() public {
    uint256 taskId = _createTaskWithAppliedAgent();
    uint256 posterBefore = poster.balance;

    vm.warp(block.timestamp + 3 days);
    arena.claimExpired(taskId);

    assertEq(poster.balance - posterBefore, 1 ether);
    assertEq(agent.balance, 10 ether); // stake returned
}
```

### 3.4 ERC20 路径测试

```solidity
function test_CreateTaskWithERC20Reward() public {
    MockERC20 token = new MockERC20("Test", "TST", 18);
    token.mint(poster, 1000 ether);

    vm.startPrank(poster);
    token.approve(address(arena), 100 ether);
    uint256 taskId = arena.postTask("ref", uint64(block.timestamp + 1 days), uint64(block.timestamp + 2 days), judge, 1, 0.1 ether, address(token));
    vm.stopPrank();

    assertEq(token.balanceOf(address(arena)), 100 ether);
}
```

### 3.5 安全测试

```solidity
function test_ReentrancyProtectionOnJudgeAndPay() public {
    ReentrancyAttacker attacker = new ReentrancyAttacker(address(arena));
    uint256 taskId = _createTask();

    vm.deal(address(attacker), 10 ether);
    vm.prank(address(attacker));
    arena.applyForTask{value: 0.1 ether}(taskId);
    vm.prank(address(attacker));
    arena.submitResult(taskId, "result", "trace");

    vm.prank(judge);
    vm.expectRevert("ReentrancyGuard: reentrant call");
    arena.judgeAndPay(taskId, address(attacker), 80);
}
```

---

## 4. JudgeRegistry 测试规范

```solidity
contract JudgeRegistryTest is Test {
    JudgeRegistry public registry;

    function setUp() public {
        registry = new JudgeRegistry();
    }

    function test_RegisterWithMinStakeAndCategories() public {
        vm.deal(address(0x1), 10 ether);
        vm.prank(address(0x1));
        uint8[] memory cats = new uint8[](2);
        cats[0] = 1; cats[1] = 2;
        registry.register{value: 1 ether}(cats);

        assertTrue(registry.isJudge(address(0x1)));
    }

    function test_Revert_InsufficientStake() public {
        vm.deal(address(0x1), 10 ether);
        vm.prank(address(0x1));
        vm.expectRevert(JudgeRegistry.InsufficientStake.selector);
        registry.register{value: 0.1 ether}(new uint8[](0));
    }

    function test_RequestUnstake() public {
        test_RegisterWithMinStakeAndCategories();
        vm.prank(address(0x1));
        registry.requestUnstake();
        assertEq(uint(registry.status(address(0x1))), uint(JudgeRegistry.Status.Unstaking));
    }

    function test_Revert_CompleteUnstakeBeforeCooldown() public {
        test_RequestUnstake();
        vm.prank(address(0x1));
        vm.expectRevert(JudgeRegistry.CooldownNotMet.selector);
        registry.completeUnstake();
    }

    function test_SelectJudgeFilteredByCategory() public {
        // register multiple judges with different categories
        // verify selectJudge(category, randomness) returns valid address
    }
}
```

---

## 5. AgentMRegistry + SocialGraph 测试规范

### 5.1 AgentMRegistry

```solidity
contract AgentMRegistryTest is Test {
    AgentMRegistry public registry;

    function setUp() public {
        registry = new AgentMRegistry();
    }

    function test_RegisterUser() public {
        vm.prank(address(0x1));
        registry.register("alice", "ipfs://metadata");
        assertEq(registry.resolveUsername("alice"), address(0x1));
    }

    function test_Revert_DuplicateUsername() public {
        test_RegisterUser();
        vm.prank(address(0x2));
        vm.expectRevert(AgentMRegistry.UsernameTaken.selector);
        registry.register("alice", "ipfs://other");
    }

    function test_CreateAgent() public {
        test_RegisterUser();
        vm.prank(address(0x1));
        uint256 agentId = registry.createAgent("ipfs://agent");
        assertEq(registry.agentOwner(agentId), address(0x1));
    }
}
```

### 5.2 SocialGraph

```solidity
contract SocialGraphTest is Test {
    AgentMRegistry public registry;
    SocialGraph public graph;

    function setUp() public {
        registry = new AgentMRegistry();
        graph = new SocialGraph(address(registry));
    }

    function test_Follow() public {
        _registerBoth();
        vm.prank(address(0x1));
        graph.follow(address(0x2));
        assertTrue(graph.isFollowing(address(0x1), address(0x2)));
    }

    function test_Revert_SelfFollow() public {
        _registerBoth();
        vm.prank(address(0x1));
        vm.expectRevert(SocialGraph.SelfFollow.selector);
        graph.follow(address(0x1));
    }

    function test_Unfollow() public {
        test_Follow();
        vm.prank(address(0x1));
        graph.unfollow(address(0x2));
        assertFalse(graph.isFollowing(address(0x1), address(0x2)));
    }
}
```

---

## 6. Reputation Bridge 测试规范

### 6.1 ReputationVerifier

```solidity
contract ReputationVerifierTest is Test {
    ReputationVerifier public verifier;

    function setUp() public {
        verifier = new ReputationVerifier();
        verifier.setEd25519Signer(ed25519Signer);
    }

    function test_VerifyValidEd25519Signature() public {
        // Use ffi to generate valid signature via noble-ed25519
        string[] memory inputs = new string[](3);
        inputs[0] = "node";
        inputs[1] = "scripts/sign-reputation.js";
        inputs[2] = vm.toString(payloadHash);
        bytes memory result = vm.ffi(inputs);
        (bytes memory sig, bytes32 pubkey) = abi.decode(result, (bytes, bytes32));

        assertTrue(verifier.verifyReputation(payload, sig, pubkey));
    }

    function test_Revert_InvalidSignature() public {
        bytes memory fakeSig = new bytes(64);
        vm.expectRevert(ReputationVerifier.INVALID_SIGNATURE.selector);
        verifier.submitReputation(payload, fakeSig, pubkey);
    }

    function test_Revert_NonMonotonicTimestamp() public {
        // submit t=100, then submit t=90
        verifier.submitReputation(payload100, sig100, pubkey);
        vm.expectRevert(ReputationVerifier.NON_MONOTONIC_TIMESTAMP.selector);
        verifier.submitReputation(payload90, sig90, pubkey);
    }

    function test_Revert_FutureTimestampBeyondSkew() public {
        vm.warp(1000);
        vm.expectRevert(ReputationVerifier.TOO_FAR_IN_FUTURE.selector);
        verifier.submitReputation(payload2000, sig2000, pubkey);
    }
}
```

### 6.2 GradienceReputationFeed

```solidity
contract GradienceReputationFeedTest is Test {
    GradienceReputationFeed public feed;
    address oracle = address(0xORACLE);

    function setUp() public {
        feed = new GradienceReputationFeed();
        feed.setOracle(oracle);
    }

    function test_UpdateReputationWithValidOracleSignature() public {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePrivateKey, digest);

        vm.prank(oracle);
        feed.updateReputation(evmAddr, solanaPubkey, 8000, catScores, timestamp, abi.encodePacked(r, s, v));

        (uint16 globalScore,,) = feed.reputationOf(evmAddr);
        assertEq(globalScore, 8000);
    }

    function test_Revert_InvalidOracleSignature() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(GradienceReputationFeed.InvalidSignature.selector);
        feed.updateReputation(evmAddr, solanaPubkey, 8000, catScores, timestamp, new bytes(65));
    }

    function test_Revert_NonOracleCaller() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(GradienceReputationFeed.NotOracle.selector);
        feed.updateReputation(evmAddr, solanaPubkey, 8000, catScores, timestamp, validSig);
    }
}
```

### 6.3 双轨读取集成测试

```solidity
contract ReputationIntegrationTest is Test {
    AgentArenaEVM public arena;
    GradienceReputationFeed public feed;
    ReputationVerifier public verifier;

    function test_ArenaReadsFeedWhenAvailable() public {
        feed.updateReputation(agent, solanaPubkey, 9000, catScores, timestamp, oracleSig);
        uint256 discounted = arena.getMinStakeForAgent(agent);
        assertLt(discounted, arena.baseMinStake());
    }

    function test_ArenaFallsBackToVerifier() public {
        // No feed data, but verifier has snapshot
        verifier.submitReputation(payload, sig, pubkey);
        uint256 stake = arena.getMinStakeForAgent(agent);
        assertLt(stake, arena.baseMinStake());
        assertGt(stake, 0);
    }

    function test_ArenaUsesFullMinStakeWhenNeitherExists() public {
        uint256 stake = arena.getMinStakeForAgent(address(0xNEW));
        assertEq(stake, arena.baseMinStake());
    }
}
```

---

## 7. 跨链声誉端到端测试 (P1)

```solidity
contract CrossChainReputationE2ETest is Test {
    function test_FullFlow_SolanaToEVM() public {
        // 1. Simulate Solana reputation data (mock PDA values)
        // 2. Oracle Aggregation Engine computes globalScore + categoryScores
        // 3. Oracle signs payload for EVM
        // 4. Submit to GradienceReputationFeed
        // 5. AgentArenaEVM reads and applies stake discount
        // 6. Agent applies for task with reduced stake

        // Steps 1-3 mocked via ffi script
        string[] memory inputs = new string[](2);
        inputs[0] = "node";
        inputs[1] = "scripts/mock-oracle-aggregation.js";
        bytes memory result = vm.ffi(inputs);

        (address evmAddr, bytes32 solanaPubkey, uint16 globalScore, uint16[8] memory cats, uint64 ts, bytes memory oracleSig) =
            abi.decode(result, (address, bytes32, uint16, uint16[8], uint64, bytes));

        feed.updateReputation(evmAddr, solanaPubkey, globalScore, cats, ts, oracleSig);

        uint256 discountedStake = arena.getMinStakeForAgent(evmAddr);
        assertLt(discountedStake, arena.baseMinStake());
    }
}
```

---

## 8. 覆盖率目标

| 合约                    | 语句覆盖率 | 分支覆盖率 | 备注                     |
| ----------------------- | ---------- | ---------- | ------------------------ |
| AgentArenaEVM           | ≥ 95%      | ≥ 90%      | 所有 error path 必须覆盖 |
| JudgeRegistry           | ≥ 90%      | ≥ 85%      | Judge 分配边界需覆盖     |
| AgentMRegistry          | ≥ 90%      | ≥ 85%      |                          |
| SocialGraph             | ≥ 90%      | ≥ 80%      |                          |
| ReputationVerifier      | ≥ 90%      | ≥ 85%      | 签名有效/无效/过期/重放  |
| GradienceReputationFeed | ≥ 90%      | ≥ 85%      |                          |

> Foundry 使用 `forge coverage` 自动生成覆盖率报告，内建 LCOV 输出，可直接接入 CI。

---

## 9. 安全测试清单

- [ ] Slither 扫描无 High/Medium 风险（或已全部记录并规划修复）
- [ ] Reentrancy 攻击路径测试（Arena 的所有 payable 函数）
- [ ] Access control 边界测试（所有 `onlyOwner` / `onlyOracle`）
- [ ] Integer boundary 测试（reward = 1 wei, reward = max uint256-1）
- [ ] Timestamp manipulation 测试（Deadline/冷却期绕过）
- [ ] Signature replay / malleability 测试（ReputationVerifier & Feed）

---

## 10. 运行命令速查

```bash
# 全部测试
cd apps/agent-layer-evm
forge test

# 单个文件
forge test --match-path test/AgentArenaEVM.t.sol
forge test --match-path test/JudgeRegistry.t.sol
forge test --match-path test/AgentMRegistry.t.sol
forge test --match-path test/SocialGraph.t.sol
forge test --match-path test/ReputationVerifier.t.sol
forge test --match-path test/GradienceReputationFeed.t.sol
forge test --match-path test/CrossChainReputation.e2e.t.sol
forge test --match-path test/Integration.t.sol

# 单个测试函数
forge test --match-test test_JudgeAndPay_Exact95_3_2_Split

# 详细跟踪
forge test -vvvv

# 覆盖率
forge coverage

# 安全扫描
slither .

# 本地 fork 测试
anvil --fork-url https://testrpc.xlayer.tech
FOUNDRY_ETH_RPC_URL=http://localhost:8545 forge test --match-test test_Fork*
```

---

_状态: Phase 5 Test Spec — Ready for Phase 6 Implementation_
