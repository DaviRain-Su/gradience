# Gradience 本地测试指南

> **状态**: ✅ 测试环境已就绪  
> **AgentM**: http://localhost:5199  
> **日期**: 2026-04-03

---

## 当前状态

### ✅ 已就绪

| 组件 | 状态 | 访问地址 |
|------|------|----------|
| **AgentM 桌面** | ✅ 运行中 | http://localhost:5199 |
| **ChainHub 合约** | ✅ 已构建 | 待部署到 devnet |
| **Solana CLI** | ✅ 已配置 | devnet |
| **A2A 多协议** | ✅ 83 测试通过 | 本地测试可用 |

### ⚠️ 需要完成

1. **合约部署到 Devnet** - ChainHub 合约需要实际部署
2. **Indexer 服务** - Agent 发现需要 indexer
3. **本地 Agent 连接** - 需要配置测试 agent

---

## 立即可以测试的内容

### 1. AgentM 桌面应用界面 ✅

**打开浏览器访问**: http://localhost:5199

**可测试功能**:
- 界面布局和导航
- 钱包连接 (Privy)
- 设置页面
- 主题切换

### 2. A2A 协议单元测试 ✅

```bash
cd apps/agentm
pnpm test
```

**测试结果**:
- 83 个单元测试
- 覆盖 Nostr/libp2p/MagicBlock/WebRTC
- 跨链桥适配器测试

### 3. 本地聊天 (MagicBlock in-memory) ✅

MagicBlock 适配器支持内存模式，无需真实链:

```typescript
// 在浏览器控制台测试
const magicblock = new MagicBlockAdapter({
  agentId: 'test-agent-1',
  endpoint: 'memory', // 内存模式
});
await magicblock.initialize();
```

---

## 需要配置后才能测试

### 1. Solana Devnet 合约部署

当前 ChainHub 合约已构建但未部署到 devnet:

```bash
# 切换到 devnet
solana config set --url https://api.devnet.solana.com

# 请求空投
solana airdrop 2

# 部署合约 (需要 Anchor 或直接使用 solana program deploy)
cd apps/chain-hub
solana program deploy target/deploy/chain_hub.so
```

### 2. Indexer 服务

Agent 发现功能依赖 indexer 服务:

```bash
# 当前 indexer 未运行
# 需要启动 indexer 服务才能看到其他 agent
```

### 3. 本地 Agent 节点

要测试 agent 间通信，需要启动多个 agent:

```bash
# 启动第一个 agent
# 启动第二个 agent
# 测试它们之间的通信
```

---

## 测试范围说明

### 目前可以测试 ✅

1. **前端界面** - 所有 UI 组件
2. **本地状态** - 存储、缓存
3. **A2A 协议逻辑** - 单元测试
4. **钱包连接** - Privy 集成
5. **跨链消息格式** - 消息编码/解码

### 需要合约部署后测试 ⚠️

1. **链上声誉** - 需要部署的合约
2. **任务市场** - 需要 indexer + 合约
3. **Agent 发现** - 需要 indexer 服务
4. **跨链消息传递** - 需要真实的桥合约

---

## 推荐的测试流程

### 阶段 1: 界面测试 (现在可以)

```bash
# 1. 确保 AgentM 在运行
curl http://localhost:5199

# 2. 打开浏览器访问
open http://localhost:5199

# 3. 测试功能
# - 导航菜单
# - 钱包连接
# - 设置页面
```

### 阶段 2: 单元测试 (现在可以)

```bash
cd apps/agentm
pnpm test              # 所有测试
pnpm test:a2a          # A2A 协议测试
```

### 阶段 3: 合约部署 (需要执行)

```bash
# 1. 配置 Solana devnet
solana config set --url https://api.devnet.solana.com

# 2. 获取 SOL
solana airdrop 2

# 3. 部署 ChainHub 合约
cd apps/chain-hub
solana program deploy target/deploy/chain_hub.so

# 4. 记录 program ID
# 更新配置中的 program ID
```

### 阶段 4: 集成测试 (部署后)

```bash
# 1. 启动 indexer 服务
# 2. 注册测试 agent
# 3. 测试 agent 发现
# 4. 测试消息传递
```

---

## 关键问题解答

### Q: 合约都部署到 Devnet 了吗？

**A**: 还没有。ChainHub 合约已构建但未部署。需要执行部署步骤。

### Q: 我们测试 Solana 上的所有内容吗？

**A**: 是的，主要测试 Solana 生态:
- ChainHub 合约 (Solana)
- Agent 身份 (Solana)
- 声誉系统 (Solana)
- 跨链桥 (Solana ↔ 其他链)

### Q: 可以连接本地 Agent 吗？

**A**: 目前需要:
1. 部署合约到 devnet
2. 启动 indexer 服务
3. 然后可以连接本地测试 agent

---

## 下一步行动

### 选项 A: 继续界面测试 (推荐立即)

```bash
# 已经在运行，直接访问
open http://localhost:5199
```

### 选项 B: 部署合约到 Devnet

```bash
# 1. 配置 devnet
solana config set --url https://api.devnet.solana.com

# 2. 获取 SOL
solana airdrop 2

# 3. 部署
cd apps/chain-hub
solana program deploy target/deploy/chain_hub.so
```

### 选项 C: 运行完整测试套件

```bash
cd apps/agentm
pnpm test
```

---

## 状态总结

| 功能 | 本地测试 | Devnet 测试 | 生产环境 |
|------|----------|-------------|----------|
| AgentM 界面 | ✅ 可用 | N/A | N/A |
| A2A 协议 | ✅ 单元测试 | ⚠️ 需部署 | ❌ |
| ChainHub 合约 | ⚠️ 模拟 | ⚠️ 需部署 | ❌ |
| Agent 发现 | ⚠️ 需 indexer | ⚠️ 需部署 | ❌ |
| 跨链桥 | ✅ 单元测试 | ⚠️ 需配置 | ❌ |

---

**建议**: 现在可以开始界面测试和单元测试。合约部署到 devnet 后可以测试完整功能。

需要我协助执行哪个步骤？
