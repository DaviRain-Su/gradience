# Phase 5: Test Spec — Chain Hub Full v1

> **输入**: `apps/chain-hub/docs/03-technical-spec.md` + `04-task-breakdown.md`

---

## 5.1 测试策略

| 测试类型   | 覆盖范围                            | 工具                      | 运行环境          |
| ---------- | ----------------------------------- | ------------------------- | ----------------- |
| 单元测试   | 常量/长度/枚举/错误映射             | `cargo test -p chain-hub` | 本地              |
| 集成测试   | Program 指令与 PDA 生命周期         | LiteSVM                   | 本地              |
| SDK 单测   | invoke 路由、policy guard、key 注入 | `tsx --test`              | Node/Bun          |
| 端到端测试 | SDK + Program Localnet 联调         | tsx + local validator     | Surfpool/Localnet |
| 安全测试   | 权限/状态/过期/越权调用             | LiteSVM + tsx             | 本地              |

## 5.2 测试用例表

### 5.2.1 initialize / upgrade_config

**Happy**

- H1: initialize 成功创建 config/skill_registry/protocol_registry
- H2: upgrade_config 成功更新 authority 与 agent_layer_program

**Boundary**

- B1: 重复 initialize 失败

**Error**

- E1: 非 authority 调用 upgrade_config -> `NotUpgradeAuthority`

### 5.2.2 Skill 生命周期

**Happy**

- H1: register_skill 成功，registry 计数+1
- H2: set_skill_status(Active->Paused->Active) 成功

**Boundary**

- B1: `name.len == MAX_SKILL_NAME_LEN`
- B2: `metadata_uri.len == MAX_SKILL_METADATA_URI_LEN`

**Error**

- E1: category 越界 -> `InvalidSkillCategory`
- E2: 非 authority set_status -> `NotUpgradeAuthority`

### 5.2.3 Protocol Registry

**Happy**

- H1: register_protocol REST 类型成功
- H2: register_protocol CPI 类型成功
- H3: update_protocol_status Active/Paused 切换成功

**Boundary**

- B1: `protocol_id.len == MAX_PROTOCOL_ID_LEN`

**Error**

- E1: REST endpoint 为空 -> `InvalidProtocolEndpoint`
- E2: CPI program_id 零地址 -> `InvalidProtocolProgramId`
- E3: capability mask = 0 -> `InvalidCapabilityMask`

### 5.2.4 Delegation 生命周期

**Happy**

- H1: create_delegation_task 成功（Created）
- H2: activate 后 record_execution 累加
- H3: execution 达到 max 自动 Completed
- H4: requester 或 selected_judge 可 complete
- H5: requester 可 cancel（Created/Active）

**Boundary**

- B1: `max_executions = 1`
- B2: `expires_at = now + 1` 到时后调用返回 `DelegationExpired`

**Error**

- E1: 非 selected_agent record -> `UnauthorizedAgent`
- E2: 已 Completed 再 record -> `InvalidDelegationState`
- E3: 过期后 activate/record -> `DelegationExpired`
- E4: policy_hash 全零 -> `InvalidPolicyHash`

### 5.2.5 SDK invoke + Key Vault

**Happy**

- H1: invoke 根据 protocol_type 路由到 REST
- H2: invoke 根据 protocol_type 路由到 CPI
- H3: auth_mode=KeyVault 时成功注入 header

**Boundary**

- B1: policy 限额刚好等于 amount 通过

**Error**

- E1: 缺失 secret -> KeyVaultError
- E2: capability 不在 policy allowlist -> PolicyViolation
- E3: method 不匹配 -> PolicyViolation

## 5.3 集成测试场景

| #   | 场景名称           | 步骤                                                                        | 预期结果                                   |
| --- | ------------------ | --------------------------------------------------------------------------- | ------------------------------------------ |
| I1  | Program 正常全流程 | initialize→register_skill→register_protocol→create→activate→record→complete | 任务 Completed，计数正确                   |
| I2  | Program 异常分支   | create→过期→record                                                          | 返回 DelegationExpired，状态不发生业务推进 |
| I3  | SDK Route 流程     | 加载 protocol metadata→invoke(REST/CPI)                                     | 路由与策略守卫正确                         |
| I4  | KeyVault 安全      | invoke(auth=KeyVault) 缺失凭证                                              | 调用被拒绝且不泄露 secret                  |

## 5.4 安全测试场景

| #   | 攻击名称 | 攻击方式                 | 预期防御                        | 验证方法 |
| --- | -------- | ------------------------ | ------------------------------- | -------- |
| S1  | 权限绕过 | 非 authority 改配置/状态 | 返回 NotUpgradeAuthority        | 集成测试 |
| S2  | 状态重放 | Completed 后重复执行     | 返回 InvalidDelegationState     | 集成测试 |
| S3  | 过期绕过 | 到期后继续执行           | 返回 DelegationExpired          | 集成测试 |
| S4  | 凭证窃取 | 读取 KeyVault 返回值     | 仅 header 注入，日志不含 secret | SDK 单测 |
| S5  | 策略绕过 | 未授权 capability 调用   | PolicyViolation                 | SDK 单测 |

## 5.5 测试代码骨架

### Rust

- `tests/integration-tests/src/test_initialize_and_upgrade.rs`
- `tests/integration-tests/src/test_skill_lifecycle.rs`
- `tests/integration-tests/src/test_protocol_registry.rs`
- `tests/integration-tests/src/test_delegation_lifecycle.rs`

### TypeScript

- `sdk/src/invoke.test.ts`
- `sdk/src/key-vault.test.ts`

## 5.6 覆盖目标

| 指标               | 目标                          |
| ------------------ | ----------------------------- |
| Program 指令覆盖率 | 100%（11 个指令均有集成测试） |
| 分支覆盖率         | ≥ 90%                         |
| SDK 路由分支覆盖率 | 100%（REST/CPI/KeyVault）     |
| 安全场景           | S1-S5 全部通过                |

---

## ✅ Phase 5 验收标准

- [x] 每个接口均有测试用例映射
- [x] Happy/Boundary/Error 三类齐全
- [x] 安全测试场景完整
- [x] 测试文件骨架已定义
- [x] 覆盖目标已量化
