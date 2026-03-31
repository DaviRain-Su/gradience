# Phase 5: Test Spec — agent-arena/cli

---

## 1. 当前测试文件

| 文件 | 代码量 | 测试内容 | 状态 |
|------|--------|---------|------|
| `gradience.test.ts` | 7.7K | CLI 命令集成测试 | ✅ |

---

## 2. 运行方式

```bash
cd apps/agent-arena/cli
bun test gradience.test.ts
```

---

## 3. 覆盖要求

### 已覆盖（推测，基于文件大小）
- config set/get
- task post / apply / submit / status
- judge register / unstake
- --json 输出格式

### 缺失（P0）

| 场景 | 说明 |
|------|------|
| keypair 文件不存在时的错误提示 | 用户体验 |
| RPC 不可达时的错误提示 | 网络故障处理 |
| task judge（评判并支付）命令 | 核心功能 |
| task cancel / refund 命令 | 退款路径 |

### 缺失（P1）

| 场景 | 说明 |
|------|------|
| 配置文件不存在时自动创建 | 首次使用体验 |
| 配置优先级（参数 > 环境变量 > 文件） | 优先级正确性 |
| 无效参数的错误提示 | 参数校验 |

---

## 4. 测试策略

- **链上调用 mock**：通过 mock GradienceSDK，CLI 测试不实际发送交易
- **文件系统**：config 读写测试使用临时目录
- **输出断言**：验证 stdout 格式（text / json 模式）
