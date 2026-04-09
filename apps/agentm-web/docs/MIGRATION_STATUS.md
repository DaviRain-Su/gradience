# AgentM Desktop → Web Migration Status

## 1. 执行摘要 (Executive Summary)

### 1.1 迁移背景

AgentM 项目从 Electron Desktop 应用迁移到 Next.js Web 应用，主要动机包括：

- **更广泛的访问性**: 无需下载安装，浏览器即可使用
- **降低维护成本**: 统一代码库，无需维护主进程/渲染进程分离
- **更好的可扩展性**: 利用 Vercel 边缘网络进行全球部署
- **Web3 原生体验**: 更好的钱包集成（Dynamic Wallet）

### 1.2 总体进度统计

| 指标              | Desktop (Electron) | Web (Next.js) | 状态        |
| ----------------- | ------------------ | ------------- | ----------- |
| 代码行数          | 44,601 行          | 41,480 行     | ✅ 93% 迁移 |
| TypeScript 文件数 | 177 个             | 174 个        | ✅ 98% 迁移 |
| 功能模块          | 15 个              | 14 个         | ⏳ 进行中   |
| 测试覆盖率        | ~60%               | ~45%          | ⏳ 需提升   |

---

## 2. 已完成的迁移 (✅)

### 2.1 核心功能

| 功能                    | Desktop 实现                           | Web 实现                        | 状态      |
| ----------------------- | -------------------------------------- | ------------------------------- | --------- |
| **Voice Engine**        | `src/renderer/lib/voice-engine.ts`     | `src/lib/voice/voice-engine.ts` | ✅ 已迁移 |
| **Notification System** | `src/components/social/notifications/` | `src/components/notification/`  | ✅ 已迁移 |
| **Reputation Wallet**   | `src/components/wallet/`               | `src/components/wallet/`        | ✅ 已迁移 |
| **Soul Probe Chat**     | `src/components/social/probe/`         | `src/components/social/probe/`  | ✅ 已迁移 |
| **OWS Integration**     | `src/lib/ows/`                         | `src/lib/ows/`                  | ✅ 已迁移 |

### 2.2 页面路由

| 页面          | Desktop 路由            | Web 路由         | 状态        |
| ------------- | ----------------------- | ---------------- | ----------- |
| Soul Profile  | `/soul` (内嵌)          | `/soul`          | ✅ 已完成   |
| Discover      | `/discover` (内嵌)      | `/discover`      | ✅ 已完成   |
| Token Launch  | N/A                     | `/token-launch`  | 🌐 Web 独有 |
| OWS Dashboard | `/ows` (内嵌)           | `/ows`           | ✅ 已完成   |
| Notifications | `/notifications` (内嵌) | `/notifications` | ✅ 已完成   |
| Following     | `/following` (内嵌)     | `/following`     | ✅ 已完成   |
| Messages      | `/messages` (内嵌)      | `/messages`      | ✅ 已完成   |
| Profile       | `/profile` (内嵌)       | `/profile/[id]`  | ✅ 已完成   |
| Settings      | `/settings` (内嵌)      | `/settings`      | ✅ 已完成   |

### 2.3 技术栈迁移

| 技术     | Desktop         | Web                   | 迁移方式    |
| -------- | --------------- | --------------------- | ----------- |
| UI 框架  | React 18 + Vite | React 18 + Next.js 15 | ✅ 重构完成 |
| 样式     | CSS Modules     | CSS-in-JS + Tailwind  | ✅ 重构完成 |
| 状态管理 | Zustand (内嵌)  | React Hooks           | ✅ 简化完成 |
| 语音引擎 | Web Speech API  | Web Speech API        | ✅ 直接复用 |
| 钱包连接 | 自定义          | Dynamic.xyz           | ✅ 已迁移   |
| 后端 API | Electron IPC    | HTTP API + WebSocket  | ✅ 已迁移   |

---

## 3. 待完成的迁移 (⏳)

### 3.1 A2A Router 生态

| 组件                   | Desktop 位置                                         | Web 状态  | 优先级 | 任务    |
| ---------------------- | ---------------------------------------------------- | --------- | ------ | ------- |
| **A2A Core Router**    | `src/main/a2a-router/router.ts`                      | ⏳ 未开始 | P0     | GRA-143 |
| **Google A2A Adapter** | `src/main/a2a-router/adapters/google-a2a-adapter.ts` | ⏳ 未开始 | P1     | GRA-144 |
| **XMTP Adapter**       | `src/main/a2a-router/adapters/xmtp-adapter.ts`       | ⏳ 未开始 | P1     | GRA-145 |
| **Nostr Adapter**      | `src/main/a2a-router/adapters/nostr-adapter.ts`      | ⏳ 未开始 | P2     | GRA-146 |

### 3.2 跨链桥接适配器

| 适配器               | Desktop 位置                                          | Web 状态  | 优先级 | 任务    |
| -------------------- | ----------------------------------------------------- | --------- | ------ | ------- |
| **LayerZero**        | `src/main/a2a-router/adapters/layerzero-adapter.ts`   | ⏳ 未开始 | P1     | GRA-147 |
| **Wormhole**         | `src/main/a2a-router/adapters/wormhole-adapter.ts`    | ⏳ 未开始 | P1     | GRA-147 |
| **DeBridge**         | `src/main/a2a-router/adapters/debridge-adapter.ts`    | ⏳ 未开始 | P2     | GRA-147 |
| **Cross-Chain Base** | `src/main/a2a-router/adapters/cross-chain-adapter.ts` | ⏳ 未开始 | P1     | -       |

### 3.3 结算与存储

| 功能                | Desktop 位置                                    | Web 状态    | 优先级 | 任务    |
| ------------------- | ----------------------------------------------- | ----------- | ------ | ------- |
| **MagicBlock 加速** | `src/main/settlement/magicblock-enhancement.ts` | ⏳ 未开始   | P2     | GRA-148 |
| **IPFS 存储**       | `src/renderer/hooks/useIPFSStorage.ts`          | ⚠️ 部分引用 | P2     | GRA-149 |
| **Attestations**    | `src/renderer/hooks/useAttestations.ts`         | ⏳ 未开始   | P2     | GRA-150 |
| **VRF 随机选择**    | `src/main/settlement/magicblock-enhancement.ts` | ⏳ 未开始   | P3     | -       |

### 3.4 发现与排名

| 功能               | Desktop 位置                          | Web 状态    | 优先级 | 任务 |
| ------------------ | ------------------------------------- | ----------- | ------ | ---- |
| **Agent 排名算法** | `src/renderer/lib/ranking.test.ts`    | ⚠️ 基础实现 | P1     | -    |
| **高级筛选**       | `src/renderer/views/DiscoverView.tsx` | ⚠️ 简化版   | P2     | -    |
| **趋势分析**       | `src/components/social/discovery/`    | ⏳ 未开始   | P3     | -    |

---

## 4. 无需迁移的功能 (❌)

### 4.1 Desktop 特有功能

| 功能                    | 原因             | 替代方案                |
| ----------------------- | ---------------- | ----------------------- |
| **Electron 主进程**     | Web 不需要       | Next.js API Routes      |
| **本地文件系统访问**    | 浏览器安全限制   | 使用浏览器 File API     |
| **原生系统通知**        | Web 使用替代方案 | 浏览器 Notification API |
| **离线 Whisper.cpp**    | WASM 方案复杂    | Web Speech API 足够     |
| **本地数据库 (SQLite)** | Web 环境不适用   | IndexedDB / 服务端存储  |
| **系统托盘集成**        | Web 不需要       | PWA 支持                |

### 4.2 已移除功能

| 功能                | Desktop 位置                          | 移除原因           |
| ------------------- | ------------------------------------- | ------------------ |
| **Electrobun 集成** | `src/main/web-entry/`                 | 技术方案变更       |
| **本地桥接客户端**  | `src/main/web-entry/bridge-client.ts` | 直接使用 HTTP API  |
| **WebSocket 桥接**  | `src/main/web-entry/ws.ts`            | 使用标准 WebSocket |
| **阶段演示代码**    | `src/main/stage-a-demo.ts`            | 临时代码           |

---

## 5. Web 独有功能 (🌐)

### 5.1 新增功能

| 功能                  | 位置                            | 描述                 |
| --------------------- | ------------------------------- | -------------------- |
| **Token Launch**      | `src/app/token-launch/`         | Agent Token 发行平台 |
| **Dynamic Wallet**    | `src/lib/dynamic/`              | 统一钱包接入方案     |
| **Passkey Wallet**    | `src/lib/ows/passkey-wallet.ts` | 生物识别钱包         |
| **WebEntry Client**   | `src/lib/web-entry-client.ts`   | 优化的 Web 客户端    |
| **Smart Config Demo** | `src/app/smart-config-demo/`    | JSON Render 演示     |
| **AI Playground**     | `src/app/ai-playground/`        | AI 功能 playground   |
| **Gold Rush 模块**    | `src/lib/goldrush/`             | 交易监控和风险评分   |

### 5.2 架构改进

| 改进                   | 描述                       |
| ---------------------- | -------------------------- |
| **Next.js App Router** | 使用最新的 App Router 架构 |
| **Server Components**  | 减少客户端 bundle 大小     |
| **Edge Runtime**       | 支持 Vercel Edge 部署      |
| **Streaming**          | 支持流式渲染               |
| **Middleware**         | 统一的请求处理层           |

---

## 6. 迁移统计详情

### 6.1 代码行数对比

```
Desktop (archive/agentm-electron-20260405):
- TypeScript: 44,601 行
- 源文件: 233 个 (.ts + .tsx)
- 测试文件: ~25 个

Web (apps/agentm-web):
- TypeScript: 41,480 行
- 源文件: 174 个 (.ts + .tsx)
- 测试文件: ~8 个
```

### 6.2 文件数量对比

| 类型         | Desktop | Web | 变化       |
| ------------ | ------- | --- | ---------- |
| 组件 (.tsx)  | 56      | 91  | +35 (+62%) |
| 库文件 (.ts) | 100     | 83  | -17 (-17%) |
| Hooks        | 12      | 18  | +6 (+50%)  |
| 类型定义     | 8       | 5   | -3 (-38%)  |
| 页面         | 内嵌    | 24  | 新增       |
| 测试文件     | 25      | 8   | -17 (-68%) |

### 6.3 依赖对比

| 类别          | Desktop | Web |
| ------------- | ------- | --- |
| 运行时依赖    | ~45     | ~38 |
| 开发依赖      | ~30     | ~25 |
| Electron 专属 | ~8      | 0   |
| Next.js 专属  | 0       | ~5  |

---

## 7. 后续建议

### 7.1 优先级建议

#### P0 - 关键功能 (2 周内)

1. **GRA-143**: A2A Core Router 迁移
    - 影响跨 Agent 通信能力
    - 阻塞其他 A2A 适配器

2. **测试覆盖率提升**
    - 当前 Web 测试覆盖率 ~45%
    - 目标: 达到 Desktop 的 ~60%

#### P1 - 重要功能 (1 个月内)

1. **GRA-144**: Google A2A Adapter
    - 与外部 Agent 生态互操作

2. **GRA-147**: 跨链适配器 (LayerZero/Wormhole)
    - 多链 Agent 支持

3. **Agent 排名算法完善**
    - 当前只有基础排序
    - 需要完整算法实现

#### P2 - 增强功能 (2 个月内)

1. **GRA-148**: MagicBlock 加速结算
2. **GRA-149**: IPFS 存储完整实现
3. **GRA-150**: Attestations 系统

#### P3 - 优化功能 (3 个月内)

1. VRF 随机选择
2. 高级发现筛选
3. 性能优化

### 7.2 依赖关系图

```
A2A Core Router (GRA-143)
├── Google A2A Adapter (GRA-144)
├── XMTP Adapter (GRA-145)
└── Nostr Adapter (GRA-146)

Cross-Chain Base
├── LayerZero Adapter (GRA-147)
├── Wormhole Adapter (GRA-147)
└── DeBridge Adapter (GRA-147)

Settlement Layer
├── MagicBlock Enhancement (GRA-148)
└── VRF Selection

Storage Layer
├── IPFS Storage (GRA-149)
└── Attestations (GRA-150)
```

### 7.3 风险评估

| 风险                | 可能性 | 影响 | 缓解措施                        |
| ------------------- | ------ | ---- | ------------------------------- |
| A2A Router 迁移延迟 | 中     | 高   | 分阶段实施，先核心后适配器      |
| 跨链适配器复杂度    | 高     | 中   | 保持 Demo 模式，逐步替换        |
| 测试覆盖不足        | 高     | 中   | 增加 E2E 测试，使用 Playwright  |
| 性能退化            | 中     | 中   | 持续监控，使用 Vercel Analytics |

---

## 8. 附录

### 8.1 任务列表映射

| 任务 ID | 任务描述                 | 状态    | 负责人 |
| ------- | ------------------------ | ------- | ------ |
| GRA-142 | 创建 MIGRATION_STATUS.md | ✅ 完成 | -      |
| GRA-143 | 迁移 A2A Core Router     | ⏳ 待办 | TBD    |
| GRA-144 | 迁移 Google A2A Adapter  | ⏳ 待办 | TBD    |
| GRA-145 | 迁移 XMTP Adapter        | ⏳ 待办 | TBD    |
| GRA-146 | 迁移 Nostr Adapter       | ⏳ 待办 | TBD    |
| GRA-147 | 迁移跨链适配器           | ⏳ 待办 | TBD    |
| GRA-148 | 迁移 MagicBlock 加速     | ⏳ 待办 | TBD    |
| GRA-149 | 迁移 IPFS 存储           | ⏳ 待办 | TBD    |
| GRA-150 | 迁移 Attestations        | ⏳ 待办 | TBD    |

### 8.2 参考文档

- Desktop 代码: `archive/agentm-electron-20260405/`
- Web 代码: `apps/agentm-web/`
- PRD: `apps/agentm-web/docs/01-prd.md`
- 架构文档: `apps/agentm-web/docs/02-architecture.md`
- 技术规范: `apps/agentm-web/docs/03-technical-spec.md`

### 8.3 变更日志

| 日期       | 版本 | 变更                         |
| ---------- | ---- | ---------------------------- |
| 2026-04-05 | v1.0 | 初始版本，完成基础统计和分类 |

---

_文档生成时间: 2026-04-05_
_代码统计基于: TypeScript 源文件 (.ts, .tsx)_
