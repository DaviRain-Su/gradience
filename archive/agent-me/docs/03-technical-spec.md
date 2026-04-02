# Phase 3: Technical Spec — agent-me

> **范围**: `apps/agent-me/` — 用户侧个人 AI Agent 入口
> **定位**: 用户进入 Gradience 生态的第一触点，管理钱包身份、查看链上声誉与任务历史

---

## 1. 模块职责

Agent Me 是**面向普通用户的个人 Agent 门户**：

- 钱包 Profile 管理（OpenWallet + 本地 Keypair）
- 链上声誉展示（PDA + Indexer 双数据源）
- 任务历史查看（已发布 / 已提交）
- （规划中）语音交互 STT/TTS Pipeline
- （规划中）持久记忆系统

**不做**（MVP 范围内）：
- 发布或申请任务（跳转到 Agent Arena 前端）
- 链上写操作（只读展示）
- 语音处理（Phase 2 规划）

---

## 2. 技术栈

| 项目 | 版本 | 说明 |
|------|------|------|
| Next.js | 16.2.1 | React 服务端框架 |
| React | 19.2.4 | UI |
| `@solana/kit` | 5.5.1 | 地址解析、Keypair 工具 |
| `@gradience/sdk` | workspace | GradienceSDK（查询声誉、任务） |
| Node.js test runner | 内置 | 测试（无第三方框架） |

---

## 3. 文件结构与职责

```
agent-me/
├── frontend/src/
│   ├── app/
│   │   ├── page.tsx          — MVP 主页：WalletManager + ReputationPanel + TaskHistory
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── wallet-manager.tsx    — 钱包 Profile 管理（OpenWallet / 本地 Keypair）（194 行）
│   │   ├── reputation-panel.tsx  — 链上声誉展示（avgScore / winRate / byCategory）（106 行）
│   │   └── task-history.tsx      — 任务历史（已发布 50 条 / 已提交 40 条）（176 行）
│   └── lib/
│       ├── sdk.ts               — createSdk() 工厂函数
│       ├── wallet-utils.ts      — parseKeypairAddress() / createProfile()（43 行）
│       ├── wallet-storage.ts    — LocalStorage Profile CRUD
│       └── wallet-utils.test.ts — 3 个单元测试
└── docs/
    ├── 03-technical-spec.md（本文）
    └── 05-test-spec.md
```

---

## 4. 核心数据类型

### WalletProfile

```typescript
interface WalletProfile {
  id: string          // `${type}-${timestamp}-${random}`
  type: 'openwallet' | 'local_keypair'
  label: string       // 用户自定义名称，默认 "OpenWallet" / "Local keypair"
  address: string     // Solana base58 公钥
  createdAt: number   // Unix timestamp ms
}
```

### ReputationOnChain（来自 GradienceSDK）

```typescript
interface ReputationOnChain {
  avgScore: number        // 平均得分（0–100）
  winRate: number         // 胜率（BPS，除以 100 得百分比）
  completed: number       // 完成任务数
  byCategory: CategoryStat[]
}
```

---

## 5. 组件规范

### WalletManager

- 支持两种 Profile 类型：
  - `openwallet`：仅输入地址字符串（无私钥）
  - `local_keypair`：输入 64 字节 JSON 数组，解析后存 address
- Profile 列表持久化到 `localStorage`（key: `gradience_profiles`）
- 活跃 Profile ID 持久化（key: `gradience_active_profile`）
- 切换活跃 Profile → 触发 `onActiveAddressChange(address)` 回调

### ReputationPanel

- 接收 `walletAddress: string | null`
- 通过 `GradienceSDK.getReputation(address)` 查询链上 PDA
- 展示：avgScore、winRate、completed、totalEarned、byCategory 表格
- 手动刷新按钮 + loading / error 状态

### TaskHistory

- 接收 `walletAddress: string | null`
- 查询已发布任务：`sdk.getTasks({ poster: address, limit: 50 })`
- 查询已提交任务：`sdk.getTasks({ limit: 40 })` 过滤用户提交
- 双列展示：已发布 | 已提交
- 展示：taskId、state、reward、deadline（格式化时间戳）

---

## 6. Keypair 解析规则

```typescript
parseKeypairAddress(secretText: string): Promise<Address>
```

- 输入：64 字节整数 JSON 数组字符串
- 验证：`Array.isArray && length === 64 && every(isByte)`
- `isByte(v)`: `typeof v === 'number' && isInteger && 0 <= v <= 255`
- 失败：抛出明确错误（"Invalid keypair: expected 64-byte array"）
- 成功：通过 `@solana/kit.createKeyPairSignerFromBytes` 返回 `Address`

---

## 7. localStorage Schema

```
gradience_profiles       → JSON: WalletProfile[]
gradience_active_profile → string: profile.id
```

---

## 8. 接口契约

### → GradienceSDK（只读）
- `sdk.getReputation(address)` → `ReputationOnChain | null`
- `sdk.getTasks(filter)` → `Task[]`

### → Indexer（间接，通过 SDK）
- SDK 若配置了 `indexerEndpoint`，优先走 Indexer REST API 查询

### → 用户浏览器
- 所有状态存 localStorage（无服务端持久化）
- 无需钱包签名（MVP 只读）
