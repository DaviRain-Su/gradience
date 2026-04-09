# Phase 3: Technical Spec — Chain Hub Full v1

> **目的**: 将 Chain Hub Full v1 细化为可直接实现的精确规格。  
> **输入**: `apps/chain-hub/docs/02-architecture.md`

---

## 3.1 数据结构定义

### 3.1.1 链上账户（PDA）

> 说明：Chain Hub 账户统一采用 `2-byte header`：`[discriminator: u8, version: u8]`，无 Anchor discriminator。

#### ProgramConfig（PDA: `[b"config"]`）

| 字段                  | 类型    | 大小   | 约束      | 说明               |
| --------------------- | ------- | ------ | --------- | ------------------ |
| upgrade_authority     | [u8;32] | 32     | 非零      | 配置升级权限       |
| agent_layer_program   | [u8;32] | 32     | 非零      | 用于推导 JudgePool |
| skill_count           | u64     | 8      | 单调递增  | 技能序号           |
| protocol_count        | u64     | 8      | 单调递增  | 协议计数           |
| delegation_task_count | u64     | 8      | 单调递增  | 委托任务序号       |
| bump                  | u8      | 1      | 存储 bump | PDA 验证           |
| **数据总计**          |         | **89** |           |                    |
| **账户总计**          |         | **91** | +2 header |                    |

#### SkillRegistry（PDA: `[b"skill_registry"]`）

| 字段             | 类型 | 大小   | 约束                  |
| ---------------- | ---- | ------ | --------------------- |
| total_registered | u64  | 8      | 单调递增              |
| total_active     | u64  | 8      | `<= total_registered` |
| bump             | u8   | 1      | 存储 bump             |
| **数据总计**     |      | **17** |                       |
| **账户总计**     |      | **19** | +2 header             |

#### ProtocolRegistry（PDA: `[b"protocol_registry"]`）

结构同 SkillRegistry：总大小 `19 bytes`。

#### SkillEntry（PDA: `[b"skill", &skill_id.to_le_bytes()]`）

| 字段           | 类型    | 大小    | 约束                             |
| -------------- | ------- | ------- | -------------------------------- |
| skill_id       | u64     | 8       | >0                               |
| authority      | [u8;32] | 32      | signer                           |
| judge_category | u8      | 1       | `< MAX_CATEGORIES`               |
| status         | u8      | 1       | SkillStatus                      |
| name           | String  | 36      | `1..=MAX_SKILL_NAME_LEN`         |
| metadata_uri   | String  | 132     | `1..=MAX_SKILL_METADATA_URI_LEN` |
| bump           | u8      | 1       | PDA bump                         |
| **数据总计**   |         | **211** |                                  |
| **账户总计**   |         | **213** | +2 header                        |

#### ProtocolEntry（PDA: `[b"protocol", protocol_id.as_bytes()]`）

| 字段              | 类型    | 大小    | 约束                      |
| ----------------- | ------- | ------- | ------------------------- |
| protocol_id       | String  | 36      | `1..=MAX_PROTOCOL_ID_LEN` |
| authority         | [u8;32] | 32      | signer                    |
| protocol_type     | u8      | 1       | ProtocolType              |
| trust_model       | u8      | 1       | ProtocolTrustModel        |
| auth_mode         | u8      | 1       | AuthMode                  |
| status            | u8      | 1       | ProtocolStatus            |
| capabilities_mask | u64     | 8       | 非 0                      |
| endpoint          | String  | 132     | REST 模式非空             |
| docs_uri          | String  | 132     | 非空                      |
| program_id        | [u8;32] | 32      | CPI 模式非零              |
| idl_ref           | String  | 132     | CPI 模式非空              |
| bump              | u8      | 1       | PDA bump                  |
| **数据总计**      |         | **509** |                           |
| **账户总计**      |         | **511** | +2 header                 |

#### DelegationTaskAccount（PDA: `[b"delegation_task", &task_id.to_le_bytes()]`）

| 字段                     | 类型    | 大小    | 约束                        |
| ------------------------ | ------- | ------- | --------------------------- |
| task_id                  | u64     | 8       | >0                          |
| requester                | [u8;32] | 32      | signer                      |
| skill                    | [u8;32] | 32      | SkillEntry 地址             |
| protocol                 | [u8;32] | 32      | ProtocolEntry 地址          |
| selected_agent_authority | [u8;32] | 32      | 非零                        |
| selected_judge_authority | [u8;32] | 32      | 非零                        |
| judge_pool               | [u8;32] | 32      | 由 agent_layer_program 推导 |
| judge_category           | u8      | 1       | `< MAX_CATEGORIES`          |
| max_executions           | u32     | 4       | `>0`                        |
| executed_count           | u32     | 4       | `<= max_executions`         |
| expires_at               | i64     | 8       | unix timestamp              |
| status                   | u8      | 1       | DelegationTaskStatus        |
| policy_hash              | [u8;32] | 32      | 客户端策略摘要              |
| bump                     | u8      | 1       | PDA bump                    |
| **数据总计**             |         | **251** |                             |
| **账户总计**             |         | **253** | +2 header                   |

### 3.1.2 枚举

- `SkillStatus`: `Active=0`, `Paused=1`
- `ProtocolStatus`: `Active=0`, `Paused=1`
- `ProtocolType`: `RestApi=0`, `SolanaProgram=1`
- `ProtocolTrustModel`: `CentralizedEnterprise=0`, `CentralizedCommunity=1`, `OnChainVerified=2`
- `AuthMode`: `None=0`, `KeyVault=1`
- `DelegationTaskStatus`: `Created=0`, `Active=1`, `Completed=2`, `Cancelled=3`, `Expired=4`

### 3.1.3 配置与常量

| 常量                       | 值  | 类型  | 说明                    |
| -------------------------- | --- | ----- | ----------------------- |
| MAX_CATEGORIES             | 8   | u8    | 与 Agent Layer 对齐     |
| MAX_SKILL_NAME_LEN         | 32  | usize | 技能名长度              |
| MAX_SKILL_METADATA_URI_LEN | 128 | usize | 技能元数据 URI          |
| MAX_PROTOCOL_ID_LEN        | 32  | usize | 协议 ID 长度            |
| MAX_PROTOCOL_ENDPOINT_LEN  | 128 | usize | REST endpoint 长度      |
| MAX_PROTOCOL_DOCS_URI_LEN  | 128 | usize | 协议文档 URI 长度       |
| MAX_PROTOCOL_IDL_REF_LEN   | 128 | usize | CPI idl 引用（cid/url） |

## 3.2 接口定义

### 3.2.1 Program 指令

1. `initialize(upgrade_authority, agent_layer_program)`
2. `register_skill(judge_category, name, metadata_uri)`
3. `set_skill_status(skill_id, status)`
4. `register_protocol(protocol_id, protocol_type, trust_model, auth_mode, capabilities_mask, endpoint, docs_uri, program_id, idl_ref)`
5. `update_protocol_status(protocol_id, status)`
6. `create_delegation_task(skill_id, protocol_id, judge_category, selected_agent_authority, selected_judge_authority, max_executions, expires_at, policy_hash)`
7. `activate_delegation_task(task_id)`
8. `record_delegation_execution(task_id, execution_ref_hash)`
9. `complete_delegation_task(task_id)`
10. `cancel_delegation_task(task_id)`
11. `upgrade_config(new_upgrade_authority, new_agent_layer_program)`

### 3.2.2 关键前置/后置约束

- `register_*`：创建 PDA 前必须验证地址种子、可写与 signer。
- `set_skill_status` / `update_protocol_status` / `upgrade_config`：仅 `upgrade_authority`。
- `create_delegation_task`：
    - Skill/Protocol 必须 `Active`
    - `skill.judge_category == judge_category`
    - `max_executions > 0`
    - `expires_at > now`
- `record_delegation_execution`：
    - 仅 `selected_agent_authority` signer
    - status 必须 Active
    - 未过期；过期则报错 `DelegationExpired`
    - `executed_count += 1`; 达到 `max_executions` 自动 Completed
- `complete_delegation_task`：请求方或 selected_judge signer，且 status=Active
- `cancel_delegation_task`：仅 requester，status in {Created, Active}

### 3.2.3 SDK 公开接口（`apps/chain-hub/sdk`）

```ts
interface ChainHubSdk {
    invoke(input: InvokeInput): Promise<InvokeResult>;
    invokeRest(input: RestInvokeInput): Promise<InvokeResult>;
    invokeCpi(input: CpiInvokeInput): Promise<InvokeResult>;
}

interface KeyVaultAdapter {
    resolveSecret(keyRef: string): string;
    guard(policy: VaultPolicy, input: InvokeInput): void;
}
```

- `invoke()` 按 protocol 元信息自动分流到 REST / CPI
- `auth_mode=KeyVault` 时必须经 `KeyVaultAdapter.resolveSecret`

## 3.3 错误码定义

| 错误码 | 名称                     | 触发条件                      |
| ------ | ------------------------ | ----------------------------- |
| 7000   | NotUpgradeAuthority      | 非升级权限方调用配置接口      |
| 7001   | InvalidSkillCategory     | category 越界                 |
| 7002   | InvalidSkillName         | name 空或超长                 |
| 7003   | InvalidSkillMetadataUri  | metadata_uri 空或超长         |
| 7004   | ZeroAuthority            | 关键 authority 为零地址       |
| 7005   | SkillMismatch            | skill_id/category 不匹配      |
| 7006   | InvalidJudgePoolShape    | JudgePool 推导不匹配          |
| 7007   | SkillNotActive           | skill 非 Active               |
| 7008   | ProtocolNotActive        | protocol 非 Active            |
| 7009   | InvalidProtocolId        | protocol_id 空或超长          |
| 7010   | InvalidProtocolEndpoint  | REST endpoint 非法            |
| 7011   | InvalidProtocolDocsUri   | docs_uri 非法                 |
| 7012   | InvalidProtocolProgramId | CPI program_id 非法           |
| 7013   | InvalidProtocolIdlRef    | CPI idl_ref 非法              |
| 7014   | InvalidCapabilityMask    | capability mask 为 0          |
| 7015   | InvalidAuthMode          | auth_mode 非法                |
| 7016   | InvalidProtocolType      | protocol_type 非法            |
| 7017   | InvalidTrustModel        | trust_model 非法              |
| 7018   | InvalidDelegationState   | 不允许的状态转换              |
| 7019   | DelegationExpired        | 委托已过期                    |
| 7020   | InvalidMaxExecutions     | max_executions=0              |
| 7021   | UnauthorizedAgent        | 非 selected_agent 执行记录    |
| 7022   | UnauthorizedRequester    | 非 requester 操作             |
| 7023   | UnauthorizedJudge        | 非 selected_judge 完成        |
| 7024   | ProtocolMismatch         | delegation 中 protocol 不匹配 |
| 7025   | InvalidPolicyHash        | policy_hash 全零              |

## 3.4 状态机

| 当前状态       | 动作             | 条件                        | 新状态           | 副作用                                 |
| -------------- | ---------------- | --------------------------- | ---------------- | -------------------------------------- |
| Created        | activate         | requester && 未过期         | Active           | 无                                     |
| Created        | cancel           | requester                   | Cancelled        | 无                                     |
| Created        | any execution    | -                           | 拒绝             | InvalidDelegationState                 |
| Active         | record_execution | selected_agent && 未过期    | Active/Completed | `executed_count++`；满额自动 Completed |
| Active         | complete         | requester 或 selected_judge | Completed        | 无                                     |
| Active         | cancel           | requester                   | Cancelled        | 无                                     |
| Created/Active | mutating op      | now > expires_at            | 保持原状态       | 返回 DelegationExpired（事务回滚）     |

## 3.5 算法与计算

### 3.5.1 JudgePool 推导

```
judge_pool = PDA(
  seeds = [b"judge_pool", [judge_category]],
  program = agent_layer_program
)
```

### 3.5.2 过期检查

```
if now > task.expires_at and task.status in {Created, Active}:
    return DelegationExpired
```

### 3.5.3 执行计数推进

```
task.executed_count += 1
if task.executed_count >= task.max_executions:
    task.status = Completed
```

## 3.6 安全规则

| 规则           | 实现方式                                  | 验证方法          |
| -------------- | ----------------------------------------- | ----------------- |
| 配置权限隔离   | `upgrade_authority` 严格校验              | 权限负例测试      |
| PDA 防伪造     | 所有账户强制 seeds 校验                   | InvalidSeeds 负例 |
| 生命周期防重放 | 状态机检查 + 不可逆终态                   | 状态转换测试      |
| 过期保护       | Clock 校验 + DelegationExpired 返回       | 时间推进测试      |
| 凭证最小暴露   | KeyVault 仅返回请求头注入，不落盘         | SDK 单测          |
| 策略守卫       | invoke 前 guard(method/capability/amount) | SDK 负例测试      |

## 3.7 PDA 定义

| 用途             | Seeds                                          |
| ---------------- | ---------------------------------------------- |
| ProgramConfig    | `[b"config"]`                                  |
| SkillRegistry    | `[b"skill_registry"]`                          |
| ProtocolRegistry | `[b"protocol_registry"]`                       |
| SkillEntry       | `[b"skill", &skill_id.to_le_bytes()]`          |
| ProtocolEntry    | `[b"protocol", protocol_id.as_bytes()]`        |
| DelegationTask   | `[b"delegation_task", &task_id.to_le_bytes()]` |

## 3.8 边界条件

| #   | 边界条件                     | 预期行为                           |
| --- | ---------------------------- | ---------------------------------- |
| 1   | 重复 initialize              | AccountAlreadyInitialized          |
| 2   | category=8                   | InvalidSkillCategory               |
| 3   | protocol_id 空字符串         | InvalidProtocolId                  |
| 4   | protocol_id 长度 > 32        | InvalidProtocolId                  |
| 5   | REST 协议 endpoint 空        | InvalidProtocolEndpoint            |
| 6   | CPI 协议 program_id 为零     | InvalidProtocolProgramId           |
| 7   | delegation max_executions=0  | InvalidMaxExecutions               |
| 8   | delegation expires_at <= now | DelegationExpired                  |
| 9   | 非 selected_agent 记录执行   | UnauthorizedAgent                  |
| 10  | 已 Completed 再执行          | InvalidDelegationState             |
| 11  | policy_hash 全零             | InvalidPolicyHash                  |
| 12  | Skill/Protocol Paused 被引用 | SkillNotActive / ProtocolNotActive |

---

## ✅ Phase 3 验收标准

- [x] 数据结构精确到字段与字节
- [x] Program/SDK 接口定义完整
- [x] 错误码集中定义
- [x] 状态机与算法可直接编码
- [x] 安全规则落到可测试实现
- [x] PDA 种子定义完整
- [x] 边界条件 >= 10 条
