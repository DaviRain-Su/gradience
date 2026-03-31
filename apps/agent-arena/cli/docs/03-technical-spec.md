# Phase 3: Technical Spec — agent-arena/cli

> **范围**: `apps/agent-arena/cli/` — 命令行交互工具
> **依赖**: `clients/typescript`（GradienceSDK）、`@solana/kit`

---

## 1. 模块职责

CLI 是面向**终端用户和 CI 脚本**的交互入口：

- 任务生命周期管理（发布、申请、提交、评判、取消、退款）
- Judge 管理（注册质押、解质押）
- 本地配置（RPC 端点、keypair 路径）

**不做**：
- 数据持久化（无本地数据库）
- 链上数据直接访问（通过 SDK 中转）

---

## 2. 技术栈

| 项目 | 说明 |
|------|------|
| TypeScript + Bun | 执行运行时（`#!/usr/bin/env bun`，直接运行 `.ts` 文件） |
| tsx (Node.js) | 测试运行时（`pnpm run test:cli` → `tsx --test`） |
| `@solana/kit` | 密钥对、RPC、地址工具 |
| `GradienceSDK` | 封装所有链上指令调用 |
| `process.argv` | 命令行参数解析（手写，无第三方框架） |

---

## 3. 文件结构

```
cli/
├── gradience.ts       — 全部实现（927 行，单文件）
│   ├── main()         — 入口，分发到 task/judge/config 子命令
│   ├── handleTaskCommand()    — task 子命令（450 行）
│   ├── handleJudgeCommand()   — judge 子命令
│   └── updateConfig()         — config set/get
├── gradience.test.ts  — CLI 集成测试（7.7K）
└── docs/
    ├── 03-technical-spec.md（本文）
    └── 05-test-spec.md
```

---

## 4. 命令结构

```
gradience <subcommand> [options]

config
  set <key> <value>       — 设置 rpc / keypair
  get <key>               — 读取配置项

task
  post      — 发布任务（指定 reward、deadline、judge、category、eval-ref）
  apply     — 申请任务（指定 task-id、stake）
  submit    — 提交结果（指定 task-id、result-ref）
  status    — 查询任务状态
  judge     — 评判任务并支付（指定 task-id、winner、score）
  cancel    — 取消任务（poster 主动）
  refund    — 退款（过期任务）

judge
  register  — 注册 Judge（指定 stake 金额、category）
  unstake   — 解除质押
```

---

## 5. 配置文件

路径：`~/.config/gradience/config.json`

```json
{
  "rpc": "https://api.mainnet-beta.solana.com",
  "keypair": "/path/to/keypair.json"
}
```

配置读取优先级（高 → 低）：
1. 命令行参数 `--rpc` / `--keypair`
2. 环境变量 `GRADIENCE_RPC_ENDPOINT` / `GRADIENCE_KEYPAIR`
3. `~/.config/gradience/config.json`
4. 默认值（`http://127.0.0.1:8899`）

---

## 6. 输出格式

- 默认：人类可读文本
- `--json` 标志：JSON 格式输出（供脚本消费）
- 错误：stderr，exit code 非 0

---

## 7. 接口契约

### → GradienceSDK（唯一依赖）
- 所有链上操作通过 `GradienceSDK` 实例调用
- SDK 封装 RPC 连接、指令构建、签名、广播

### → 用户 Keypair 文件
- 格式：64 字节整数 JSON 数组（Solana 标准格式）
- 路径通过 config / 参数指定，CLI 负责加载和签名
