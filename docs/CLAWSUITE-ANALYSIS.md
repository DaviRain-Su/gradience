# Clawsuite 代码分析 & Gradience 改造方案

## 📊 项目概况

| 属性 | 详情 |
|------|------|
| **技术栈** | Electron + React 19 + Vite + TypeScript |
| **UI 框架** | Tailwind CSS + Base UI |
| **路由** | TanStack Router |
| **状态管理** | Zustand |
| **构建工具** | Vite |
| **后端** | Express-like API (集成在 Vite 中) |

---

## 🏗️ 架构分析

### 1. 进程结构

```
clawsuite/
├── electron/              # Electron 主进程
│   ├── main.ts           # 主入口 (窗口管理、IPC)
│   ├── preload.ts        # 预加载脚本 (安全桥接)
│   └── quick-chat.html   # 快速聊天窗口
├── src/
│   ├── server/           # 后端 API (Node.js)
│   ├── screens/          # 页面组件
│   ├── stores/           # Zustand 状态管理
│   └── types/            # TypeScript 类型
└── src-tauri/            # Tauri 支持 (可选)
```

### 2. 核心模块

| 模块 | 路径 | 功能 |
|------|------|------|
| **Chat** | `src/screens/chat/` | AI 聊天界面 |
| **Dashboard** | `src/screens/dashboard/` | 主控制台 |
| **Agent Hub** | `src/screens/agents/` | Agent 管理 |
| **Mission Control** | `src/screens/` | 任务编排 |
| **File Explorer** | `src/screens/files/` | 文件浏览器 |
| **Terminal** | `src/server/terminal-sessions.ts` | 嵌入式终端 |
| **Cost Analytics** | `src/screens/costs/` | 成本分析 |
| **Settings** | `src/screens/settings/` | 设置 |

### 3. Store 结构

```typescript
// 核心状态
- workspace-store.ts      # 工作区配置
- agent-swarm-store.ts    # Agent 群组
- mission-store.ts        # 任务管理
- task-store.ts           # 任务列表
- chat-activity-store.ts  # 聊天活动
- gateway-chat-store.ts   # Gateway 通信
- terminal-panel-store.ts # 终端面板
```

### 4. 服务端 API

```typescript
// 核心服务
- gateway.ts              # OpenClaw Gateway 通信
- gateway-discovery.ts    # Gateway 发现
- chat-event-bus.ts       # 聊天事件总线
- browser-proxy.ts        # 浏览器代理
- terminal-sessions.ts    # 终端会话
- usage-cost.ts           # 使用成本计算
- provider-usage.ts       # Provider 使用统计
```

---

## 🎯 Gradience 改造方案

### 核心理念

**从 OpenClaw Command Center → Gradience Economic Hub**

保留：桌面端体验、多窗口管理、终端、文件浏览器
改造：Agent 经济系统、链上支付、Workflow 市场

---

## 📋 任务拆解

### Phase 1: 品牌改造 (1 周)

| 任务 | 文件 | 工作量 |
|------|------|--------|
| 替换 Logo 和图标 | `public/`, `assets/` | ⭐ |
| 修改应用名称 | `package.json`, `electron/main.ts` | ⭐ |
| 更新颜色主题 | `src/styles.css`, Tailwind 配置 | ⭐⭐ |
| 修改文档和文案 | `README.md`, `index.html` | ⭐ |

### Phase 2: 后端改造 (2 周)

| 任务 | 文件 | 工作量 |
|------|------|--------|
| 移除 OpenClaw Gateway 依赖 | `src/server/gateway.ts` | ⭐⭐ |
| 添加 Solana 链连接 | 新建 `src/server/solana/` | ⭐⭐⭐ |
| 集成 Wallet Adapter | 新建 `src/server/wallet/` | ⭐⭐⭐ |
| 添加 Chain Hub API 客户端 | 新建 `src/server/chain-hub/` | ⭐⭐⭐ |
| 集成 Workflow Marketplace | 新建 `src/server/marketplace/` | ⭐⭐⭐ |

### Phase 3: 核心功能改造 (3 周)

| 任务 | 说明 | 工作量 |
|------|------|--------|
| **Wallet Panel** | 替换 Costs 页面为 Wallet | ⭐⭐⭐ |
| **Workflow Market** | 新增 Workflow 市场页面 | ⭐⭐⭐ |
| **Task Payment** | 任务创建添加支付流程 | ⭐⭐⭐ |
| **Reputation System** | Agent 声誉显示 | ⭐⭐ |
| **Escrow Management** | 托管管理界面 | ⭐⭐⭐ |

### Phase 4: UI 组件开发 (2 周)

| 组件 | 路径 | 说明 |
|------|------|------|
| WalletCard | `src/components/wallet/` | 钱包卡片 |
| WorkflowCard | `src/components/workflow/` | Workflow 卡片 |
| PaymentModal | `src/components/payment/` | 支付弹窗 |
| ReputationBadge | `src/components/reputation/` | 声誉徽章 |
| EscrowList | `src/components/escrow/` | 托管列表 |

### Phase 5: 集成测试 (1 周)

| 任务 | 说明 |
|------|------|
| 端到端测试 | 完整用户流程测试 |
| 链上交互测试 | Solana 交易测试 |
| 性能优化 | 打包大小、启动速度 |
| 文档更新 | 部署文档、API 文档 |

---

## 🔧 技术实现细节

### 1. Solana 集成

```typescript
// src/server/solana/connection.ts
import { Connection, clusterApiUrl } from '@solana/web3.js';

export const solanaConnection = new Connection(
  clusterApiUrl('devnet'), // 或 mainnet-beta
  'confirmed'
);
```

### 2. Wallet 集成

```typescript
// src/server/wallet/adapter.ts
// 使用 Solana Wallet Adapter
import { useWallet } from '@solana/wallet-adapter-react';
```

### 3. 链上程序调用

```typescript
// src/server/chain-hub/client.ts
// 调用 Gradience 的 Solana 程序
import { Program, AnchorProvider } from '@coral-xyz/anchor';
```

---

## 📁 关键文件映射

| Clawsuite 原功能 | Gradience 改造后 | 修改文件 |
|-----------------|-----------------|---------|
| Costs 页面 | Wallet 页面 | `src/screens/costs/` → `src/screens/wallet/` |
| Agent Hub | Agent Profile | `src/screens/agents/` + Reputation |
| Mission | Task + Payment | `src/screens/` + Escrow |
| Chat | 保留 | `src/screens/chat/` |
| Dashboard | Economic Dashboard | `src/screens/dashboard/` + 链上数据 |
| Settings | + Wallet Settings | `src/screens/settings/` |

---

## ⏱️ 总时间估算

| Phase | 时间 | 关键产出 |
|-------|------|---------|
| Phase 1 | 1 周 | 品牌化版本 |
| Phase 2 | 2 周 | 后端 API 完成 |
| Phase 3 | 3 周 | 核心功能完成 |
| Phase 4 | 2 周 | UI 组件完成 |
| Phase 5 | 1 周 | 可发布版本 |
| **总计** | **9 周** | **Gradience Desktop v1.0** |

---

## 🚀 下一步

1. **Fork & Setup** - Fork clawsuite，设置开发环境
2. **Phase 1 Start** - 开始品牌改造
3. **API 设计** - 设计 Solana 集成 API 接口
4. **组件开发** - 并行开发 Wallet、Workflow 组件
