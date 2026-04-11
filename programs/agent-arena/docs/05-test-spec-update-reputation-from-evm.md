# Phase 5: Test Spec — UpdateReputationFromEvm Instruction

> **输入**: `03-technical-spec-update-reputation-from-evm.md` + `04-task-breakdown-update-reputation-from-evm.md`

---

## 5.1 测试策略

| 层级 | 工具 | 覆盖范围 |
| --- | --- | --- |
| 单元测试 | `cargo test` (native Rust) | 数据结构长度、PDA 推导、processor 逻辑 |

---

## 5.2 数据结构测试

### TC-STRUCT-01: Reputation 长度验证
**文件**: `state::agent_layer::tests`
- **步骤**: 运行 `test_account_data_lengths_match_spec`
- **期望**:
  - `REPUTATION_DATA_LEN == 117`
  - `REPUTATION_LEN == 119`

### TC-STRUCT-02: EvmAuthority 长度验证
**文件**: `state::agent_layer::tests`
- **步骤**: 运行 `test_evm_authority_length`
- **期望**:
  - `EVM_AUTHORITY_DATA_LEN == 293`
  - `EVM_AUTHORITY_LEN == 295`

---

## 5.3 Instruction 处理器测试

### TC-PROC-01: 成功更新声誉
**文件**: `instructions::update_reputation_from_evm::processor::tests`
- **步骤**:
  1. mock 创建 `reputation` 账户（初始 nonce = 0）
  2. mock 创建 `evm_authority` 账户（包含 relayer pubkey）
  3. 构造合法 `EvmReputationUpdate`（nonce = 1）
  4. 用 relayer 私钥签名
  5. 调用 `process_update_reputation_from_evm`
- **期望**:
  - 返回 `Ok(())`
  - reputation 中 `evm_sync_nonce == 1`
  - `global.completed` 增加

### TC-PROC-02: nonce 过旧被拒绝
**文件**: `instructions::update_reputation_from_evm::processor::tests`
- **步骤**:
  1. reputation 初始 nonce = 5
  2. 提交 nonce = 3 的 update
- **期望**: 返回 `Err(GradienceProgramError::EvmNonceTooOld)`

### TC-PROC-03: 非授权 relayer 被拒绝
**文件**: `instructions::update_reputation_from_evm::processor::tests`
- **步骤**:
  1. evm_authority 中只包含 relayer A
  2. 用 relayer B 的签名提交
- **期望**: 返回 `Err(GradienceProgramError::UnauthorizedRelayer)`

### TC-PROC-04: 错误签名被拒绝
**文件**: `instructions::update_reputation_from_evm::processor::tests`
- **步骤**:
  1. 构造合法 update
  2. 使用错误的私钥签名
- **期望**: 返回 `Err(GradienceProgramError::InvalidRelayerSignature)`

### TC-PROC-05: 初始化 EvmAuthority
**文件**: `instructions::initialize_evm_authority::processor::tests`
- **步骤**:
  1. mock owner signer
  2. mock uninitialized evm_authority 账户
  3. 调用 `process_initialize_evm_authority`
- **期望**:
  - 返回 `Ok(())`
  - 账户中 `owner`、`relayers`、`max_relayer_age_slots`、`bump` 正确

---

## 5.4 命令

```bash
cd programs/agent-arena
cargo test
```

---

## ✅ Phase 5 验收标准

- [x] 所有关键行为都有测试用例
- [x] 每个测试有明确期望结果
- [x] 定义了测试执行命令
