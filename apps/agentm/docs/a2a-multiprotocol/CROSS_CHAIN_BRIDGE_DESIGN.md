# 跨链桥集成方案 - LayerZero / Wormhole / Debridge

> 将多链 Agent 行为同步到 Soul 主链的完整架构设计

---

## 1. 跨链桥对比

| 特性 | LayerZero | Wormhole | Debridge |
|------|-----------|----------|----------|
| **机制** | Ultra Light Node (ULN) | Guardian Network | 去中心化验证器 |
| **安全性** | 高（依赖 Oracle + Relayer） | 中（19个 Guardian） | 高（质押验证） |
| **速度** | 快（2-10分钟） | 中（15分钟） | 快（1-5分钟） |
| **成本** | 中 | 低 | 中 |
| **支持链** | 50+ | 30+ | 10+ |
| **消息传递** | ✅ 原生支持 | ✅ 原生支持 | ✅ 原生支持 |
| **EVM 支持** | ✅ | ✅ | ✅ |
| **Solana 支持** | ✅ | ✅ | ✅ |
| **推荐场景** | 高频消息 | 低成本场景 | 高价值资产 |

---

## 2. 架构设计

### 2.1 核心概念

```
┌─────────────────────────────────────────────────────────────────┐
│                        Soul 主链 (核心协议)                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              SoulReputationAggregator                    │   │
│  │  - 聚合所有链上的 Agent 行为                              │   │
│  │  - 计算全局声誉分数                                       │   │
│  │  - 生成统一身份凭证                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ 跨链消息同步
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     跨链桥适配器层                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  LayerZero  │  │  Wormhole   │  │  Debridge   │             │
│  │   Adapter   │  │   Adapter   │  │   Adapter   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │ Ethereum │    │  Polygon │    │  Arbitrum│
        │  Agent   │    │  Agent   │    │  Agent   │
        │ Activity │    │ Activity │    │ Activity │
        └──────────┘    └──────────┘    └──────────┘
```

### 2.2 消息类型

```typescript
// 跨链同步的消息类型
interface CrossChainReputationMessage {
  // 消息头
  version: '1.0';
  messageType: 'reputation_sync' | 'task_completion' | 'attestation';
  sourceChain: string;      // 来源链
  targetChain: 'soul';      // 目标链（Soul 主链）
  timestamp: number;
  nonce: number;            // 防重放

  // Agent 身份
  agentAddress: string;     // 来源链地址
  soulAddress: string;      // Soul 链对应地址

  // 声誉数据
  reputationData: {
    taskCompletions: TaskCompletion[];
    attestations: Attestation[];
    scores: ChainScore[];
  };

  // 签名
  signature: string;        // Agent 签名
  proof: MerkleProof;       // 跨链证明
}

interface TaskCompletion {
  taskId: string;
  taskType: 'coding' | 'audit' | 'design' | 'analysis';
  completedAt: number;
  score: number;            // 0-100
  reward: string;           // 金额
  evaluator: string;        // 评估者地址
  metadata: string;         // IPFS hash
}

interface Attestation {
  attestationType: 'skill' | 'reliability' | 'quality';
  attester: string;         // 证明者
  value: number;            // 证明值
  timestamp: number;
  expiresAt: number;
}
```

---

## 3. 具体实现方案

### 3.1 LayerZero 集成

```typescript
// adapters/layerzero-adapter.ts
import { Endpoint } from '@layerzerolabs/lz-v2-utilities';

export class LayerZeroAdapter implements CrossChainBridge {
  readonly name = 'layerzero';
  private endpoint: Endpoint;
  private eid: number; // Endpoint ID

  constructor(config: LayerZeroConfig) {
    this.endpoint = new Endpoint(config.endpointAddress);
    this.eid = config.eid;
  }

  async sendReputationMessage(
    message: CrossChainReputationMessage
  ): Promise<BridgeResult> {
    // 1. 编码消息
    const payload = this.encodeMessage(message);

    // 2. 调用 LayerZero Endpoint
    const params = {
      dstEid: this.getSoulEndpointId(), // Soul 链的 Endpoint ID
      to: this.toBytes32(message.soulAddress),
      amountLD: 0, // 不转移资产
      minAmountLD: 0,
      extraOptions: Options.newOptions().addExecutorLzReceiveOption(200000, 0),
      composeMsg: payload,
      oftCmd: '0x',
    };

    // 3. 发送消息
    const tx = await this.endpoint.send(params, { value: nativeFee });

    return {
      txHash: tx.hash,
      messageId: this.generateMessageId(tx.hash),
      status: 'pending',
      estimatedTime: 120, // 2分钟
    };
  }

  async verifyMessage(
    messageId: string
  ): Promise<VerificationResult> {
    // 查询 LayerZero 的 Delivered 事件
    const delivered = await this.endpoint.delivered(messageId);

    return {
      verified: delivered,
      confirmations: delivered ? 1 : 0,
      requiredConfirmations: 1,
    };
  }

  private encodeMessage(msg: CrossChainReputationMessage): string {
    return ethers.utils.defaultAbiCoder.encode(
      [
        'tuple(string version, uint8 messageType, string sourceChain, uint256 timestamp, uint256 nonce, address agentAddress, bytes reputationData)',
      ],
      [msg]
    );
  }
}
```

### 3.2 Wormhole 集成

```typescript
// adapters/wormhole-adapter.ts
import { wormhole } from '@wormhole-foundation/sdk';

export class WormholeAdapter implements CrossChainBridge {
  readonly name = 'wormhole';
  private wh: Wormhole;

  constructor(config: WormholeConfig) {
    this.wh = wormhole('Mainnet', [evm, solana]);
  }

  async sendReputationMessage(
    message: CrossChainReputationMessage
  ): Promise<BridgeResult> {
    // 1. 获取源链和目标链的上下文
    const sourceChain = this.wh.getChain(message.sourceChain);
    const targetChain = this.wh.getChain('Solana'); // Soul 链

    // 2. 创建消息
    const payload = this.encodeMessage(message);

    // 3. 发布消息到 Wormhole
    const tx = await sourceChain.sendTransaction({
      to: WORMHOLE_CORE_BRIDGE,
      data: this.wh.serialize({
        payload,
        nonce: message.nonce,
        consistencyLevel: 15, // 15个区块确认
      }),
    });

    // 4. 获取 VAA (Verified Action Approval)
    const vaa = await this.wh.getVAA(tx.hash, { timeout: 15 * 60 * 1000 });

    return {
      txHash: tx.hash,
      messageId: vaa.hash,
      vaa: vaa.bytes,
      status: 'pending',
      estimatedTime: 900, // 15分钟
    };
  }

  async redeemOnTarget(
    vaa: Uint8Array
  ): Promise<RedeemResult> {
    // 在 Soul 链上 redeem VAA
    const targetChain = this.wh.getChain('Solana');

    const tx = await targetChain.redeem({
      vaa,
      recipient: SOUL_REPUTATION_CONTRACT,
    });

    return {
      txHash: tx.id,
      status: 'completed',
    };
  }
}
```

### 3.3 Debridge 集成

```typescript
// adapters/debridge-adapter.ts
import { DeBridgeGate } from '@debridge-finance/desdk';

export class DebridgeAdapter implements CrossChainBridge {
  readonly name = 'debridge';
  private gate: DeBridgeGate;

  constructor(config: DebridgeConfig) {
    this.gate = new DeBridgeGate(config.gateAddress);
  }

  async sendReputationMessage(
    message: CrossChainReputationMessage
  ): Promise<BridgeResult> {
    // Debridge 主要用于资产跨链，消息传递需要包装
    const submission = await this.gate.sendMessage({
      targetChainId: this.getChainId('soul'),
      targetContract: SOUL_REPUTATION_CONTRACT,
      message: this.encodeMessage(message),
      autoParams: {
        executionFee: 0,
        flags: 0,
        fallbackAddress: message.agentAddress,
        data: '0x',
      },
    });

    return {
      txHash: submission.transactionHash,
      messageId: submission.submissionId,
      status: 'pending',
      estimatedTime: 300, // 5分钟
    };
  }
}
```

---

## 4. Soul 链合约设计

### 4.1 声誉聚合合约

```solidity
// SoulReputationAggregator.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SoulReputationAggregator is OFT {
    using ECDSA for bytes32;

    // 支持的跨链桥
    enum BridgeType { LayerZero, Wormhole, Debridge }

    // Agent 声誉数据
    struct AgentReputation {
        uint256 totalTasksCompleted;
        uint256 totalRewards;
        uint256 averageScore;
        uint256 lastUpdate;
        mapping(string => ChainReputation) chainData;
    }

    struct ChainReputation {
        uint256 tasksCompleted;
        uint256 rewards;
        uint256 score;
        uint256 lastSync;
        bytes32 merkleRoot;
    }

    // 存储
    mapping(address => AgentReputation) public reputations;
    mapping(bytes32 => bool) public processedMessages;

    // 事件
    event ReputationSynced(
        address indexed agent,
        string sourceChain,
        uint256 tasksCompleted,
        uint256 score,
        BridgeType bridge
    );

    // 跨链消息处理器
    function lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) public payable override {
        super.lzReceive(_origin, _guid, _message, _executor, _extraData);

        // 解析消息
        CrossChainMessage memory msg = decodeMessage(_message);

        // 防重放
        bytes32 msgHash = keccak256(_message);
        require(!processedMessages[msgHash], "Message already processed");
        processedMessages[msgHash] = true;

        // 更新声誉
        _updateReputation(msg);

        emit ReputationSynced(
            msg.agentAddress,
            msg.sourceChain,
            msg.reputationData.taskCompletions.length,
            msg.reputationData.scores[0].value,
            BridgeType.LayerZero
        );
    }

    function _updateReputation(CrossChainMessage memory msg) internal {
        AgentReputation storage rep = reputations[msg.agentAddress];

        // 更新链特定数据
        ChainReputation storage chainRep = rep.chainData[msg.sourceChain];
        chainRep.tasksCompleted = msg.reputationData.taskCompletions.length;
        chainRep.lastSync = block.timestamp;

        // 计算加权平均分
        uint256 totalScore = 0;
        uint256 totalWeight = 0;

        for (uint i = 0; i < msg.reputationData.scores.length; i++) {
            ChainScore memory score = msg.reputationData.scores[i];
            totalScore += score.value * score.weight;
            totalWeight += score.weight;
        }

        if (totalWeight > 0) {
            chainRep.score = totalScore / totalWeight;
        }

        // 更新全局统计
        rep.totalTasksCompleted += msg.reputationData.taskCompletions.length;
        rep.lastUpdate = block.timestamp;

        // 重新计算全局平均分
        _recalculateGlobalAverage(msg.agentAddress);
    }

    function _recalculateGlobalAverage(address agent) internal {
        AgentReputation storage rep = reputations[agent];

        uint256 totalScore = 0;
        uint256 chainCount = 0;

        // 遍历所有支持的链
        string[] memory chains = getSupportedChains();
        for (uint i = 0; i < chains.length; i++) {
            ChainReputation storage chainRep = rep.chainData[chains[i]];
            if (chainRep.lastSync > 0) {
                totalScore += chainRep.score;
                chainCount++;
            }
        }

        if (chainCount > 0) {
            rep.averageScore = totalScore / chainCount;
        }
    }

    // 查询函数
    function getReputation(address agent)
        external
        view
        returns (
            uint256 totalTasks,
            uint256 avgScore,
            uint256 lastUpdate,
            string[] memory chains,
            uint256[] memory chainScores
        )
    {
        AgentReputation storage rep = reputations[agent];

        chains = getSupportedChains();
        chainScores = new uint256[](chains.length);

        for (uint i = 0; i < chains.length; i++) {
            chainScores[i] = rep.chainData[chains[i]].score;
        }

        return (
            rep.totalTasksCompleted,
            rep.averageScore,
            rep.lastUpdate,
            chains,
            chainScores
        );
    }
}
```

---

## 5. 推荐架构

### 5.1 主从架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Soul 主链                              │
│                    (权威声誉源)                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         SoulReputationAggregator                     │   │
│  │  - 接收所有跨链消息                                   │   │
│  │  - 验证并聚合声誉数据                                 │   │
│  │  - 生成统一声誉凭证                                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ 主要：LayerZero (高频)
                              │ 备用：Wormhole (低成本)
                              │ 特殊：Debridge (高价值)
┌─────────────────────────────────────────────────────────────┐
│                      源链 (Ethereum/Polygon/...)              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              AgentReputationCollector                │   │
│  │  - 收集 Agent 在源链的行为                            │   │
│  │  - 打包成跨链消息                                     │   │
│  │  - 定期同步到 Soul                                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 使用建议

| 场景 | 推荐桥 | 原因 |
|------|--------|------|
**日常声誉同步** | LayerZero | 速度快，支持消息传递
**批量历史同步** | Wormhole | 成本低，适合大量数据
**高价值任务** | Debridge | 安全性高，有质押机制
**紧急同步** | LayerZero | 最快确认时间
**Solana 生态** | Wormhole | 原生支持最好

---

## 6. 实施路线图

### Phase 1: LayerZero 集成 (2周)
- [ ] 部署 SoulReputationAggregator 合约
- [ ] 实现 LayerZeroAdapter
- [ ] 测试 Ethereum ↔ Soul 同步
- [ ] 测试 Polygon ↔ Soul 同步

### Phase 2: Wormhole 集成 (1周)
- [ ] 实现 WormholeAdapter
- [ ] 添加 Guardian 验证
- [ ] 测试 Solana ↔ Soul 同步

### Phase 3: Debridge 集成 (1周)
- [ ] 实现 DebridgeAdapter
- [ ] 高价值任务特殊处理

### Phase 4: 优化 (1周)
- [ ] 消息压缩
- [ ] 批量同步
- [ ] 失败重试机制

---

## 7. 代码集成示例

```typescript
// 使用新的跨链适配器
const crossChainAdapter = new CrossChainAdapter({
  agentId: 'agent-address',
  bridges: [
    {
      type: 'layerzero',
      adapter: new LayerZeroAdapter({
        endpointAddress: '0x...',
        eid: 30101, // Ethereum
      }),
      priority: 1,
    },
    {
      type: 'wormhole',
      adapter: new WormholeAdapter({
        network: 'Mainnet',
      }),
      priority: 2,
    },
  ],
});

// 同步声誉到 Soul 链
await crossChainAdapter.syncReputation({
  targetChain: 'soul',
  reputationData: {
    taskCompletions: [...],
    scores: [...],
  },
  preferredBridge: 'layerzero', // 或自动选择
});
```

---

这个方案可以实现：
1. **多链声誉聚合** - 任何链上的 Agent 行为都能同步到 Soul
2. **灵活选择桥** - 根据场景选择最优跨链方案
3. **安全验证** - 多重验证机制确保数据真实性
4. **统一身份** - 跨链的 Agent 有统一的声誉凭证

你觉得这个方案如何？需要我实现具体的适配器代码吗？
