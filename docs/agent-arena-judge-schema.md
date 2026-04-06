# Agent Arena — `judge_and_pay` Instruction Schema

> **用途**: 为 `agent-daemon/src/bridge/settlement-bridge.ts` 重构提供精确的 instruction 格式参考
> **核对来源**:
> - Rust: `programs/agent-arena/src/instructions/judge_and_pay/{data,accounts,processor}.rs`
> - TS SDK (Codama 生成): `apps/agent-arena/clients/typescript/src/generated/instructions/judgeAndPay.ts`
> **更新日期**: 2026-04-06

---

## 1. Program Identity

| 字段 | 值 |
|------|-----|
| **Program ID** (Devnet / 当前配置) | `5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs` |
| **Instruction Name** | `JudgeAndPay` |
| **Instruction Discriminator** | `4` (u8) |

---

## 2. Instruction Data Layout (Borsh)

Rust 定义:

```rust
pub struct JudgeAndPayData {
    pub winner: [u8; 32],
    pub score: u8,
    pub reason_ref: Option<String>,
}
```

### 2.1 序列化后的字节结构

| 偏移 | 字段 | 类型 | 长度 | 说明 |
|------|------|------|------|------|
| 0 | `discriminator` | u8 | 1 | 固定值 `0x04` |
| 1 | `winner` | [u8; 32] | 32 | 获胜者公钥的原始字节 |
| 33 | `score` | u8 | 1 | 0-100 的分数 |
| 34 | `reason_ref` | Option<String> | 1 + (4 + N) | Borsh `Option`：`0x00` 表示 `None`；`0x01` 后跟 u32-le 长度 + UTF-8 字符串 |

### 2.2 序列化示例

**Scenario A**: winner = `[9u8; 32]`, score = `85`, reason_ref = `None`
```
04                                           -- discriminator (1)
09 09 09 09 09 09 09 09 09 09 09 09 09 09    -- winner (32 bytes)
09 09 09 09 09 09 09 09 09 09 09 09 09 09
09 09 09 09
55                                           -- score = 85 (1)
00                                           -- Option::None (1)
Total: 35 bytes
```

**Scenario B**: winner = `[9u8; 32]`, score = `85`, reason_ref = `Some("good work")`
```
04
09 09 ... 09 (32 bytes)
55
01                                           -- Option::Some marker (1)
0a 00 00 00                                  -- string length = 10 (u32 LE)
67 6f 6f 64 20 77 6f 72 6b                  -- "good work" (10 bytes)
Total: 48 bytes
```

### 2.3 TypeScript 序列化实现（@solana/web3.js 兼容）

推荐使用 `borsh` npm 包（已在 workspace 中可用）:

```typescript
import * as borsh from 'borsh';

class JudgeAndPayData {
  winner: Uint8Array;
  score: number;
  reason_ref: string | null;

  constructor(args: { winner: Uint8Array; score: number; reason_ref: string | null }) {
    this.winner = args.winner;
    this.score = args.score;
    this.reason_ref = args.reason_ref;
  }
}

const schema: borsh.Schema = new Map([
  [
    JudgeAndPayData,
    {
      kind: 'struct',
      fields: [
        ['winner', [32]],
        ['score', 'u8'],
        ['reason_ref', { kind: 'option', type: 'string' }],
      ],
    },
  ],
]);

function serializeJudgeAndPayData(data: JudgeAndPayData): Buffer {
  const serialized = borsh.serialize(schema, data);
  return Buffer.concat([Buffer.from([4]), Buffer.from(serialized)]);
}
```

---

## 3. Accounts List

### 3.1 SOL Path（基础 13 个账户）

| # | 账户 | 角色 | 是否可写 | 是否签名者 | 说明 |
|---|------|------|---------|-----------|------|
| 0 | `judge` | WritableSigner | ✅ | ✅ | 任务的指定 judge |
| 1 | `task` | Writable | ✅ | ❌ | Task PDA |
| 2 | `escrow` | Writable | ✅ | ❌ | Escrow PDA |
| 3 | `poster_account` | Writable | ✅ | ❌ | 任务发布者主账户 |
| 4 | `winner_account` | Writable | ✅ | ❌ | 获胜 agent 主账户 |
| 5 | `winner_application` | Readonly | ❌ | ❌ | Winner 的 Application PDA |
| 6 | `winner_submission` | Readonly | ❌ | ❌ | Winner 的 Submission PDA |
| 7 | `winner_reputation` | Writable | ✅ | ❌ | Winner 的 Reputation PDA |
| 8 | `judge_stake` | Writable | ✅ | ❌ | Judge 的 Stake PDA |
| 9 | `treasury` | Writable | ✅ | ❌ | Treasury PDA |
| 10 | `system_program` | Readonly | ❌ | ❌ | `11111111111111111111111111111111` |
| 11 | `event_authority` | Readonly | ❌ | ❌ | Event Authority PDA |
| 12 | `gradience_program` | Readonly | ❌ | ❌ | Agent Arena Program ID 自身 |

### 3.2 SPL Token Path（额外 8 个可选账户）

当 `task.mint != [0u8; 32]` 时必须提供，顺序如下：

| # | 账户 | 角色 | 是否可写 | 说明 |
|---|------|------|---------|------|
| 13 | `judge_token_account` | Writable | ✅ | Judge 的 ATA |
| 14 | `escrow_ata` | Writable | ✅ | Escrow 的 ATA |
| 15 | `winner_token_account` | Writable | ✅ | Winner 的 ATA |
| 16 | `poster_token_account` | Writable | ✅ | Poster 的 ATA |
| 17 | `treasury_ata` | Writable | ✅ | Treasury 的 ATA（若不存在会被 ix 创建） |
| 18 | `mint_account` | Readonly | ❌ | Mint 地址 |
| 19 | `token_program` | Readonly | ❌ | SPL Token / Token-2022 Program |
| 20 | `associated_token_program` | Readonly | ❌ | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` |

### 3.3 Remaining Accounts（Losers 退款对）

在 SPL path 或 SOL path 之后，可附加任意数量的 `2*N` 个账户，按对出现：

- 偶数位: `application_pda` (Readonly) — 失败 agent 的 Application PDA
- 奇数位: `agent_account` (Writable) — SOL path 下为 agent 主账户；SPL path 下为 agent 的 ATA

Rust 侧校验：
- `remaining_accounts.len()` 必须是偶数。
- 每对中的 `application_pda` 必须属于该 `task_id` 和该 agent。
- winner 不会出现在 loser pairs 中（会被显式拒绝）。

---

## 4. PDA Seeds

所有 PDA 均使用 `PublicKey.findProgramAddressSync`（或 `findProgramAddress`）计算。

| PDA | Seeds | 说明 |
|-----|-------|------|
| **Task** | `["task", task_id_le_bytes]` | `task_id` 为 u64，小端字节序 |
| **Escrow** | `["escrow", task_id_le_bytes]` | 与 task 共用 task_id |
| **Application** | `["application", task_id_le_bytes, agent_address_bytes]` | 绑定 task + agent |
| **Submission** | `["submission", task_id_le_bytes, agent_address_bytes]` | 绑定 task + agent |
| **Reputation** | `["reputation", agent_address_bytes]` | 每个 agent 唯一 |
| **Judge Stake** | `["stake", judge_address_bytes]` | 每个 judge 唯一 |
| **Treasury** | `["treasury"]` | 全局唯一，无额外 seeds |
| **Event Authority** | `["event_authority"]` | 全局唯一，用于 CPI 事件发射 |

### 4.1 TypeScript PDA 计算示例

```typescript
import { PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs');

function taskPda(taskId: bigint): [PublicKey, number] {
  const taskIdBytes = Buffer.allocUnsafe(8);
  taskIdBytes.writeBigUInt64LE(taskId);
  return PublicKey.findProgramAddressSync([Buffer.from('task'), taskIdBytes], PROGRAM_ID);
}

function escrowPda(taskId: bigint): [PublicKey, number] {
  const taskIdBytes = Buffer.allocUnsafe(8);
  taskIdBytes.writeBigUInt64LE(taskId);
  return PublicKey.findProgramAddressSync([Buffer.from('escrow'), taskIdBytes], PROGRAM_ID);
}

function applicationPda(taskId: bigint, agent: PublicKey): [PublicKey, number] {
  const taskIdBytes = Buffer.allocUnsafe(8);
  taskIdBytes.writeBigUInt64LE(taskId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('application'), taskIdBytes, agent.toBuffer()],
    PROGRAM_ID,
  );
}

function submissionPda(taskId: bigint, agent: PublicKey): [PublicKey, number] {
  const taskIdBytes = Buffer.allocUnsafe(8);
  taskIdBytes.writeBigUInt64LE(taskId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('submission'), taskIdBytes, agent.toBuffer()],
    PROGRAM_ID,
  );
}

function reputationPda(agent: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('reputation'), agent.toBuffer()],
    PROGRAM_ID,
  );
}

function stakePda(judge: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('stake'), judge.toBuffer()],
    PROGRAM_ID,
  );
}

function treasuryPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('treasury')], PROGRAM_ID);
}

function eventAuthorityPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('event_authority')], PROGRAM_ID);
}
```

---

## 5. TS SDK 参考实现

`apps/agent-arena/clients/typescript/src/generated/instructions/judgeAndPay.ts` (Codama 自动生成) 已正确实现上述格式：

- `getJudgeAndPayInstructionDataEncoder()`: u8 discriminator + `[u8;32]` winner + `u8` score + `Option(String)` reasonRef
- `getJudgeAndPayInstructionAsync()`: 按 [0..20] 顺序组装 accounts，支持 optional SPL tail 和 remaining accounts

**注意**：该 SDK 使用 `@solana/kit`（新 web3 库），而 `agent-daemon` 使用 `@solana/web3.js` v1.x，**两者类型不兼容**。因此 `agent-daemon` 需要基于本文档独立实现等价的 instruction builder（使用 `@solana/web3.js` + `borsh`）。

---

## 6. Runtime 校验要点（Processor 侧）

在构造 transaction 前，确保以下前置条件已在链上满足：

1. **Task 状态**: `task.state == TaskState::Open`（否则会被 program 拒绝）
2. **Judge 身份**: `task.judge == judge_address`
3. **Winner 身份**: winner 必须已 `applyForTask` 且已 `submitResult`
4. **Score 范围**: `0 <= score <= MAX_SCORE`（当前 `MAX_SCORE = 100`）
5. **SPL Path 一致性**: 若 `task.mint != [0u8;32]`，必须提供全部 8 个 SPL accounts；若为 SOL，`task.mint == [0u8;32]`，且不能提供 SPL accounts
6. **Loser pairs**: 若需要退还其他 applicant 的 stake，remaining accounts 必须成对出现且数量正确

---

## 7. 快速校验清单（供 T3 使用）

在提交 `judge_and_pay` transaction 到 devnet 之前，用以下 checklist self-check：

- [ ] Discriminator 字节是 `0x04`，且在 data 的第 0 位
- [ ] `winner` 是 32 字节原始公钥（不是 base58 字符串）
- [ ] `score` 是 u8 且在 0-100 范围内
- [ ] `reason_ref` 的 Borsh Option 格式正确（`0x00` 或 `0x01` + u32-le len + utf8）
- [ ] Accounts 数量 >= 13
- [ ] 若 SPL path，accounts 数量 == 21 + 2*N
- [ ] 若 SOL path，accounts 数量 == 13 + 2*N
- [ ] 所有 PDA 通过 `findProgramAddressSync` 计算并与传入地址逐个比对
- [ ] `system_program` 固定为 `11111111111111111111111111111111`
- [ ] `event_authority` 通过 seed `["event_authority"]` 计算
- [ ] Transaction 的 signer 是 `judge`

---

*文档维护方: Gradience Protocol Team*
