# OWS Wallet 主从架构设计分析

## 核心问题

> 如何让用户实现自主控制？
> 主钱包 → 派生 Agent Wallet

---

## 1. 当前架构痛点

### 问题 1: 密钥孤岛
```
现状: 每个 Agent 独立生成密钥
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Agent 1 │  │ Agent 2 │  │ Agent 3 │
│  Key A  │  │  Key B  │  │  Key C  │
└─────────┘  └─────────┘  └─────────┘
     ↑           ↑           ↑
   无关联      无关联       无关联
```
**问题**: 用户无法统一管理，Agent 跑路/被盗无法 revoke

### 问题 2: 用户无感知
- Agent 自己生成密钥，用户不知道
- 无法追溯哪些 Agent 在用哪个密钥
- 无法一键停用所有 Agent

---

## 2. 目标架构: 主从钱包体系

```
┌─────────────────────────────────────────┐
│          用户主钱包 (OWS Wallet)          │
│         完全控制，自主管理               │
│    ┌─────────────────────────────┐      │
│    │  Master Key (BIP39 助记词)   │      │
│    │  m/44'/60'/0'/0/0          │      │
│    └─────────────────────────────┘      │
└─────────────────┬───────────────────────┘
                  │ HD 派生 (BIP44)
      ┌───────────┼───────────┐
      ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Agent 1  │ │ Agent 2  │ │ Agent 3  │
│ 子钱包    │ │ 子钱包    │ │ 子钱包    │
├──────────┤ ├──────────┤ ├──────────┤
│Path: 0/1 │ │Path: 0/2 │ │Path: 0/3 │
│Role: A   │ │Role: B   │ │Role: C   │
└──────────┘ └──────────┘ └──────────┘
```

### 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 派生标准 | BIP44 | 行业标准，多链兼容 |
| 路径格式 | m/44'/chain'/0'/agent/index | 支持多链 + 多 Agent |
| 权限控制 | 主钱包签名授权 | 用户完全控制 |
| 恢复机制 | 助记词恢复所有子钱包 | 单点恢复 |

---

## 3. 详细流程设计

### 3.1 Agent 注册流程

```
┌────────┐         ┌────────────┐         ┌──────────┐
│  User  │         │ OWS Wallet │         │  Agent   │
└───┬────┘         └──────┬─────┘         └────┬─────┘
    │                      │                    │
    │  1. 创建 Agent       │                    │
    │ ───────────────────> │                    │
    │                      │  2. 生成子密钥      │
    │                      │  m/44'/60'/0'/0/N  │
    │                      │                    │
    │  3. 授权确认          │  4. 授权签名        │
    │  "确认创建 Agent?"    │  (用户主密钥签名)   │
    │ <─────────────────── │                    │
    │                      │  5. 派发子钱包凭证  │
    │                      │ ─────────────────> │
    │                      │                    │
    │  6. 开始运行          │                    │
    │                      │                    │
```

### 3.2 权限层级

```typescript
// 权限配置
interface AgentPermissions {
  // 资金限额
  spendingLimit: {
    daily: bigint;      // 每日限额
    perTransaction: bigint; // 单笔限额
  };
  
  // 功能白名单
  allowedFunctions: string[]; // ['transfer', 'swap', 'stake']
  
  // 时间限制
  timeWindow?: {
    start: number;  // Unix timestamp
    end: number;    // Unix timestamp
  };
  
  // 紧急停用
  canBeRevoked: boolean;
  revokedAt?: number;
}
```

---

## 4. OWS Wallet 集成方案

### 4.1 OWS Wallet 特性
- **Agent-First Design**: 专为 AI Agent 设计
- **权限粒度**: 可精确控制每个 Agent 的权限
- **多链支持**: 原生支持 Solana + EVM
- **安全模型**: 硬件签名 + 云端备份

### 4.2 集成架构

```
┌──────────────────────────────────────────┐
│            OWS Wallet (云端/硬件)        │
│  ┌──────────────────────────────────┐   │
│  │  主密钥 (Secure Enclave/HSM)      │   │
│  │  • 永不离开安全区域               │   │
│  │  • 仅用于签名派生授权             │   │
│  └──────────────────────────────────┘   │
└──────────────────┬───────────────────────┘
                   │ API / SDK
      ┌────────────┼────────────┐
      ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Agent 1  │ │ Agent 2  │ │ Agent 3  │
│ Subkey 1 │ │ Subkey 2 │ │ Subkey 3 │
│ (受限)    │ │ (受限)    │ │ (受限)    │
└──────────┘ └──────────┘ └──────────┘
```

### 4.3 用户控制界面

```typescript
// OWS Wallet Dashboard API
interface OWSWalletAPI {
  // 查看所有 Agent
  listAgents(): Promise<AgentInfo[]>;
  
  // 创建新 Agent 钱包
  createAgentWallet(
    agentName: string,
    permissions: AgentPermissions
  ): Promise<AgentWallet>;
  
  // 修改权限
  updatePermissions(
    agentId: string,
    newPermissions: AgentPermissions
  ): Promise<void>;
  
  // 紧急停用
  revokeAgent(agentId: string): Promise<void>;
  
  // 查看交易历史
  getTransactionHistory(agentId?: string): Promise<TxRecord[]>;
}
```

---

## 5. 自主控制实现

### 5.1 用户自主控制清单

| 控制能力 | 实现方式 | 技术保障 |
|----------|----------|----------|
| 🔑 **密钥所有权** | 主钱包持有 BIP39 | 助记词永不离开用户设备 |
| 👁️ **透明可视** | Dashboard 查看所有 Agent | 实时同步链上状态 |
| ✋ **随时停用** | 链上 revoke 合约 | 智能合约权限控制 |
| 💰 **限额控制** | 每日/单笔限额 | 合约级别 enforce |
| 📜 **审计追溯** | 完整交易日志 | 链上不可篡改 |
| 🔄 **一键恢复** | 助记词恢复所有子钱包 | HD 钱包派生 |

### 5.2 Revoke 机制（紧急停用）

```solidity
// AgentRegistry 合约
contract AgentRegistry {
    mapping(address => AgentInfo) public agents;
    mapping(bytes32 => bool) public revoked;
    
    modifier onlyMaster(bytes32 agentId) {
        require(
            msg.sender == agents[agentId].master,
            "Not master"
        );
        _;
    }
    
    function revokeAgent(bytes32 agentId) external onlyMaster(agentId) {
        revoked[agentId] = true;
        agents[agentId].revokedAt = block.timestamp;
        
        emit AgentRevoked(agentId, msg.sender);
    }
    
    function isValidAgent(bytes32 agentId) external view returns (bool) {
        return !revoked[agentId] && 
               agents[agentId].expiry > block.timestamp;
    }
}
```

---

## 6. 对比分析

### 当前 vs OWS 主从架构

| 维度 | 当前孤岛架构 | OWS 主从架构 |
|------|-------------|-------------|
| **密钥归属** | Agent 持有 | 用户主钱包派生 |
| **用户控制** | ❌ 弱 | ✅ 完全控制 |
| **统一管理** | ❌ 无法管理 | ✅ Dashboard 管理 |
| **紧急停用** | ❌ 无法停用 | ✅ 一键 revoke |
| **权限粒度** | ❌ 无权限控制 | ✅ 细粒度权限 |
| **恢复能力** | ❌ 丢失无法恢复 | ✅ 助记词恢复 |
| **审计追溯** | ❌ 难追溯 | ✅ 链上透明 |

---

## 7. 实施建议

### Phase 1: 基础集成
1. 集成 OWS Wallet SDK
2. 实现 HD 派生逻辑 (BIP44)
3. Agent 注册合约

### Phase 2: 权限控制
1. 权限配置系统
2. 限额控制合约
3. Revoke 机制

### Phase 3: 用户体验
1. Dashboard 界面
2. 实时通知 (Agent 交易提醒)
3. 一键管理功能

---

## 8. 关键问题讨论

### Q1: 主钱包必须是 OWS 吗？
**方案 A**: 强制 OWS（生态绑定）
- Pros: 最佳体验，深度集成
- Cons: 用户门槛，需要安装

**方案 B**: 支持任意钱包 + OWS 增强
- Pros: 开放，用户友好
- Cons: 体验不一致

**我的建议**: 方案 B，OWS 作为推荐选项

### Q2: Agent 子钱包存在哪里？
**方案 A**: 用户本地（用户保管）
- Pros: 最高安全
- Cons: 用户体验差

**方案 B**: Agent 本地（当前方式）
- Pros: 简单
- Cons: 用户无法控制

**方案 C**: OWS 云端托管（推荐）
- Pros: 用户通过 OWS 控制，Agent 通过 API 使用
- Cons: 需要信任 OWS 安全

---

## 结论

**OWS Wallet 主从架构是更优方案**:
1. ✅ 用户真正拥有控制权
2. ✅ 可管理、可停用、可审计
3. ✅ 符合钱包安全最佳实践

**下一步**:
1. 🔍 深入调研 OWS Wallet SDK API
2. 🔧 设计 HD 派生具体实现
3. 📋 编写智能合约（AgentRegistry）

---

**你的看法？**
- 主从架构是否合理？
- 选择方案 A/B/C？
- 还有其他顾虑吗？
