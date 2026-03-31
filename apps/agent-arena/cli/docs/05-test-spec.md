# Phase 5: Test Spec — agent-arena/cli

---

## 1. 当前测试文件

| 文件 | 行数 | 测试内容 | 状态 |
|------|------|---------|------|
| `gradience.test.ts` | 234 行 | CLI 全命令集成测试 | ✅ |

---

## 2. 运行方式

```bash
# 在 apps/agent-arena/ 目录执行（通过 package.json 脚本）
pnpm run test:cli
# 等价于：tsx --test ./cli/gradience.test.ts
```

---

## 3. 覆盖要求

### 已覆盖（✅）

| 场景 | 说明 |
|------|------|
| `help` 列出 config 命令 | ✅ |
| `config set rpc` 写配置文件 | ✅ |
| `task post` 输出结构化 signature payload | ✅ |
| `task apply` 输出结构化 signature payload | ✅ |
| `task submit` 输出结构化 signature payload | ✅ |
| `task status` 输出纯 JSON | ✅ |
| `task judge` 输出 signature + winner + score | ✅ |
| `task cancel` 输出退款 signature | ✅ |
| `task refund` 输出退款 signature | ✅ |
| 无效参数返回机器可读错误（NO_DNA 模式） | ✅ |
| `--json` 输出格式 | ✅ |

### 缺失（P0）

| 场景 | 说明 |
|------|------|
| keypair 文件不存在时的错误提示 | 用户体验 |
| RPC 不可达时的错误提示 | 网络故障处理 |

### 缺失（P1）

| 场景 | 说明 |
|------|------|
| 配置文件不存在时自动创建 | 首次使用体验 |
| 配置优先级（参数 > 环境变量 > 文件） | 优先级正确性 |

---

## 4. 测试策略

- **NO_DNA 模式**：环境变量 `NO_DNA=1` 跳过真实链上调用，直接返回 mock signature payload
- **输出断言**：验证 stdout JSON 结构（字段存在性、类型）
- **文件系统**：config 读写测试使用临时目录（`~/.gradience/config.json`）
