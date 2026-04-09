# Phase 1: PRD — Verifiable Execution Layer (VEL)

> **项目名称**: Verifiable Execution Layer (VEL)  
> **所属模块**: Agent Daemon (`apps/agent-daemon/`)  
> **版本**: v0.1  
> **日期**: 2026-04-07  
> **作者**: Gradience Team + AI Agents

---

## 1.1 项目概述

Verifiable Execution Layer (VEL) 是 Gradience 协议在 `agent-daemon` 内部的扩展子系统，目标是通过 **TEE（可信执行环境）** 为 AI Agent 的 workflow 执行提供**可验证的远端计算证明**，从而将 Agent Arena 的 `judge_and_pay` 环节从“主观评分”推进到“可验证的客观执行证明”。

在现有架构中，Agent Arena 的结算信任瓶颈是 **judge**：judge 评估 agent 提交的 resultRef 并给出主观分数。VEL 的引入使得 workflow 可以在隔离的 TEE 中执行，执行结果与运行日志被 TEE 的 attestation report 密码学绑定，judge 只需验证 attestation 的有效性即可确认执行确实发生且未被篡改。

---

## 1.2 问题定义

### 要解决的问题

> **AI Agent 在本地执行 workflow 后提交结果，链上 / 买方无法验证：该结果是否确实由一个未被篡改的环境生成，以及执行过程中是否真的没有泄露私钥或伪造数据？**

### 当前状态

- `workflow-engine` 在本地 Node.js 进程中执行 trading handlers 和 tool calls。
- 执行结果只是一串 JSON / 文本，通过 `submit_result` 的 `resultRef` 提交到链上。
- `settlement-bridge` 虽然能正确构建 `judge_and_pay` transaction，但 proof 只是执行结果的 SHA256 hash，**没有证明执行环境本身的可信性**。
- judge 评分仍然是主观的：judge 可以犯错、可以被收买、可以与 agent 串通。

### 目标状态

- 高风险 workflow（尤其是涉及资金操作的 trading workflows）可以被调度到 **TEE 实例** 中执行。
- TEE 执行完成后，输出 **attestation report**（如 Nitro Enclave Attestation Document 或 Gramine RA-TLS quote）。
- Daemon 将 attestation report 和 execution result 一起编码为 `judge_and_pay` 的 proof payload。
- Judge 验证 attestation 的有效性（而非评估业务结果），并据此给出高置信度评分。
- 即使 judge 想犯错，也无法伪造 TEE 的 attestation；整个系统的 trust assumption 从 "trust the judge" 降级为 "trust the TEE hardware manufacturer"。

---

## 1.3 用户故事

| #   | 角色                    | 想要                                                 | 以便                                                                         | 优先级 |
| --- | ----------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| 1   | **Agent Owner**         | 让我的 agent 在一个隔离环境中执行涉及私钥的 workflow | 私钥不会暴露给 host OS，执行结果也不会被本地恶意软件篡改                     | P0     |
| 2   | **Task Poster / Buyer** | 收到一个附带 TEE attestation 的 workflow 执行结果    | 我可以验证该结果确实来自一个受信任的硬件环境，而不是 agent 随便编造的        | P0     |
| 3   | **Judge / Evaluator**   | 拿到一个包含 TEE attestation 的 proof bundle         | 我可以快速验证 attestation 的签名和 PCR 值，从而对执行结果给出高置信度评分   | P0     |
| 4   | **Protocol Developer**  | 有清晰的 TEE 抽象接口                                | 未来可以无缝切换到不同的 TEE 后端（Nitro → Gramine → Phala）而不重写业务逻辑 | P1     |

---

## 1.4 功能范围

### 做什么（In Scope）

- [ ] 设计并实现 `TeeExecutionEngine` 抽象层，定义统一的 `execute(workflow, inputs) → { result, attestation }` 接口。
- [ ] 实现第一个 TEE Provider：**本地 Gramine 模拟模式**（或 Nitro Enclave 本地模拟），用于开发和 CI。
- [ ] 定义 `AttestationBundle` 数据结构（包含 attestation report、PCR 值、执行结果 hash、时间戳）。
- [ ] 扩展 `settlement-bridge.ts`，使其支持将 `AttestationBundle` 序列化为 `judge_and_pay` 的 proof data。
- [ ] 在 `pda-resolver.ts` 或 bridge 层中增加 `verifyAttestation(attestationBundle) → boolean` 的基础校验逻辑。
- [ ] 提供一个端到端测试脚本：在 devnet 上跑通 `post_task → TEE execute → submit_result (带 attestation) → judge_and_pay`。
- [ ] 文档：编写 `TEE_INTEGRATION.md`，说明如何启动 TEE 环境、如何验证 attestation。

### 不做什么（Out of Scope）

- **不做 ZKML / ZK Proof**：本次聚焦 TEE attestation，不引入 ZK 电路或 EZKL 等 ZKML 框架。
- **不做 Production 级云服务部署**：不直接开发 AWS Nitro 云上自动伸缩的 Enclave Fleet（但设计要兼容）。
- **不做 Marketplace 购买触发引擎的集成**：Marketplace 购买 → 自动触发 Arena task 的闭环是后续工作，本次只保证 Engine → Arena 的 proof 链路。
- **不修改 Agent Arena Program 的链上逻辑**：现有 `judge_and_pay` instruction 的 data layout 不变，我们通过 proof payload 编码 attestation。

---

## 1.5 成功标准

| 标准                     | 指标                                                                                            | 目标值                        |
| ------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------- |
| TEE 抽象接口完整度       | `TeeExecutionEngine` 接口 + 至少 1 个 provider 实现                                             | 100%                          |
| Attestation 验证可运行   | `verifyAttestation()` 能在本地成功验证模拟 TEE 的 report                                        | 通过                          |
| Devnet 端到端验证        | `post_task → execute(workflow in TEE) → submit_result → judge_and_pay` 全流程在 devnet 确认成功 | 至少 1 笔成功交易的 signature |
| 测试覆盖                 | `TeeExecutionEngine` 和 attestation utils 的单测覆盖率                                          | ≥ 80%                         |
| 文档完整                 | `TEE_INTEGRATION.md` 包含启动、验证、排查步骤                                                   | 审阅通过                      |
| Build / Typecheck / Lint | `apps/agent-daemon` 及 workspace 构建全绿                                                       | 0 errors                      |

---

## 1.6 约束条件

| 约束类型     | 具体描述                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **技术约束** | 必须基于现有 `apps/agent-daemon/` 扩展，不能破坏已有 bridge、workflow-engine、key-manager 的接口。                             |
| **技术约束** | Attestation 数据大小必须能容纳进 Solana transaction 的 data 负载限制（当前 `judge_and_pay` 的 proof 通过链上或链下方式携带）。 |
| **时间约束** | 作为一个高优先级架构升级，目标是在 2-3 个 Sprint 内完成 Phase 1-7。                                                            |
| **资源约束** | 由 AI Agent 主导开发，人力有限，优先选择已有成熟 SDK/CLI 的 TEE 方案（推荐 Gramine 或 AWS Nitro SDK）。                        |
| **依赖约束** | 依赖 Agent Arena Program 当前的 `judge_and_pay` instruction 格式（如果将来 program 要验证 proof hash，则需 Coordination）。    |

---

## 1.7 相关文档

| 文档                          | 链接                                                  | 关系                          |
| ----------------------------- | ----------------------------------------------------- | ----------------------------- |
| Agent Arena Program Spec      | `./apps/agent-arena/docs/03-technical-spec.md`        | 参考 `judge_and_pay` 数据格式 |
| Settlement Bridge Report      | `./apps/agent-daemon/docs/E2E-VERIFICATION-REPORT.md` | 参考 bridge 现有实现          |
| Phase 7 Review Report (M1-M3) | `./docs/07-review-report.md`                          | 了解当前 gaps 与修复状态      |
| Gramine Documentation         | https://gramineproject.io/                            | TEE 实现参考                  |
| AWS Nitro Enclave Docs        | https://docs.aws.amazon.com/enclaves/                 | TEE 实现参考                  |

---

## ✅ Phase 1 验收标准

- [x] 1.1-1.6 所有「必填」部分已完成
- [x] 用户故事至少 3 个
- [x] 「不做什么」已明确列出
- [x] 成功标准可量化
- [ ] 团队/相关人已 review

**验收通过后，进入 Phase 2: Architecture →**
