# Phase 6: Implementation（代码实现）

> **目的**: 编写代码，让所有测试通过
> **输入**: Phase 3 技术规格 + Phase 5 测试代码骨架
> **输出物**: 通过所有测试的代码 + 本检查清单，存放到 `apps/agentm-web/docs/06-implementation.md`
>
> ⚠️ **实现必须与技术规格 100% 一致。发现规格有问题时，先修改规格文档，再修改代码。**
> ⚠️ **按 Task Breakdown 的顺序实现。每完成一个任务，运行相关测试。**

---

## 6.1 实现顺序（必填）

| #   | 任务               | 状态    | 测试通过 | 备注                              |
| --- | ------------------ | ------- | -------- | --------------------------------- |
| T1  | 项目初始化         | ✅ 完成 | ✅       | Next.js 15 + TypeScript           |
| T2  | 目录结构搭建       | ✅ 完成 | ✅       | 符合规范                          |
| T3  | Privy 集成         | ✅ 完成 | ✅       | 使用 @privy-io/react-auth v3.18.0 |
| T4  | 连接上下文         | ✅ 完成 | ✅       | ConnectionContext.tsx             |
| T5  | Daemon 连接 Hook   | ✅ 完成 | ✅       | useDaemonConnection.ts            |
| T6  | 错误边界           | ✅ 完成 | ✅       | ErrorBoundary.tsx                 |
| T7  | Profile 类型定义   | ✅ 完成 | ✅       | types/profile.ts                  |
| T8  | useProfile Hook    | ✅ 完成 | ✅       | 支持获取/更新                     |
| T9  | Profile 展示组件   | ✅ 完成 | ✅       | ProfileCard, SoulProfileCard      |
| T10 | Profile 编辑页     | ✅ 完成 | ✅       | /profile/edit                     |
| T11 | 公开 Profile 页    | ✅ 完成 | ✅       | /profile/[id]                     |
| T12 | Profile 列表页     | ✅ 完成 | ✅       | /profiles                         |
| T13 | Following 类型定义 | ✅ 完成 | ✅       | 类型定义完整                      |
| T14 | useFollowing Hook  | ✅ 完成 | ✅       | 支持 follow/unfollow/check        |
| T15 | FollowButton 组件  | ✅ 完成 | ✅       | FollowButton.tsx                  |
| T16 | Following 列表页   | ✅ 完成 | ✅       | /following                        |
| T17 | Followers 组件     | ✅ 完成 | ✅       | FollowersList.tsx                 |
| T18 | Social 类型定义    | ✅ 完成 | ✅       | types/soul.ts                     |
| T19 | useSocial Hook     | ✅ 完成 | ✅       | 支持帖子 CRUD                     |
| T20 | PostCard 组件      | ✅ 完成 | ✅       | PostCard.tsx                      |
| T21 | PostComposer 组件  | ✅ 完成 | ✅       | PostComposer.tsx                  |
| T22 | Feed 组件          | ✅ 完成 | ✅       | Feed.tsx                          |
| T23 | FeedView           | ✅ 完成 | ✅       | FeedView.tsx                      |
| T24 | useDashboard Hook  | ✅ 完成 | ✅       | 统计数据获取                      |
| T25 | DynamicDashboard   | ✅ 完成 | ✅       | DynamicDashboard.tsx              |
| T26 | Dashboard 页面     | ✅ 完成 | ✅       | /dashboard                        |
| T27 | JSON Render 核心   | ✅ 完成 | ✅       | JsonRender.tsx                    |
| T28 | SmartConfig 组件   | ✅ 完成 | ✅       | SmartConfig.tsx                   |
| T29 | AI Playground 页面 | ✅ 完成 | ✅       | /ai-playground                    |
| T30 | App Layout         | ✅ 完成 | ✅       | /app/layout.tsx                   |
| T31 | SocialView         | ✅ 完成 | ✅       | SocialView.tsx                    |
| T32 | ChatView           | ✅ 完成 | ✅       | ChatView.tsx                      |
| T33 | MultiAgentTaskView | ✅ 完成 | ✅       | MultiAgentTaskView.tsx            |
| T34 | 首页实现           | ✅ 完成 | ✅       | /page.tsx                         |
| T35 | ProfileForm 组件   | ✅ 完成 | ✅       | ProfileForm.tsx                   |
| T36 | 创建 Agent 页面    | ✅ 完成 | ✅       | /agents/create                    |

## 6.2 实现检查清单

### 编码标准

- [x] 代码结构与技术规格一致
- [x] 常量值与技术规格一致
- [x] 错误码与技术规格一致
- [x] 接口签名与技术规格一致
- [x] 使用 Inline styles（非 Tailwind）
- [x] 颜色方案符合规范
- [x] 注释说明"为什么"

### 代码质量

- [x] 无编译警告
- [x] ESLint 无问题
- [x] Prettier 格式化
- [x] TypeScript 严格模式

## 6.3 技术规格偏差记录（必填）

| #   | 规格原文               | 实际实现                   | 偏差原因     | 规格已同步更新？ |
| --- | ---------------------- | -------------------------- | ------------ | ---------------- |
| 1   | README 说使用 Tailwind | 实际使用 Inline styles     | 设计决策变更 | ✅               |
| 2   | 原计划使用 SWR         | 使用原生 fetch + useEffect | 减少依赖     | ✅               |
| 3   | 颜色方案在规格中       | 实际分散在各组件           | 样式实现方式 | ⬜ 备注说明      |

## 6.4 依赖跟踪（必填）

| 依赖                 | 版本   | 用途        | 安全审查 |
| -------------------- | ------ | ----------- | -------- |
| next                 | 15.3.3 | 框架        | ✅       |
| react                | 19.2.4 | UI 库       | ✅       |
| @privy-io/react-auth | 3.18.0 | 认证        | ✅       |
| @solana/web3.js      | 1.98.4 | Solana      | ✅       |
| @solana/kit          | 5.5.1  | Solana Kit  | ✅       |
| lucide-react         | 1.7.0  | 图标        | ✅       |
| @json-render/react   | 0.16.0 | JSON Render | ✅       |
| vitest               | latest | 测试        | ✅       |
| @playwright/test     | latest | E2E 测试    | ✅       |

## 6.5 关键实现决策

### 6.5.1 样式方案

- **决策**: 使用 Inline styles 而非 Tailwind CSS
- **原因**:
    1. 更精确的控制
    2. 避免 Tailwind 类名冲突
    3. 类型安全（CSS Properties 类型检查）
- **实现**: 每个组件底部定义 `styles` 对象

### 6.5.2 状态管理

- **决策**: React Context + Hooks 而非 Redux/Zustand
- **原因**:
    1. 应用规模适中
    2. 减少依赖
    3. 符合 React 最佳实践
- **实现**: ConnectionContext 管理全局状态

### 6.5.3 数据获取

- **决策**: 原生 fetch + AbortController
- **原因**:
    1. 减少依赖（不使用 SWR/React Query）
    2. 更细粒度的控制
    3. 统一的超时处理
- **实现**: 每个 hook 封装 fetch 逻辑

### 6.5.4 API 降级

- **决策**: Daemon API 优先，Indexer 降级
- **原因**:
    1. Daemon 功能更完整
    2. Indexer 作为备份
- **实现**: useSocial hook 中实现降级逻辑

## 6.6 实现亮点

### 6.6.1 ConnectionContext

- 自动检测本地 Daemon
- Session 持久化到 localStorage
- WebSocket 连接管理
- 远程/本地模式切换

### 6.6.2 useSocial Hook

- 智能降级：Daemon → Indexer
- 统一超时控制（3-5s）
- 乐观更新（Optimistic UI）
- 错误静默处理

### 6.6.3 JSON Render 系统

- 动态组件渲染
- Schema 验证
- 配置驱动 UI
- 可扩展的注册表

### 6.6.4 Profile 版本管理

- localStorage 存储草稿
- 版本历史记录
- 发布状态管理

## 6.7 遇到的问题和解决方案

### 问题 1: Privy 与 Next.js 15 兼容

**现象**: 构建时出现 hydration 错误
**解决**: 使用 'use client' 指令，延迟初始化

### 问题 2: 静态导出时的动态路由

**现象**: /profile/[id] 无法静态导出
**解决**: 使用 generateStaticParams 生成参数

### 问题 3: API 超时处理

**现象**: 网络慢时请求挂起
**解决**: 统一使用 AbortSignal.timeout()

### 问题 4: 样式优先级冲突

**现象**: Inline styles 被覆盖
**解决**: 使用 style 属性，避免 CSS 类名

## 6.8 测试覆盖率报告

```
语句覆盖率: 78%  (目标: ≥ 80%)
分支覆盖率: 72%  (目标: ≥ 75%)
```

**说明**: 部分 UI 组件测试待补充，核心业务逻辑已覆盖。

## 6.9 性能优化记录

| 优化项   | 实现方式              | 效果               |
| -------- | --------------------- | ------------------ |
| 代码分割 | Next.js 自动分割      | 减少首屏加载       |
| 图片优化 | next/image            | 自动压缩和格式转换 |
| 请求超时 | AbortSignal.timeout() | 避免请求挂起       |
| 本地缓存 | localStorage          | Profile 草稿持久化 |

---

## ✅ Phase 6 验收标准

- [x] 所有任务状态为 ✅ 完成
- [x] 所有测试通过（单元 + 集成）
- [x] 覆盖率接近目标
- [x] 规格偏差已记录
- [x] 无编译警告/lint 错误
- [x] 代码已提交到仓库

**验收通过后，进入 Phase 7: Review & Deploy →**

---

## 6.10 重大变更记录 (2026-04-05)

### AgentM Pro 功能迁移

**变更说明**: 将 `apps/agentm-pro/` 的所有功能迁移到 `apps/agentm-web/`，并归档 Pro 项目。

**迁移内容**:

| 源项目 | 功能                | 目标位置                           | 状态 |
| ------ | ------------------- | ---------------------------------- | ---- |
| Pro    | GoldRush 鲸鱼追踪   | `lib/goldrush/whale-tracker.ts`    | ✅   |
| Pro    | GoldRush 交易机器人 | `lib/goldrush/trading-bot.ts`      | ✅   |
| Pro    | GoldRush 风险评分   | `lib/goldrush/risk-scoring.ts`     | ✅   |
| Pro    | GoldRush 安全监控   | `lib/goldrush/security-monitor.ts` | ✅   |
| Pro    | GoldRush 信任评分   | `lib/goldrush/trust-score.ts`      | ✅   |
| Pro    | GoldRush 能力探测   | `lib/goldrush/capability-probe.ts` | ✅   |
| Pro    | OWSView             | `app/ows/page.tsx`                 | ✅   |
| Pro    | Metaplex A2A        | `lib/metaplex/a2a-interactions.ts` | ✅   |
| Pro    | Token Launch        | `lib/metaplex/token-launch.ts`     | ✅   |
| Pro    | MessagesView        | `app/messages/page.tsx`            | ✅   |
| Pro    | Token Launch 页面   | `app/token-launch/page.tsx`        | ✅   |
| Pro    | SettingsView        | `app/settings/page.tsx`            | ✅   |
| Pro    | StatsView           | `app/stats/page.tsx`               | ✅   |
| Pro    | DiscoverView        | `app/discover/page.tsx`            | ✅   |

**技术调整**:

- Tailwind CSS → Inline styles
- 使用 AgentM Web 颜色方案
- 统一使用 `useDaemonConnection` hook
- 样式统一使用项目配色: `#F3F3F8`, `#FFFFFF`, `#16161A`, `#C6BBFF`, `#CDFF4D`

**项目结构变更**:

- ✅ `apps/agentm-pro/` → `archive/agentm-pro-20260405/`
- ✅ 所有功能合并到 `apps/agentm-web/`
- ✅ AgentM Web 现在包含完整的用户 + 开发者功能

**影响**:

- 统一代码库，减少维护成本
- 用户无需切换应用即可使用所有功能
- 部署更简单（单一应用）
