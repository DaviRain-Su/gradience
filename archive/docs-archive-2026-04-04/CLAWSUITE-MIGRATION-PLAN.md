# Gradience × Clawsuite 迁移计划

> **目标**: 将 Clawsuite (OpenClaw Desktop) 改造为 Gradience Hub (去中心化 Agent 经济网络桌面端)

---

## 📊 现状分析

### Clawsuite 技术栈
```
Electron + React 19 + Vite + TypeScript
├── UI: Tailwind CSS + Base UI + HugeIcons
├── 路由: TanStack Router
├── 状态: Zustand
├── 后端: Express-like API (集成在 Vite 中)
└── 构建: Electron Builder
```

### 核心功能模块
| 模块 | 说明 | 保留/改造 |
|------|------|----------|
| Chat | AI 聊天界面 | ✅ 保留 |
| Dashboard | 主控制台 | 🔄 改造为 Economic Dashboard |
| Agent Hub | Agent 管理 | 🔄 添加 Reputation |
| Mission Control | 任务编排 | 🔄 添加 Payment |
| File Explorer | 文件浏览器 | ✅ 保留 |
| Terminal | 嵌入式终端 | ✅ 保留 |
| Costs | 成本分析 | 🔄 改为 Wallet |
| Settings | 设置 | ✅ 保留 |

---

## 🎯 迁移策略

### 核心转变

```
OpenClaw Command Center
    ↓
Gradience Economic Hub
```

- **执行层**: OpenClaw Gateway → 保持兼容或逐步迁移
- **经济层**: 新增 Gradience Solana 集成
- **数据层**: 本地存储 → 链上 + Indexer

---

## 📋 五阶段计划

### Phase 1: 品牌改造 (1 周)
**任务**: GRA-125

| 工作项 | 文件 |
|--------|------|
| Logo/图标替换 | `public/`, `assets/` |
| 应用名称修改 | `package.json`, `electron/main.ts` |
| 主题色更新 | `src/styles.css`, Tailwind 配置 |
| 文案替换 | `README.md`, 各页面 |

**产出**: 品牌化版本，界面显示 Gradience Hub

---

### Phase 2: 后端改造 (2 周)
**任务**: GRA-126

| 工作项 | 新建/修改 |
|--------|----------|
| 移除 Gateway 依赖 | 修改 `src/server/gateway.ts` |
| Solana 连接 | 新建 `src/server/solana/` |
| Wallet Adapter | 新建 `src/server/wallet/` |
| Chain Hub 客户端 | 新建 `src/server/chain-hub/` |
| Marketplace 集成 | 新建 `src/server/marketplace/` |

**产出**: 后端可连接 Solana，支持钱包和链上程序调用

---

### Phase 3: 核心功能 (3 周)
**任务**: GRA-127

| 页面 | 改造内容 |
|------|---------|
| Wallet (原 Costs) | 余额、转账、Reputation |
| Marketplace (新增) | Workflow 浏览、购买、执行 |
| Task | 添加支付设置、Escrow |
| Agent | 显示链上 Reputation |
| Dashboard | 链上数据统计 |

**产出**: 核心经济功能可用

---

### Phase 4: UI 组件 (2 周)
**任务**: GRA-128

```
src/components/
├── wallet/
│   ├── WalletCard.tsx
│   ├── BalanceDisplay.tsx
│   └── TransactionList.tsx
├── workflow/
│   ├── WorkflowCard.tsx
│   └── PurchaseButton.tsx
├── payment/
│   ├── PaymentModal.tsx
│   └── EscrowForm.tsx
├── reputation/
│   └── ReputationBadge.tsx
└── escrow/
    ├── EscrowList.tsx
    └── ReleaseButton.tsx
```

**产出**: 完整的 UI 组件库

---

### Phase 5: 测试发布 (1 周)
**任务**: GRA-129

- 功能测试
- 链上交互测试
- 性能优化
- 文档更新
- 打包发布

**产出**: Gradience Hub v1.0 可发布版本

---

## ⏱️ 时间线

```
Week 1  | Phase 1: 品牌改造
Week 2-3| Phase 2: 后端改造
Week 4-6| Phase 3: 核心功能
Week 7-8| Phase 4: UI 组件
Week 9  | Phase 5: 测试发布
```

**总计**: 9 周 → Gradience Hub v1.0

---

## 🔗 任务关联

```
GRA-124: Fork & Setup
    ↓
GRA-125: Phase 1 - 品牌改造
    ↓
GRA-126: Phase 2 - 后端改造
    ↓
GRA-127: Phase 3 - 核心功能
    ↓
GRA-128: Phase 4 - UI 组件
    ↓
GRA-129: Phase 5 - 测试发布
```

---

## 🚀 快速开始

### 1. Fork 项目
```bash
cd ~/dev/active
git clone https://github.com/DaviRain-Su/clawsuite.git gradience-hub
cd gradience-hub
```

### 2. 安装依赖
```bash
npm install
```

### 3. 启动开发
```bash
npm run dev          # Web 模式
npm run electron:dev # Electron 模式
```

### 4. 开始 Phase 1
参考 `docs/tasks/GRA-125.md`

---

## 📁 相关文档

- `docs/CLAWSUITE-ANALYSIS.md` - 详细代码分析
- `docs/INTEGRATION-CLAWSUITE.md` - 集成方案
- `docs/tasks/GRA-124~129.md` - 具体任务

---

## 💡 关键决策

1. **保留 Electron**: 不改 Tauri，减少重构成本
2. **渐进式改造**: 保留原有功能，逐步替换
3. **组件复用**: 复用 Gradience Web 的组件逻辑
4. **双模式支持**: 保留 Web 模式，Electron 增强

---

Ready to start? 🚀
