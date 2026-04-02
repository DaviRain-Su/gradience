# Phase 4: Task Breakdown — AgentM

> 目标：将 AgentM 从 Demo 态推进到生产分阶段实施（与项目级 `docs/04-task-breakdown.md` 的 T53~T60 对齐）。

---

## 4.1 Stage A（可演示闭环）

| # | 任务名称 | 描述 | 依赖 | 时间 | 优先级 | Done 定义 |
|---|---------|------|------|------|--------|----------|
| IM-T01 | A1 端口与启动栈统一 | Indexer 基址统一到 `http://127.0.0.1:3001`；`start-dev-stack.sh` 改为 agent-im 窗口；对齐 judge-daemon/indexer/agent-im 启动变量 | 03-tech-spec | 2h | P0 | 一键启动后 AgentM 可读取真实 Indexer 任务/声誉数据；无端口冲突 |
| IM-T02 | A2 Privy 真实认证接入 | 接入 Privy provider/hooks，保留未配置时 demo 降级；登录后获取真实 Solana 地址并写入 store | IM-T01 | 4h | P0 | Google OAuth 登录成功；`publicKey` 非 `DEMO_*`；认证失败提示可读且不崩溃 |
| IM-T03 | A3 Demo 脚本固化 | 固化登录→发现→任务/声誉→互通状态的演示路径；输出命令与预期输出 | IM-T02 | 2h | P0 | 10 分钟内可重复演示；文档化命令可直接复制运行 |

---

## 4.2 Stage B（生产级闭环）

| # | 任务名称 | 描述 | 依赖 | 时间 | 优先级 | Done 定义 |
|---|---------|------|------|------|--------|----------|
| IM-T04 | B3 8004 身份状态回写对齐 | 对齐 interop status（identity/feedback/evm/istrana/attestation 计数）并校验 UI/API 展示一致性 | IM-T03 | 3h | P0 | `/interop/status` 与 dashboard 展示一致；计数与 relay 状态一致 |
| IM-T05 | B4 SAS Attestation 展示闭环 | 接入 SDK `attestations.list()` 并展示 TaskCompletion 凭证摘要（taskId/score/category/completedAt） | IM-T04 | 4h | P1 | 登录用户可查询并展示 attestation 列表；404/null 路径降级正常 |
| IM-T06 | B5 Metaplex 注册迁移 | 将登录后的身份初始化流程与 Metaplex/8004 注册触发点打通（避免停留在 hackathon-demo） | IM-T05 | 5h | P1 | 首次登录或首次参与任务后可观测到身份注册闭环（状态/日志/API） |
| IM-T07 | B6 打包与运维门槛 | 验证 Electrobun 打包、启动性能、环境变量矩阵；补充生产运行脚本与 smoke 命令 | IM-T06 | 4h | P1 | 启动时间和包体达到 PRD 指标；新环境可按清单快速拉起 |

## 4.2A Stage C（Agent Profile）

| # | 任务名称 | 描述 | 依赖 | 时间 | 优先级 | Done 定义 |
|---|---------|------|------|------|--------|----------|
| IM-T08 | C1 Profile 查询接入 | 接入 `GET /api/agents/{pubkey}/profile`，合并声誉与基础画像数据 | IM-T03 | 3h | P0 | Agent 详情页可展示 display_name/bio/links；接口异常可降级 |
| IM-T09 | C2 Profile 详情页重构 | 在 Agent 详情页新增 Profile 区块（身份、简介、外链、验证状态） | IM-T08 | 3h | P0 | 用户可在 1 屏内完成“识别 Agent → 决策是否委托” |
| IM-T10 | C3 Profile 内容流展示（P1） | 展示 Profile 扩展内容流（weekly/diary 摘要） | IM-T09 | 4h | P1 | 有内容时展示摘要，无内容时占位提示 |
| IM-T11 | C4 信任回退策略 | 无 Profile / Profile 失效时回退“最小卡片（地址+声誉）”并提示风险 | IM-T09 | 2h | P0 | 404/超时/解析失败均不崩溃且提示清晰 |

---

## 4.3 验收节奏

- **里程碑 M-A（Demo）**：IM-T01 ~ IM-T03
- **里程碑 M-B（Prod）**：IM-T04 ~ IM-T07
- **里程碑 M-C（Profile）**：IM-T08 ~ IM-T11

阶段验收必须满足：

1. 命令可重复执行（非一次性手工成功）
2. API/UI 状态一致（无“页面成功但后端失败”）
3. 失败路径可回退（demo 降级、错误提示、不崩溃）

---

## 4.4 开发步骤级执行清单（2026-04-02）

> 对 Stage A/B 做可直接开工的步骤拆分，默认按 Sprint 执行；每项控制在 0.5h~2h。

### Sprint 1（认证 + 数据面）

| # | 步骤任务 | 描述 | 依赖 | 时间 | 验收 |
|---|---------|------|------|------|------|
| IM-S01 | Auth 环境矩阵与启动守卫 | 校验 `PRIVY_APP_ID` / `PRIVY_CLIENT_ID` / demo fallback 开关，缺失时给出可读错误 | IM-T01 | 1h | 缺失配置不崩溃，提示可读 |
| IM-S02 | Privy Provider 接线 | 在 renderer 层接入 Privy provider 与登录状态监听 | IM-S01 | 1h | 登录态可稳定更新到 store |
| IM-S03 | 会话绑定模型落库 | 写入 `privyUserId/publicKey/email/sessionAt`，支持重启恢复 | IM-S02 | 1h | 重启后仍可识别登录状态 |
| IM-S04 | `/me` API 聚合 | 汇总 profile + reputation + interop status | IM-S03 | 1.5h | `/me` 返回结构稳定且字段完整 |
| IM-S05 | `/me/tasks` API 聚合 | 聚合 poster/agent 视角任务，支持分页和状态筛选 | IM-S04 | 1.5h | 分页正确、空数据返回一致 |
| IM-S06 | `/me/submissions` API 聚合 | 聚合提交历史（score/status/ref）并支持倒序 | IM-S04 | 1h | 数据顺序和筛选正确 |

### Sprint 2（前端闭环 + 双入口）

| # | 步骤任务 | 描述 | 依赖 | 时间 | 验收 |
|---|---------|------|------|------|------|
| IM-S07 | Me 视图数据绑定 | 将 `/me*` API 数据接入 Me 页面（统计卡 + 列表） | IM-S05, IM-S06 | 1.5h | 页面与 API 数据一致 |
| IM-S08 | Task 发现/报名前端流 | Discover 页面补齐报名和状态回显 | IM-S07 | 1.5h | 报名后状态实时更新 |
| IM-S09 | 提交结果与历史追踪 | Chat/Task 页面支持提交结果并可追踪状态 | IM-S08 | 2h | 提交后能在历史中追踪 |
| IM-S10 | GUI/API 会话共享 | 本地 Agent API（3939）复用 GUI 登录会话与权限 | IM-S09 | 1.5h | GUI/API 鉴权行为一致 |
| IM-S11 | 语音 fallback 完整化 | Whisper 不可用时自动降级到 Web Speech API | IM-S09 | 1h | 降级链路可用且无崩溃 |

### Sprint 3（发布门槛）

| # | 步骤任务 | 描述 | 依赖 | 时间 | 验收 |
|---|---------|------|------|------|------|
| IM-S12 | Electrobun 打包与 smoke | 完成桌面包构建、启动时长和核心路径 smoke | IM-S10, IM-S11 | 2h | 新环境可启动并跑通关键路径 |

---

## 4.5 与项目级 Backlog 映射（T61~T70）

| 项目级任务 | AgentM 对应 |
|-----------|---------------|
| T61 | IM-S01 ~ IM-S03 |
| T62 | IM-S04 ~ IM-S06 |
| T63 | IM-S07 ~ IM-S09 |
| T64 | IM-S10 ~ IM-S12 |
| Profile-Track | IM-T08 ~ IM-T11 |

**并行依赖（来自协议侧 Track-B）**

- T65：Pool Judge 生产化（影响 AgentM 任务分配展示一致性）
- T66：staking/slash 闭环（影响 Me 页资金和状态回显）
- T67：排名与分类信誉强化（影响 Discover 排序）

---

## ✅ Phase 4 验收标准

- [x] 任务均 ≤ 5h，可执行且可验证
- [x] 每项任务有清晰 Done 定义
- [x] 与项目级 T53~T60 映射关系明确
- [x] Stage A / Stage B 分层清晰，便于分批上线
- [x] 已补充开发步骤级任务（可直接进入实现）
