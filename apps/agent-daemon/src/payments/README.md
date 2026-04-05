# Payments Module

Agent Daemon 的支付模块，支持 MPP（多方支付）和 X402 支付协议，并提供 Solana 链上集成功能。

## 功能特性

### MPP (Multi-Party Payment) - 多方支付
- 创建多方支付协议
- 链上托管账户（Escrow）
- 支持多个参与者和法官
- 基于条件的资金释放（全体一致、多数决、阈值、里程碑、时间）
- 链上资金释放和退款

### X402 Payment Protocol
- x402 支付协议支持
- HTTP 402 支付要求生成
- 支付授权创建和处理
- 链上交易确认

### Direct Transfer
- 简单的 SOL 转账
- 支持 SPL Token 转账（计划中）

## 架构

```
payments/
├── index.ts              # 统一支付管理器 (PaymentManager)
├── mpp-handler.ts        # MPP 处理器（向后兼容）
├── x402-handler.ts       # X402 处理器
├── mpp/
│   ├── index.ts          # MPP 模块导出
│   ├── types.ts          # 类型定义
│   ├── payment-manager.ts # 支付管理
│   ├── voting.ts         # 投票管理
│   └── refund.ts         # 退款和释放
└── payments.integration.test.ts  # 集成测试
```

## 配置

在 `config.ts` 中配置支付选项：

```typescript
{
  paymentsMppEnabled: true,      // 启用 MPP
  paymentsX402Enabled: true,     // 启用 X402
  paymentsTimeoutMs: 300000,     // 支付超时（5分钟）
  paymentsAutoConfirm: true,     // 自动确认交易
}
```

或通过环境变量：

```bash
AGENTD_PAYMENTS_MPP_ENABLED=true
AGENTD_PAYMENTS_X402_ENABLED=true
AGENTD_PAYMENTS_TIMEOUT_MS=300000
AGENTD_PAYMENTS_AUTO_CONFIRM=true
```

## 使用示例

### 创建 MPP 支付

```typescript
const payment = await paymentManager.createMPPPayment({
  taskId: 'task-123',
  totalAmount: BigInt(1000000), // 0.001 SOL
  token: 'So11111111111111111111111111111111111111112',
  tokenSymbol: 'SOL',
  decimals: 9,
  participants: [
    { address: '...', shareBps: 7000, role: 'agent' },
    { address: '...', shareBps: 3000, role: 'contributor' },
  ],
  judges: [{ address: '...', weight: 1 }],
  releaseConditions: { type: 'majority', requiredJudges: 1 },
});
```

### 创建 X402 支付要求

```typescript
const requirements = paymentManager.createX402Requirements({
  amount: '100000',
  token: 'So11111111111111111111111111111111111111112',
  description: 'Service payment',
});
```

### 直接转账

```typescript
const result = await paymentManager.executeTransfer({
  to: 'recipient-address',
  amount: BigInt(1000000),
});
```

## 链上集成

PaymentManager 使用以下组件实现链上集成：

1. **KeyManager**: 管理钱包密钥，用于签名交易
2. **TransactionManager**: 与 agent-arena 程序交互
3. **Solana Connection**: 通过 RPC 与 Solana 网络通信

## 测试

运行集成测试：

```bash
cd apps/agent-daemon
pnpm test src/payments/payments.integration.test.ts
```

## 环境要求

- Solana RPC 端点（默认：devnet）
- 有效的钱包密钥对
- 足够支付交易费用的 SOL

## 注意事项

1. SPL Token 转账尚未完全实现
2. MPP 程序集成需要部署对应的 Solana 程序
3. 测试网（devnet）可能需要 airdrop 获取测试 SOL
