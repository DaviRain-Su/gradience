# Phase 5: Test Spec — agent-arena/program

> **范围**: `agent-arena/program` 及其集成测试的测试策略与覆盖要求
> **权威测试规格**: 见项目级 `docs/05-test-spec.md`（完整测试用例列表）

---

## 1. 测试层次

```
程序测试
├── 单元测试（内嵌 #[cfg(test)]）      → cargo test -p gradience
├── 集成测试（LiteSVM）                → cargo test -p tests-gradience
└── Fuzz 测试                          → 未实现（P2，暂缓）
```

---

## 2. 当前测试文件清单

### 单元测试（program/src/ 内嵌）

| 文件 | 测试内容 | 状态 |
|------|---------|------|
| `errors.rs` | 42 个错误码数值与 Display 输出 | ✅ 已实现 |

> 注：其余指令 processor 无内嵌单元测试，逻辑通过集成测试覆盖。

### 集成测试（`tests/integration-tests/src/`）

| 文件 | 覆盖场景 | 状态 |
|------|---------|------|
| `test_t19a.rs` | initialize + post_task（designated / pool 两种模式） | ✅ |
| `test_t19b.rs` | apply_for_task + submit_result + 状态验证 | ✅ |
| `test_t19c.rs` | judge_and_pay（SOL 转账，费用分拆验证） | ✅ |
| `test_t19d.rs` | cancel_task / refund_expired / force_refund 路径 | ✅ |

### 测试工具（`tests/integration-tests/src/utils/`）

| 文件 | 说明 |
|------|------|
| `setup.rs` | `TestContext`：初始化 LiteSVM，deploy program，airdrop SOL |
| `pda.rs` | PDA 推导辅助函数（与 program 保持同步） |
| `state.rs` | 从链上账户反序列化状态的工具函数 |
| `assertions.rs` | 余额断言、状态断言封装 |
| `cu_utils.rs` | Compute Unit 消耗记录（性能 benchmark 用） |

---

## 3. 运行方式

```bash
# 在 apps/agent-arena/ 目录

# 仅运行单元测试（快，<1s）
cargo test -p gradience

# 运行集成测试（需先 build）
just build
cargo test -p tests-gradience

# 运行单个集成测试
cargo test -p tests-gradience test_t19c

# 运行所有测试（build + unit + integration）
just test
```

---

## 4. 覆盖要求

### 必须覆盖（P0）

| 场景 | 对应测试 |
|------|---------|
| initialize：首次初始化成功 | test_t19a |
| initialize：重复初始化应 Err | ❌ 缺失 |
| post_task：designated 模式 | test_t19a |
| post_task：pool 模式 | test_t19a |
| post_task：reward=0 应 Err | ❌ 缺失 |
| apply_for_task：首次申请成功 | test_t19b |
| apply_for_task：重复申请应 Err | ❌ 缺失 |
| submit_result：正常提交 | test_t19b |
| judge_and_pay：95/3/2 费用分拆精确验证 | test_t19c |
| judge_and_pay：score < MIN_SCORE → 走 Refund 路径（task.state = Refunded，奖励退回 poster），非 Err | ❌ 缺失 |
| cancel_task：poster 主动取消，收取 2% | test_t19d |
| refund_expired：deadline 后退款 | test_t19d |
| force_refund：judge_deadline+7天后触发 | test_t19d |
| register_judge：质押成功 | test_t19a |
| unstake_judge：7天冷却期内应 Err | ❌ 缺失 |

### 应覆盖（P1，待补充）

- Token-2022 支付路径（与 SOL 路径一致的测试）
- JudgePool 满员（200 judges）时再注册应 Err
- 非法账户所有者攻击测试
- 越权操作（非 poster 取消、非 judge 评判）

### 暂缓（P2）

- Fuzz 测试：对 instruction_data 随机变异
- 性能基准：Compute Unit 消耗上限验证（需 mainnet CU limit 对齐）

---

## 5. 测试环境

| 项目 | 版本 | 说明 |
|------|------|------|
| LiteSVM | `^0.9.0` | 轻量级 Solana VM，无需本地 validator |
| Rust test runner | cargo test | 标准 |
| Program build | cargo-build-sbf | 集成测试前必须先 build |

---

## 6. 缺口总结与补充计划

| 优先级 | 缺失测试 | 建议位置 |
|--------|---------|---------|
| P0 | initialize 重复初始化 | test_t19a 追加 |
| P0 | post_task reward=0 边界 | test_t19a 追加 |
| P0 | score < MIN_SCORE 拒绝 | test_t19c 追加 |
| P0 | apply 重复申请 | test_t19b 追加 |
| P0 | unstake 冷却期校验 | 新建 test_t19e |
| P1 | Token-2022 支付路径 | 新建 test_t19f |
| P1 | 越权操作安全测试 | 新建 test_t19g |
