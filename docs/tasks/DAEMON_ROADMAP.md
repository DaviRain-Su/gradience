# Agent Daemon Implementation Roadmap

> 从 Stub 到生产可用

## 模块状态总览

| Module          | Path              | Status      | 问题                  |
| --------------- | ----------------- | ----------- | --------------------- |
| **api/routes/** | `src/api/routes/` | ✅ Active   | 基本可用              |
| **auth/**       | `src/auth/`       | ✅ Active   | SessionManager 完整   |
| **a2a-router/** | `src/a2a-router/` | ⚠️ WIP      | Nostr OK, XMTP 待完成 |
| **solana/**     | `src/solana/`     | ✅ Active   | RPC 集成完整          |
| **storage/**    | `src/storage/`    | ✅ Active   | SQLite 完整           |
| **evaluator/**  | `src/evaluator/`  | ❌ Stub     | 全是 Math.random()    |
| **revenue/**    | `src/revenue/`    | ⚠️ Untested | 代码完整，需测试      |
| **bridge/**     | `src/bridge/`     | ❌ Stub     | 签名是假的，密钥空    |
| **payments/**   | `src/payments/`   | ⚠️ Untested | MPP 需测试            |

## 任务列表

### P0 - 阻塞生产

| ID          | 标题                                 | 状态 | 预估   |
| ----------- | ------------------------------------ | ---- | ------ |
| [[GRA-209]] | LLM-as-Judge 真正的评估逻辑          | todo | 12-16h |
| [[GRA-211]] | Settlement Bridge 密钥管理和真正签名 | todo | 6-8h   |

### P1 - 核心功能

| ID          | 标题                            | 状态 | 预估 |
| ----------- | ------------------------------- | ---- | ---- |
| [[GRA-210]] | Revenue Distribution 端到端测试 | todo | 6-8h |
| [[GRA-212]] | A2A Router 完成 XMTP 集成       | todo | 4-6h |
| [[GRA-213]] | MPP Handler 端到端测试          | todo | 6-8h |

## 依赖关系

```
GRA-211 (Bridge 密钥) ←── GRA-210 (Revenue 测试)
                              │
GRA-209 (LLM Judge) ──────────┴──→ 完整评估流程

GRA-212 (XMTP) ←── A2A 完整通信

GRA-213 (MPP 测试) ←── 多方支付验证
```

## 详细问题分析

### 1. Evaluator - 全是 Mock

```typescript
// 当前实现 (judges.ts)
const funcScore = Math.floor(Math.random() * 30) + 70; // 假分数

// 需要
const funcScore = await runActualTests(repo); // 真实测试
const contentScore = await llmClient.evaluate(content); // LLM 评估
```

**修复**: GRA-209

### 2. Bridge - 签名和密钥是假的

```typescript
// 当前
private async signProof(hash: string): Promise<string> {
    return `sig_${hash.slice(0, 32)}`;  // 假签名
}
const evaluatorKeypair = new Uint8Array(64);  // 空密钥

// 需要
const signature = await ed25519.sign(message, keypair.secretKey);
const keypair = await keyManager.loadEncryptedKey('./keys/evaluator.key');
```

**修复**: GRA-211

### 3. A2A Router - XMTP 未完成

```typescript
// 当前
if (this.options.enableXMTP) {
    logger.info('XMTP adapter enabled but requires wallet signer at runtime');
}

// 需要
const xmtpAdapter = new XMTPAdapter({ signer: walletSigner });
await xmtpAdapter.initialize();
this.adapters.set('xmtp', xmtpAdapter);
```

**修复**: GRA-212

### 4. Revenue/MPP - 未测试

代码看起来完整，但没有端到端测试验证：

- CPI 指令 discriminator 是否正确？
- 账户顺序是否匹配 Program？
- 分账逻辑是否正确？

**修复**: GRA-210, GRA-213

## 预估工作量

| 阶段        | 任务数 | 预估       |
| ----------- | ------ | ---------- |
| P0 阻塞项   | 2      | 18-24h     |
| P1 核心功能 | 3      | 16-22h     |
| **总计**    | **5**  | **34-46h** |

## 验收标准

完成所有任务后：

1. ✅ Evaluator 使用 LLM 进行真正评估
2. ✅ Bridge 使用真正的 Ed25519 签名
3. ✅ Revenue 分发通过 devnet 测试
4. ✅ A2A 支持 Nostr + XMTP
5. ✅ MPP 多方支付场景全部通过

## 相关文档

- [[SETTLEMENT_ROADMAP]] - 结算层路线图
- Agent Daemon 架构: `apps/agent-daemon/docs/`
