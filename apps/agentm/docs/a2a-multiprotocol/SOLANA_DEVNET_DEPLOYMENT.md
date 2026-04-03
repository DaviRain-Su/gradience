# Solana Devnet 部署指南

> 跨链桥测试部署 - Ethereum Sepolia → Solana Devnet

---

## 快速开始

### 1. 安装 Solana CLI

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"
solana --version
```

### 2. 设置环境

```bash
cd apps/agentm
./deploy-solana-devnet.sh setup
```

### 3. 获取 Devnet SOL

```bash
./deploy-solana-devnet.sh airdrop
```

### 4. 运行测试

```bash
# 测试所有桥
npx tsx src/main/a2a-router/test-cross-chain.ts all

# 或单独测试
npx tsx src/main/a2a-router/test-cross-chain.ts layerzero
npx tsx src/main/a2a-router/test-cross-chain.ts wormhole
npx tsx src/main/a2a-router/test-cross-chain.ts debridge
```

---

## 网络配置

| 网络 | RPC URL | Chain ID |
|------|---------|----------|
| Ethereum Sepolia | https://rpc.sepolia.org | 11155111 |
| Solana Devnet | https://api.devnet.solana.com | - |

---

## 测试流程

```
1. Setup Environment
   └─> Configure Solana CLI
   └─> Generate keypairs
   └─> Request airdrop

2. Deploy Contracts (模拟)
   └─> ReputationAggregator
   └─> Wormhole Adapter
   └─> LayerZero Adapter

3. Run Cross-Chain Tests
   └─> LayerZero: 2min confirmation
   └─> Wormhole: 15min confirmation
   └─> Debridge: 5min confirmation

4. Verify Results
   └─> Check message delivery
   └─> Verify reputation sync
   └─> Compare bridge performance
```

---

## 环境变量

```bash
# 可选：设置自定义私钥
export SOLANA_PAYER_KEY="your-base58-private-key"
export SOLANA_AGENT_KEY="your-agent-key"
export SOLANA_AUTHORITY_KEY="your-authority-key"

# Debridge API Key (可选)
export DEBRIDGE_API_KEY="your-api-key"
```

---

## 命令参考

```bash
# 查看状态
./deploy-solana-devnet.sh status

# 查看日志
./deploy-solana-devnet.sh logs

# 重新请求空投
./deploy-solana-devnet.sh airdrop

# 运行所有测试
./deploy-solana-devnet.sh test
```

---

## 三桥对比测试

| 测试项 | LayerZero | Wormhole | Debridge |
|--------|-----------|----------|----------|
| 部署时间 | ~2 min | ~15 min | ~5 min |
| Gas 费用 | ~$10 | ~$2 | ~$3 |
| 成功率 | 测试 | 测试 | 测试 |
| 易用性 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

---

## 故障排除

### 问题：Solana CLI 未找到
```bash
# 安装 Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"
```

### 问题：余额不足
```bash
# 请求更多空投
solana airdrop 2
```

### 问题：RPC 连接失败
```bash
# 检查网络连接
solana config get
# 切换到 devnet
solana config set --url https://api.devnet.solana.com
```

---

## 下一步

1. ✅ 完成 devnet 测试
2. 🔄 准备主网部署
3. 🔄 生产监控配置

---

**状态**: 部署准备完成，可以开始测试！
