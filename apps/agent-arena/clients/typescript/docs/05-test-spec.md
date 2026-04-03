# Phase 5: Test Spec — agent-arena/clients/typescript (GradienceSDK)

---

## 1. 当前测试文件

| 文件                      | 代码量 | 测试内容                              | 状态 |
| ------------------------- | ------ | ------------------------------------- | ---- |
| `sdk.test.ts`             | 336 行 | GradienceSDK 方法测试                 | ✅   |
| `wallet-adapters.test.ts` | 74 行  | KeypairAdapter / BrowserWalletAdapter | ✅   |

---

## 2. 运行方式

```bash
cd apps/agent-arena
bun test clients/typescript/src/sdk.test.ts
bun test clients/typescript/src/wallet-adapters.test.ts
```

---

## 3. 覆盖要求

### 必须覆盖（P0）

| 场景                                      | 说明       |
| ----------------------------------------- | ---------- |
| postTask → 返回 tx signature              | 核心写操作 |
| applyForTask / submitResult / judgeAndPay | 任务流程   |
| getTask：存在 / 不存在                    | 查询正确性 |
| KeypairAdapter.signAndSendTransaction     | 签名路径   |
| 无效 taskId → 明确错误                    | 错误处理   |

### 应覆盖（P1）

| 场景                                   | 说明     |
| -------------------------------------- | -------- |
| RPC 网络超时处理                       | 容错性   |
| Indexer 不可用时回退到 RPC 查询        | 降级逻辑 |
| BrowserWalletAdapter（浏览器环境模拟） | 前端路径 |
| 所有 7 条写指令的 mock 测试            | 完整覆盖 |

---

## 4. 测试策略

- **RPC mock**：通过 `createSolanaRpc` 替换为 mock，不实际发送交易
- **generated/ 代码不测试**：Codama 生成代码假设正确，仅测试 SDK 封装层
- **Bun test runner**：`bun test`，无需额外配置
