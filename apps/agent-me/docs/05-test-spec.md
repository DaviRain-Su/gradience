# Phase 5: Test Spec — agent-me

---

## 1. 当前测试文件

| 文件 | 测试数 | 测试内容 | 状态 |
|------|--------|---------|------|
| `wallet-utils.test.ts` | 3 | isByte / createProfile / parseKeypairAddress | ✅ |

---

## 2. 运行方式

```bash
cd apps/agent-me/frontend
tsx --test src/lib/wallet-utils.test.ts
```

---

## 3. 覆盖要求

### 已覆盖（✅）

| 场景 | 测试 |
|------|------|
| `isByte` 边界值（0 / 255 / 256 / -1 / 1.5） | wallet-utils.test.ts |
| `createProfile` 生成唯一 ID 和默认 label | wallet-utils.test.ts |
| `parseKeypairAddress` 拒绝格式错误的输入 | wallet-utils.test.ts |

### 缺失（P0）

| 场景 | 说明 |
|------|------|
| `parseKeypairAddress` 有效 64 字节 → 返回正确地址 | 核心 happy path |
| `parseKeypairAddress` 长度非 64 → 报错 | 边界 |
| `wallet-storage` load/save 循环（localStorage mock） | 持久化正确性 |
| 切换活跃 Profile → `onActiveAddressChange` 触发 | 组件回调 |

### 缺失（P1）

| 场景 | 说明 |
|------|------|
| ReputationPanel：声誉为 null 时展示空状态 | UI 边界 |
| TaskHistory：任务列表为空时展示提示 | UI 边界 |
| WalletManager：重复添加同一地址 | 幂等性 |
| localStorage 不可用时的降级行为 | 容错性 |

---

## 4. 测试策略

- **Node.js 内置 test runner**（无额外依赖）
- **localStorage mock**：在 Node 环境需手动 mock `globalThis.localStorage`
- **链上查询**：组件测试通过 mock SDK，不实际请求 RPC
- **React 组件**：MVP 阶段暂不做 DOM 测试（P2）
