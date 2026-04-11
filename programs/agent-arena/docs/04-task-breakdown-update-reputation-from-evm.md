# Phase 4: Task Breakdown — UpdateReputationFromEvm Instruction

> **输入**: `03-technical-spec-update-reputation-from-evm.md`

---

## 4.1 任务列表

| # | 任务名称 | 描述 | 依赖 | 预估时间 | 优先级 | Done 定义 |
|---|---------|------|------|----------|--------|-----------|
| T1 | 扩展 Reputation 结构 | `agent_layer.rs` 新增 `evm_sync_nonce`，更新 data length 常量与测试 | 无 | 1h | P0 | `cargo test` 中长度测试通过 |
| T2 | 新增 EvmAuthority 结构 | `agent_layer.rs` 新增 `EvmAuthority` 及长度常量 | T1 | 1h | P0 | 测试通过 |
| T3 | 扩展错误码 | `errors.rs` 新增 4 个 EVM 相关错误 | 无 | 0.5h | P0 | 编译通过 |
| T4 | 新增 instruction 数据/账户/处理器 | `update_reputation_from_evm/` 全套文件 | T1-T3 | 3h | P0 | `cargo check` 通过 |
| T5 | 新增 InitializeEvmAuthority instruction | `initialize_evm_authority/` 全套文件 | T2 | 2h | P0 | `cargo check` 通过 |
| T6 | 注册新 instruction | `definition.rs`、`instruction.rs` trait、`entrypoint.rs`、`mod.rs` | T4, T5 | 1h | P0 | 编译通过 |
| T7 | 编写单元测试 | `agent_layer.rs` 测试 + processor 测试 | T6 | 2h | P0 | 所有 Rust 测试通过 |
| T8 | Phase 5 Test Spec | `05-test-spec-update-reputation-from-evm.md` | T7 | 0.5h | P0 | 文档完成 |
| T9 | Phase 6 Implementation | `06-implementation-update-reputation-from-evm.md` | T8 | 0.5h | P0 | 文档完成 |
| T10 | Phase 7 Review Report | `07-review-report-update-reputation-from-evm.md` | T9 | 0.5h | P0 | 文档完成 |

---

## 4.2 依赖图

```
T1 (Reputation) --> T4 (UpdateReputationFromEvm)
T2 (EvmAuthority) --> T5 (InitializeEvmAuthority)
T3 (Errors) --> T4, T5
T4, T5 --> T6 (Registration)
T6 --> T7 (Tests)
T7 --> T8, T9, T10
```

---

## ✅ Phase 4 验收标准

- [x] 每个任务 ≤ 4 小时
- [x] 每个任务有 Done 定义
- [x] 依赖关系已标明
