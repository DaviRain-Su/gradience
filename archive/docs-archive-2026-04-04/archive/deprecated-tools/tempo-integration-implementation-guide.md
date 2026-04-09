# Tempo 集成实施指南：从 Solana 核心到 MPP 流式支付

> **文档类型**: 具体实施指南  
> **日期**: 2026-04-03  
> **目标**: Tempo 作为首个扩展链集成  
> **优先级**: P1（Solana 核心稳定后启动）

---

## 执行摘要

**集成策略**: Solana 核心 + Tempo MPP 扩展

**核心价值**:

- MPP 流式支付：Agent 实时获得并使用资金
- 稳定币 gas：无需 TEMP 代币，USDC/USDT 即可
- Stripe 生态：企业级支付场景
- EVM 兼容：kernel 几乎零改动

**实施时间**: 3-4 周

---

## 1. Tempo 技术概览

### 1.1 核心参数

| 参数         | 值                   | 说明          |
| ------------ | -------------------- | ------------- |
| **共识**     | Simplex (Commonware) | 确定性最终性  |
| **块时间**   | ~0.4-0.6 秒          | 快速确认      |
| **TPS 目标** | >100,000             | 高吞吐        |
| **Gas 代币** | 任意主流 stablecoin  | USDC/USDT/DAI |
| **EVM 版本** | Osaka hardfork       | 最新特性      |
| **主网上线** | 2026-03-18           | 早期但已稳定  |

### 1.2 Machine Payments Protocol (MPP) 详解

```
MPP 核心概念:
├── Session: 一次性授权，持续支付能力
│   └── Poster 创建任务时设置预算上限
│   └── Agent 获胜后获得支出权限
│   └── 无需每次链上签名
│
├── Streaming Payment: 流式微支付
│   └── 按时间/里程碑实时发放
│   └── Agent 可立即使用资金
│
├── HTTP 402: 支付协商标准
│   └── Agent 像调用 API 一样简单付费
│   └── 自动处理 gas 和 nonce
│
└── Smart Account: 可编程账户
    └── 自动化支出规则
    └── 多签/阈值控制
```

### 1.3 与 Gradience 的契合点

| Gradience 需求 | Tempo 解决方案         | 优势               |
| -------------- | ---------------------- | ------------------ |
| Agent 自主结算 | MPP Session            | 无需每次人工触发   |
| 实时资金可用   | Streaming Payment      | Agent 可立即再投资 |
| 费用可预测     | Stablecoin gas         | 无代币波动风险     |
| 企业采用       | Stripe 生态            | 真实商业场景       |
| 隐私结算       | Confidential tx (soon) | ZK KYC 对接        |

---

## 2. 架构设计

### 2.1 集成架构

```
┌─────────────────────────────────────────────────────────────┐
│  Gradience Protocol (Unified)                               │
│  ├── Solana Core (Primary)                                  │
│  │   ├── Agent Arena (高频竞争)                             │
│   │   ├── Judge 评分 (主要结算)                             │
│   │   └── Reputation 积累 (主链记录)                        │
│   │                                                          │
│   └── Tempo Extension (Secondary)                           │
│       ├── MPP Session (流式支付)                            │
│       ├── Smart Account (自动化)                            │
│       └── Confidential Settlement (隐私)                    │
│                                                              │
│  Chain Hub SDK                                               │
│  ├── SolanaProvider (default)                               │
│  └── TempoProvider (optional)                               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
标准任务流程 (启用 Tempo 扩展):

1. Poster 在 Solana 发布任务
   └── 任务配置: 奖励 100 USDC, 期限 7 天

2. Agents 在 Solana 竞标
   └── Reputation 验证在 Solana

3. Judge 在 Solana 评分
   └── 评分结果上链

4. Settlement 路由到 Tempo (可选)
   └── 如果 Poster 选择 "stream payment"
   └── 创建 MPP Session: 预算 100 USDC

5. Agent 在 Tempo 接收流式奖励
   └── 实时可用资金
   └── 可自主决定支出

6. Reputation 更新回 Solana
   └── 跨链 attestation
```

### 2.3 决策逻辑

```typescript
// 智能路由决策
function selectSettlementChain(config: TaskConfig): string {
    // 优先 Tempo 的场景
    if (config.streamingPayment) return 'tempo';
    if (config.stablecoinOnly) return 'tempo';
    if (config.enterpriseContext) return 'tempo';
    if (config.privacyRequired && tempoConfidentialAvailable) return 'tempo';

    // 默认 Solana
    return 'solana';
}
```

---

## 3. SDK 接口设计

### 3.1 TempoProvider 实现

```typescript
// packages/chain-hub/src/providers/tempo.ts

import { ethers } from 'ethers';
import { ChainProvider, TaskConfig, Bid, JudgeResult } from '../types';

interface TempoConfig {
    rpcUrl: string;
    privateKey: string;
    mppContractAddress: string;
    stablecoinAddress: string; // USDC/USDT
}

interface MPPSession {
    sessionId: string;
    budget: bigint;
    spent: bigint;
    recipient: string;
    expiresAt: number;
    status: 'active' | 'paused' | 'closed';
}

interface StreamingConfig {
    recipient: string;
    totalAmount: bigint;
    duration: number; // seconds
    schedule: 'linear' | 'milestone' | 'instant';
    milestones?: { timestamp: number; amount: bigint }[];
}

export class TempoProvider implements ChainProvider {
    readonly chainId = 'tempo';
    readonly name = 'Tempo';
    readonly type = 'extension';

    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    private mppContract: ethers.Contract;

    constructor(config: TempoConfig) {
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.wallet = new ethers.Wallet(config.privateKey, this.provider);

        // MPP 合约 ABI (简化版)
        const mppAbi = [
            'function createSession(address recipient, uint256 budget, uint256 duration) returns (bytes32)',
            'function streamPayment(bytes32 sessionId, uint256 amount)',
            'function getSession(bytes32 sessionId) view returns (tuple(address recipient, uint256 budget, uint256 spent, uint256 expiresAt, uint8 status))',
            'function closeSession(bytes32 sessionId)',
            'event SessionCreated(bytes32 indexed sessionId, address indexed recipient, uint256 budget)',
            'event PaymentStreamed(bytes32 indexed sessionId, uint256 amount, uint256 timestamp)',
        ];

        this.mppContract = new ethers.Contract(config.mppContractAddress, mppAbi, this.wallet);
    }

    // ========== 核心 ChainProvider 接口 ==========

    async connect(): Promise<void> {
        const blockNumber = await this.provider.getBlockNumber();
        console.log(`Connected to Tempo at block ${blockNumber}`);
    }

    async disconnect(): Promise<void> {
        // 清理资源
        this.provider.destroy();
    }

    // ========== MPP 特有功能 ==========

    /**
     * 创建 MPP Session
     * Poster 在发布任务时调用
     */
    async createMPPSession(recipient: string, budget: bigint, duration: number): Promise<MPPSession> {
        // 授权 MPP 合约使用 stablecoin
        const tokenContract = new ethers.Contract(
            await this.getStablecoinAddress(),
            ['function approve(address spender, uint256 amount) returns (bool)'],
            this.wallet,
        );

        const approveTx = await tokenContract.approve(this.mppContract.target, budget);
        await approveTx.wait();

        // 创建 session
        const tx = await this.mppContract.createSession(recipient, budget, duration);
        const receipt = await tx.wait();

        // 解析事件获取 sessionId
        const event = receipt.logs.find(
            (log: any) => log.topics[0] === ethers.id('SessionCreated(bytes32,address,uint256)'),
        );
        const sessionId = event?.topics[1] || '';

        return {
            sessionId,
            budget,
            spent: 0n,
            recipient,
            expiresAt: Math.floor(Date.now() / 1000) + duration,
            status: 'active',
        };
    }

    /**
     * 流式支付
     * 按时间线性发放奖励
     */
    async streamPayment(sessionId: string, amount: bigint): Promise<void> {
        const tx = await this.mppContract.streamPayment(sessionId, amount);
        await tx.wait();
    }

    /**
     * 创建自动流
     * 设置后自动按时间释放资金
     */
    async createAutoStream(config: StreamingConfig): Promise<string> {
        // 创建 session
        const session = await this.createMPPSession(config.recipient, config.totalAmount, config.duration);

        if (config.schedule === 'linear') {
            // 线性释放：每秒释放固定金额
            const interval = 60; // 每分钟检查一次
            const amountPerInterval = config.totalAmount / BigInt(config.duration / interval);

            // 启动定时器 (在实际实现中，这可能是一个 keeper 服务)
            this.startLinearStream(session.sessionId, amountPerInterval, interval);
        } else if (config.schedule === 'milestone' && config.milestones) {
            // 里程碑释放：达到特定时间释放特定金额
            for (const milestone of config.milestones) {
                setTimeout(
                    async () => {
                        await this.streamPayment(session.sessionId, milestone.amount);
                    },
                    milestone.timestamp * 1000 - Date.now(),
                );
            }
        } else {
            // 立即释放
            await this.streamPayment(session.sessionId, config.totalAmount);
        }

        return session.sessionId;
    }

    private startLinearStream(sessionId: string, amountPerInterval: bigint, intervalSeconds: number): void {
        // 实际生产环境使用 keeper 服务或 cron job
        setInterval(async () => {
            try {
                await this.streamPayment(sessionId, amountPerInterval);
                console.log(`Streamed ${amountPerInterval} to session ${sessionId}`);
            } catch (error) {
                console.error('Stream payment failed:', error);
            }
        }, intervalSeconds * 1000);
    }

    /**
     * 查询 session 状态
     */
    async getSession(sessionId: string): Promise<MPPSession> {
        const session = await this.mppContract.getSession(sessionId);
        return {
            sessionId,
            budget: session.budget,
            spent: session.spent,
            recipient: session.recipient,
            expiresAt: Number(session.expiresAt),
            status: ['active', 'paused', 'closed'][session.status],
        };
    }

    /**
     * 关闭 session
     */
    async closeSession(sessionId: string): Promise<void> {
        const tx = await this.mppContract.closeSession(sessionId);
        await tx.wait();
    }

    /**
     * Agent 自主支付
     * Agent 使用已获得的 session 资金支付工具/服务
     */
    async agentAutonomousPay(
        sessionId: string,
        payment: {
            to: string;
            amount: bigint;
            reason: string;
        },
    ): Promise<{ txHash: string; remainingBudget: bigint }> {
        // 检查 session 状态
        const session = await this.getSession(sessionId);
        if (session.status !== 'active') {
            throw new Error('Session not active');
        }

        if (session.budget - session.spent < payment.amount) {
            throw new Error('Insufficient session budget');
        }

        // 执行支付
        const tx = await this.mppContract.streamPayment(sessionId, payment.amount);
        const receipt = await tx.wait();

        // 记录支付原因 (链下或事件)
        console.log(`Agent payment: ${payment.reason} to ${payment.to}`);

        // 返回剩余预算
        const updatedSession = await this.getSession(sessionId);
        return {
            txHash: receipt.hash,
            remainingBudget: updatedSession.budget - updatedSession.spent,
        };
    }

    // ========== ChainProvider 标准接口（代理到 Solana） ==========

    async createTask(config: TaskConfig): Promise<string> {
        // Tempo 上只创建轻量任务或代理到 Solana
        throw new Error('Tasks created on Solana. Use solana.createTask()');
    }

    async bidOnTask(taskId: string, bid: Bid): Promise<string> {
        throw new Error('Bidding on Solana. Use solana.bidOnTask()');
    }

    async submitResult(taskId: string, result: any): Promise<string> {
        throw new Error('Submissions on Solana. Use solana.submitResult()');
    }

    async judgeTask(taskId: string, score: number): Promise<any> {
        throw new Error('Judging on Solana. Use solana.judgeTask()');
    }

    /**
     * 在 Tempo 上执行结算（流式支付）
     */
    async settleTask(taskId: string): Promise<any> {
        // 从 Solana 获取任务结果
        // 在 Tempo 上创建 MPP session 并启动流式支付
        // 返回 session 信息

        // 实际实现需要从 Solana 查询任务状态
        const taskResult = await this.fetchTaskFromSolana(taskId);

        if (!taskResult.winner) {
            throw new Error('No winner determined');
        }

        // 创建流式支付
        const session = await this.createAutoStream({
            recipient: taskResult.winner,
            totalAmount: BigInt(taskResult.reward),
            duration: taskResult.duration || 7 * 24 * 60 * 60, // 默认7天
            schedule: 'linear',
        });

        return {
            taskId,
            sessionId: session,
            chain: 'tempo',
            status: 'streaming',
        };
    }

    async getReputation(agentId: string): Promise<any> {
        // Reputation 主链在 Solana，这里可以缓存或代理
        throw new Error('Reputation on Solana. Use solana.getReputation()');
    }

    // ========== 辅助方法 ==========

    private async getStablecoinAddress(): Promise<string> {
        // 返回 USDC 或 USDT 合约地址
        return '0xA0b86a33E6441F0cC3cEe5E61EbcB9e1E1d8B39b'; // Tempo USDC
    }

    private async fetchTaskFromSolana(taskId: string): Promise<any> {
        // 通过跨链查询或缓存获取 Solana 任务状态
        // 实际实现需要桥接服务
        return {
            winner: '0x...',
            reward: '100000000', // 100 USDC (6 decimals)
            duration: 604800, // 7 days
        };
    }
}
```

### 3.2 统一 Hub 接口更新

```typescript
// packages/chain-hub/src/hub.ts

import { SolanaProvider } from './providers/solana';
import { TempoProvider } from './providers/tempo';

interface GradienceHubConfig {
    solana: SolanaConfig;
    tempo?: TempoConfig; // 可选扩展
}

class GradienceHub {
    solana: SolanaProvider;
    tempo?: TempoProvider;

    constructor(config: GradienceHubConfig) {
        this.solana = new SolanaProvider(config.solana);

        if (config.tempo) {
            this.tempo = new TempoProvider(config.tempo);
        }
    }

    /**
     * 智能任务结算
     * 根据配置自动选择链
     */
    async settleTaskSmart(
        taskId: string,
        options: {
            useTempo?: boolean;
            streaming?: boolean;
        } = {},
    ): Promise<SettlementResult> {
        // 获取任务配置
        const task = await this.solana.getTask(taskId);

        // 决策使用哪条链
        const useTempo = options.useTempo ?? task.preferences?.streamingPayment ?? false;

        if (useTempo && this.tempo) {
            // 使用 Tempo 流式支付
            console.log('Routing settlement to Tempo for streaming payments');
            return await this.tempo.settleTask(taskId);
        } else {
            // 使用 Solana 标准结算
            console.log('Using Solana standard settlement');
            return await this.solana.settleTask(taskId);
        }
    }

    /**
     * 创建带流式支付选项的任务
     */
    async createTaskWithOptions(
        config: TaskConfig,
        settlementOptions: {
            chain: 'solana' | 'tempo';
            streaming?: boolean;
        },
    ): Promise<TaskResult> {
        // 在 Solana 创建任务（核心逻辑）
        const task = await this.solana.createTask({
            ...config,
            settlementChain: settlementOptions.chain,
            streamingPayment: settlementOptions.streaming,
        });

        // 如果选择了 Tempo，预创建 MPP session
        if (settlementOptions.chain === 'tempo' && this.tempo) {
            const session = await this.tempo.createMPPSession(
                '0x...', // 将在获胜后设置
                BigInt(config.reward),
                config.duration,
            );

            // 关联 session 到任务
            await this.linkSessionToTask(task.id, session.sessionId);
        }

        return task;
    }
}

// 使用示例
const hub = new GradienceHub({
    solana: {
        rpcUrl: 'https://api.mainnet-beta.solana.com',
        programId: 'GradCAJU13S33LdQK2FZ5cbuRXyToDaH7YVD2mFiqKF4',
        // ...
    },
    tempo: {
        rpcUrl: 'https://rpc.tempo.xyz',
        privateKey: process.env.TEMPO_PRIVATE_KEY!,
        mppContractAddress: '0x...',
        stablecoinAddress: '0x...',
    },
});

// 创建支持流式支付的任务
const task = await hub.createTaskWithOptions(
    {
        title: 'Build DeFi strategy',
        reward: 1000000000, // 1000 USDC
        deadline: 604800,
    },
    {
        chain: 'tempo',
        streaming: true,
    },
);

// 任务完成后智能结算
await hub.settleTaskSmart(task.id, { streaming: true });
```

---

## 4. 实施步骤

### Week 1: 环境搭建与合约部署

**Day 1-2: 环境准备**

```bash
# 1. 设置 Tempo 开发环境
npm install @tempo-network/sdk ethers

# 2. 获取 Tempo testnet 访问
# 申请 API key: https://docs.tempo.xyz

# 3. 配置钱包
export TEMPO_PRIVATE_KEY="your_private_key"
export TEMPO_RPC_URL="https://rpc.testnet.tempo.xyz"
```

**Day 3-5: 合约部署**

```solidity
// 简化版 MPP 适配合约
contract GradienceMPPAdapter {
    // 继承或调用 Tempo MPP 合约
    // 添加 Gradience 特定逻辑

    struct TaskSession {
        bytes32 solanaTaskId;
        bytes32 mppSessionId;
        address winner;
        uint256 totalReward;
        uint256 streamedAmount;
        bool isActive;
    }

    mapping(bytes32 => TaskSession) public taskSessions;

    event TaskSessionCreated(
        bytes32 indexed solanaTaskId,
        bytes32 indexed mppSessionId,
        address winner,
        uint256 reward
    );

    function createTaskSession(
        bytes32 solanaTaskId,
        address winner,
        uint256 reward,
        uint256 duration
    ) external returns (bytes32) {
        // 创建 MPP session
        bytes32 mppSession = mpp.createSession(winner, reward, duration);

        // 记录映射
        taskSessions[solanaTaskId] = TaskSession({
            solanaTaskId: solanaTaskId,
            mppSessionId: mppSession,
            winner: winner,
            totalReward: reward,
            streamedAmount: 0,
            isActive: true
        });

        emit TaskSessionCreated(solanaTaskId, mppSession, winner, reward);
        return mppSession;
    }
}
```

**Day 6-7: 测试与验证**

- 部署到 Tempo testnet
- 测试 MPP session 创建
- 测试流式支付

---

### Week 2: SDK 开发

**Day 8-10: Provider 实现**

- 实现 TempoProvider 类
- 集成 MPP 合约调用
- 错误处理和重试逻辑

**Day 11-12: 跨链桥接**

- 实现 Solana ↔ Tempo 状态同步
- 使用 Wormhole 或 LayerZero
- 测试消息传递

**Day 13-14: 集成测试**

- 端到端任务流程测试
- 流式支付验证
- Gas 优化

---

### Week 3: 隐私与优化

**Day 15-17: Confidential Transactions**

```typescript
// 等待 Tempo confidential tx 上线后集成
async confidentialSettle(
  taskId: string,
  winner: string,
  encryptedAmount: EncryptedValue
): Promise<ConfidentialSettlement> {
  // 使用 Tempo 的隐私交易功能
  // 类似 Solana Confidential Transfers
}
```

**Day 18-19: 性能优化**

- 批量操作支持
- 连接池管理
- 缓存策略

**Day 20-21: 文档与示例**

- SDK 文档
- 代码示例
- Demo 视频

---

### Week 4: 测试网验证与主网准备

**Day 22-24: Testnet 大规模测试**

- 100+ 任务创建
- 50+ Agents 参与
- 流式支付稳定性测试

**Day 25-26: 安全审计**

- 合约审计
- SDK 安全 review
- 漏洞赏金计划

**Day 27-28: 主网部署**

- 部署到 Tempo mainnet
- 监控设置
- 应急响应计划

---

## 5. 代码示例

### 5.1 完整任务流程

```typescript
import { GradienceHub } from '@gradiences/chain-hub';

async function fullTaskWithTempo() {
    // 初始化 Hub
    const hub = new GradienceHub({
        solana: {
            /* ... */
        },
        tempo: {
            /* ... */
        },
    });

    // 1. Poster 创建任务（选择 Tempo 流式支付）
    const task = await hub.createTaskWithOptions(
        {
            title: 'AI Trading Strategy',
            description: 'Build a profitable trading bot',
            reward: 5000000000, // 5000 USDC
            duration: 7 * 24 * 60 * 60, // 7天
            minReputation: 80,
        },
        {
            chain: 'tempo',
            streaming: true, // 启用流式支付
        },
    );

    console.log('Task created:', task.id);
    console.log('Settlement chain: Tempo');

    // 2. Agents 在 Solana 竞标
    const bid = await hub.solana.bidOnTask(task.id, {
        agentId: 'agent-123',
        proposal: 'I will build...',
    });

    // 3. Judge 在 Solana 评分
    const judgment = await hub.solana.judgeTask(task.id, {
        winner: 'agent-123',
        score: 95,
        feedback: 'Excellent strategy',
    });

    // 4. 智能结算（自动路由到 Tempo）
    const settlement = await hub.settleTaskSmart(task.id);

    console.log('Settlement initiated on Tempo');
    console.log('Session ID:', settlement.sessionId);

    // 5. Agent 接收流式支付
    // 资金自动流入 Agent 的 Tempo 钱包
    // Agent 可以实时使用资金

    // 6. Agent 自主支出（使用 session 资金）
    const payment = await hub.tempo!.agentAutonomousPay(settlement.sessionId, {
        to: '0xToolProvider...',
        amount: 100000000n, // 100 USDC
        reason: 'Purchase backtesting tool',
    });

    console.log('Agent autonomous payment:', payment.txHash);
    console.log('Remaining budget:', payment.remainingBudget);

    // 7. Reputation 更新回 Solana
    await hub.solana.updateReputation('agent-123', {
        taskCompleted: task.id,
        score: 95,
        reward: 5000000000n,
    });
}
```

### 5.2 Agent 自主支出示例

```typescript
// Agent 获得流式资金后可以自主决策

async function agentAutonomousEconomy(hub: GradienceHub, sessionId: string) {
    // 检查可用预算
    const session = await hub.tempo!.getSession(sessionId);
    const available = session.budget - session.spent;

    console.log(`Available budget: ${available} USDC`);

    // Agent 决策逻辑（简化示例）
    const decisions = [
        { action: 'invest', target: 'another_agent', amount: (available * 20n) / 100n },
        { action: 'tool', target: 'data_provider', amount: (available * 30n) / 100n },
        { action: 'save', target: 'reserve', amount: (available * 50n) / 100n },
    ];

    for (const decision of decisions) {
        if (decision.action === 'invest') {
            // 投资其他 Agent
            await hub.tempo!.agentAutonomousPay(sessionId, {
                to: decision.target,
                amount: decision.amount,
                reason: `Invest in ${decision.target}`,
            });
        } else if (decision.action === 'tool') {
            // 购买工具
            await hub.tempo!.agentAutonomousPay(sessionId, {
                to: decision.target,
                amount: decision.amount,
                reason: 'Purchase data subscription',
            });
        }
        // 'save' 不支出，保留在 session 中
    }
}
```

---

## 6. 风险与缓解

| 风险             | 概率 | 影响 | 缓解措施                   |
| ---------------- | ---- | ---- | -------------------------- |
| Tempo 主网不稳定 | 低   | 高   | 保持 Solana 作为主要结算链 |
| MPP 合约漏洞     | 低   | 高   | 安全审计，保险基金         |
| 跨链桥延迟       | 中   | 中   | 乐观更新，最终一致性       |
| Gas 波动         | 低   | 中   | 稳定币 gas，可预测         |
| 用户学习成本     | 中   | 中   | SDK 抽象，一键切换         |

---

## 7. 成功指标

| 指标             | 目标   | 时间   |
| ---------------- | ------ | ------ |
| Tempo 集成任务数 | 100+   | Week 4 |
| 流式支付成功率   | >99%   | Week 4 |
| 平均结算时间     | <1s    | Week 4 |
| Agent 自主支出数 | 50+    | Week 6 |
| 用户满意度       | >4.5/5 | Week 8 |

---

## 8. 下一步行动

| 优先级 | 行动                    | 时间    | 状态 |
| ------ | ----------------------- | ------- | ---- |
| P0     | 申请 Tempo testnet 访问 | 今天    | ⏳   |
| P0     | 设置开发环境            | 本周    | ⏳   |
| P1     | 部署 MPP 适配合约       | Week 1  | ⏳   |
| P1     | 实现 TempoProvider      | Week 2  | ⏳   |
| P2     | 跨链桥接测试            | Week 2  | ⏳   |
| P2     | Testnet 大规模测试      | Week 4  | ⏳   |
| P3     | 主网部署                | Week 4+ | ⏳   |

---

**核心原则**: Solana 稳如泰山，Tempo 锦上添花。不迁移核心，只扩展能力。

_最后更新: 2026-04-03_  
_状态: 待启动_
