# OWS 集成迁移计划

## 🎯 目标

把 OWS (OpenWallet Standard) 集成从 `apps/hackathon-ows` 迁移到主项目 `apps/agentm` 或 `apps/agentm-pro`。

**原则**: 不是做 Demo，而是做真实功能。

---

## 📋 当前状态

### 已有代码 (hackathon-ows)

```
apps/hackathon-ows/
├── src/cli/commands/      # CLI 命令
│   ├── agent.ts          # Agent 注册
│   ├── reputation.ts     # 声誉系统
│   └── wallet.ts         # 钱包管理
├── src/core/             # 业务逻辑
│   ├── agent.ts
│   ├── reputation.ts
│   └── wallet.ts
└── src/ows/              # OWS 集成
    └── wallet.ts
```

### 目标项目结构

```
apps/agentm/ (或 agentm-pro/)
├── src/
│   ├── identity/         # 新增: OWS 身份模块
│   │   ├── agent.ts
│   │   ├── reputation.ts
│   │   └── wallet.ts
│   ├── commands/         # 现有 CLI 命令
│   │   └── ...
│   └── ...
└── package.json
```

---

## 🚀 迁移步骤

### 步骤 1: 复制核心模块

把 `hackathon-ows/src/core/` 和 `hackathon-ows/src/ows/` 复制到主项目的 `src/identity/` 目录。

### 步骤 2: 集成到现有 CLI

在主项目的 CLI 中添加新命令：

```typescript
// apps/agentm/src/cli/index.ts
import { registerAgentCommands } from './commands/agent';
import { registerReputationCommands } from './commands/reputation';
import { registerWalletCommands } from './commands/wallet';

program.command('agent').description('Agent identity management');
// ...

program.command('reputation').description('Reputation system');
// ...
```

### 步骤 3: 与现有系统集成

**与 Settings 集成**:

```typescript
// 用户设置中添加 OWS 配置
interface UserSettings {
    // ... 现有配置
    ows: {
        enabled: boolean;
        defaultAgent?: string;
        reputationThreshold: number;
    };
}
```

**与 Wallet 集成**:

```typescript
// 使用 OWS 钱包作为默认钱包
class WalletManager {
    async getDefaultWallet() {
        if (settings.ows.enabled) {
            return await owsWallet.getWallet();
        }
        return await legacyWallet.getWallet();
    }
}
```

### 步骤 4: 添加到主界面

在 AgentM 的 UI 中添加身份管理页面：

```
AgentM UI
├── Chat
├── Agents
├── Settings
├── Tools
└── Identity (新增)       ← OWS 身份管理
    ├── My Agents
    ├── Reputation
    └── Sub-wallets
```

---

## 📦 提交内容

### 黑客松提交

提交 `apps/agentm` 项目，包含：

1. **OWS 身份系统**
    - Agent ENS 注册 (`agent-name.ows.eth`)
    - 多链钱包 (ETH, SOL, BTC)

2. **声誉系统**
    - 任务完成评分
    - 声誉分数 (0-100)
    - 等级系统 (Bronze/Silver/Gold/Platinum)

3. **策略引擎**
    - 基于声誉的钱包限额
    - 子钱包继承策略
    - 权限控制

4. **CLI 工具**
    - `agentm agent register`
    - `agentm reputation check`
    - `agentm wallet create-sub`

### 演示流程

```bash
# 1. 注册 Agent
agentm agent register --name "trading-agent"

# 2. 在 AgentM 中使用这个 Agent 执行任务
agentm chat --agent trading-agent.ows.eth "分析市场趋势"

# 3. 任务完成后声誉提升
agentm reputation check trading-agent.ows.eth

# 4. 创建子钱包用于特定任务
agentm wallet create-sub --parent trading-agent --name "defi-trading"
```

---

## ✅ 迁移清单

### 立即做

- [ ] 复制核心模块到主项目
- [ ] 添加 CLI 命令
- [ ] 测试基本功能

### 黑客松前

- [ ] 集成到 UI
- [ ] 添加演示数据
- [ ] 准备 Pitch

### 可选 (赛后)

- [ ] 真实 ENS 集成
- [ ] 智能合约部署
- [ ] 链上声誉存储

---

## 🎁 优势

1. **不是 Demo**: 提交的是真实产品
2. **功能完整**: 身份 + 聊天 + 工具
3. **易于维护**: 一个代码库
4. **未来可用**: 赛后继续开发

---

**现在开始迁移？** 🔥
