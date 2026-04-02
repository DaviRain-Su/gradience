# Phase 4: Task Breakdown — Agent.im

> 目标：将 Agent.im 从 Demo 态推进到生产分阶段实施（与项目级 `docs/04-task-breakdown.md` 的 T53~T60 对齐）。

---

## 4.1 Stage A（可演示闭环）

| # | 任务名称 | 描述 | 依赖 | 时间 | 优先级 | Done 定义 |
|---|---------|------|------|------|--------|----------|
| IM-T01 | A1 端口与启动栈统一 | Indexer 基址统一到 `http://127.0.0.1:3001`；`start-dev-stack.sh` 改为 agent-im 窗口；对齐 judge-daemon/indexer/agent-im 启动变量 | 03-tech-spec | 2h | P0 | 一键启动后 Agent.im 可读取真实 Indexer 任务/声誉数据；无端口冲突 |
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

---

## 4.3 验收节奏

- **里程碑 M-A（Demo）**：IM-T01 ~ IM-T03
- **里程碑 M-B（Prod）**：IM-T04 ~ IM-T07

阶段验收必须满足：

1. 命令可重复执行（非一次性手工成功）
2. API/UI 状态一致（无“页面成功但后端失败”）
3. 失败路径可回退（demo 降级、错误提示、不崩溃）

---

## ✅ Phase 4 验收标准

- [x] 任务均 ≤ 5h，可执行且可验证
- [x] 每项任务有清晰 Done 定义
- [x] 与项目级 T53~T60 映射关系明确
- [x] Stage A / Stage B 分层清晰，便于分批上线
