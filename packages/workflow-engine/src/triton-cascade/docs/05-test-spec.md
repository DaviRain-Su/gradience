# Phase 5: Test Spec - Triton Cascade Integration

> **项目**: Triton Cascade 交易投递网络集成
> **文档状态**: Ready for Implementation

---

## 5.1 单元测试

### 5.1.1 错误类测试 (`errors.test.ts`)

| 测试用例         | 输入                                                | 预期输出                         | 验证点       |
| ---------------- | --------------------------------------------------- | -------------------------------- | ------------ |
| 创建基本错误     | `new CascadeError('CASCADE_001')`                   | 错误实例，code=CASCADE_001       | 错误码正确   |
| 创建带消息的错误 | `new CascadeError('CASCADE_001', 'custom message')` | 错误实例，message=custom message | 自定义消息   |
| 创建可重试错误   | `new CascadeError('CASCADE_001', '', true)`         | 错误实例，retryable=true         | 可重试标记   |
| 创建不可重试错误 | `new CascadeError('CASCADE_003')`                   | 错误实例，retryable=false        | 不可重试标记 |
| 错误序列化       | `error.toJSON()`                                    | JSON 对象                        | 序列化正确   |

### 5.1.2 配置模块测试 (`config.test.ts`)

| 测试用例     | 输入                       | 预期输出             | 验证点           |
| ------------ | -------------------------- | -------------------- | ---------------- |
| 默认配置     | `createDefaultConfig()`    | 完整配置对象         | 所有字段有默认值 |
| 环境变量解析 | 设置 `TRITON_RPC_ENDPOINT` | 配置中使用该值       | 环境变量生效     |
| 配置验证     | 无效端点 URL               | 抛出 ValidationError | 参数校验         |
| 配置合并     | 部分自定义配置             | 合并后的完整配置     | 深度合并正确     |

### 5.1.3 队列管理测试 (`queue.test.ts`)

| 测试用例       | 输入                   | 预期输出               | 验证点   |
| -------------- | ---------------------- | ---------------------- | -------- |
| 添加交易到队列 | 单个交易请求           | 队列长度=1             | 正确入队 |
| 并发控制       | 15 个并发请求，限制 10 | 10 个处理中，5 个等待  | 背压生效 |
| 优先级排序     | 高优先级和低优先级交易 | 高优先级先处理         | 排序正确 |
| 重试调度       | 失败交易，retryCount=1 | 计算正确的下次重试时间 | 退避算法 |
| 队列清空       | `clear()` 调用         | 队列长度=0             | 清空正确 |
| 重复交易检测   | 相同签名交易           | 拒绝重复添加           | 幂等性   |

### 5.1.4 健康监控测试 (`health-monitor.test.ts`)

| 测试用例     | 输入            | 预期输出                | 验证点   |
| ------------ | --------------- | ----------------------- | -------- |
| 健康检查成功 | 端点响应正常    | 状态=healthy，latency>0 | 检测正确 |
| 健康检查失败 | 端点无响应      | 状态=unhealthy          | 故障检测 |
| 连续失败熔断 | 3 次连续失败    | 触发 fallback           | 熔断机制 |
| 恢复检测     | 失败后恢复      | 状态回到 healthy        | 恢复检测 |
| 延迟计算     | 模拟 100ms 延迟 | latency≈100ms           | 延迟准确 |

### 5.1.5 费用估算测试 (`fee-estimator.test.ts`)

| 测试用例           | 输入             | 预期输出      | 验证点   |
| ------------------ | ---------------- | ------------- | -------- |
| 获取费用估算       | 正常网络         | 返回估算对象  | 数据正确 |
| 缓存命中           | 5 秒内第二次调用 | 返回缓存数据  | 缓存生效 |
| 缓存过期           | 5 秒后调用       | 重新获取数据  | 缓存刷新 |
| 费用计算策略 auto  | 拥堵网络         | 返回 veryHigh | 策略正确 |
| 费用计算策略 fixed | 设置固定值       | 返回固定值    | 策略正确 |
| API 失败降级       | API 返回错误     | 使用默认值    | 优雅降级 |

### 5.1.6 客户端核心测试 (`client.test.ts`)

| 测试用例     | 输入           | 预期输出     | 验证点     |
| ------------ | -------------- | ------------ | ---------- |
| 客户端创建   | 有效配置       | 客户端实例   | 初始化正确 |
| 发送交易成功 | 有效交易       | 成功响应     | 流程正确   |
| 发送交易失败 | 无效交易       | 抛出错误     | 错误处理   |
| 重试机制     | 临时失败       | 自动重试成功 | 重试逻辑   |
| 最大重试     | 持续失败       | 抛出最终错误 | 重试上限   |
| 关闭客户端   | `close()` 调用 | 资源释放     | 清理正确   |

---

## 5.2 集成测试

### 5.2.1 完整交易流程 (`integration.test.ts`)

**测试环境**: Solana Devnet
**前置条件**:

- 有效的 Triton API Token (或跳过认证测试)
- 有资金的测试钱包

| 测试用例       | 步骤                                                   | 预期结果       | 验证点         |
| -------------- | ------------------------------------------------------ | -------------- | -------------- |
| SOL 转账       | 1. 创建转账交易<br>2. 发送到 Cascade<br>3. 等待确认    | 交易成功上链   | 签名有效       |
| SPL Token 转账 | 1. 创建 Token 转账<br>2. 发送到 Cascade<br>3. 等待确认 | 交易成功上链   | Token 余额变化 |
| 优先费用估算   | 调用 getPriorityFeeEstimate                            | 返回有效估算值 | 数值合理       |
| 健康状态查询   | 调用 getHealthStatus                                   | 返回健康状态   | 延迟可接受     |

### 5.2.2 Jito Bundle 集成测试

| 测试用例        | 步骤                                               | 预期结果       | 验证点       |
| --------------- | -------------------------------------------------- | -------------- | ------------ |
| Bundle 发送成功 | 1. 启用 Jito<br>2. 发送交易<br>3. 查询 Bundle 状态 | Bundle 被接受  | MEV 保护生效 |
| Bundle 失败降级 | 1. 模拟 Jito 失败<br>2. 发送交易                   | 降级到标准 RPC | 优雅降级     |
| Bundle 超时     | 设置极短超时                                       | 正确处理超时   | 超时处理     |

### 5.2.3 故障恢复测试

| 测试用例     | 步骤                                      | 预期结果   | 验证点   |
| ------------ | ----------------------------------------- | ---------- | -------- |
| 网络中断恢复 | 1. 断开网络<br>2. 发送交易<br>3. 恢复网络 | 重试后成功 | 恢复能力 |
| 区块哈希过期 | 1. 使用旧区块哈希<br>2. 发送交易          | 正确报错   | 过期检测 |
| 余额不足     | 尝试发送超过余额的交易                    | 正确报错   | 余额检查 |

---

## 5.3 Mock 数据

### 5.3.1 模拟交易

```typescript
// 有效的测试交易 (base64)
const MOCK_VALID_TRANSACTION =
    'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA...';

// 无效的测试交易
const MOCK_INVALID_TRANSACTION = 'invalid_base64_data';

// 模拟签名
const MOCK_SIGNATURE = '5VERm3jR1m7K5vK5vK5vK5vK5vK5vK5vK5vK5vK5vK5vK5vK5vK5vK5vK5vK5vK5vK5vK5vK5vK5vK5vK5vK5vK5vK5v';
```

### 5.3.2 模拟响应

```typescript
// 成功的 RPC 响应
const MOCK_RPC_SUCCESS_RESPONSE = {
    jsonrpc: '2.0',
    id: 1,
    result: 'transaction_signature_hash',
};

// 失败的 RPC 响应
const MOCK_RPC_ERROR_RESPONSE = {
    jsonrpc: '2.0',
    id: 1,
    error: {
        code: -32002,
        message: 'Transaction simulation failed',
    },
};

// 优先费用估算响应
const MOCK_FEE_ESTIMATE_RESPONSE = {
    recommended: 10000,
    min: 5000,
    medium: 10000,
    high: 20000,
    veryHigh: 50000,
    timestamp: Date.now(),
};
```

---

## 5.4 测试覆盖率目标

| 模块              | 目标覆盖率 | 关键路径          |
| ----------------- | ---------- | ----------------- |
| errors.ts         | 100%       | 所有错误类型      |
| config.ts         | 100%       | 配置验证          |
| queue.ts          | 90%        | 并发控制、重试    |
| health-monitor.ts | 90%        | 健康检查、熔断    |
| fee-estimator.ts  | 90%        | 费用计算、缓存    |
| jito-bundle.ts    | 85%        | Bundle 发送、降级 |
| client.ts         | 90%        | 发送交易、确认    |
| **总体**          | **90%**    | -                 |

---

## 5.5 测试执行命令

```bash
# 运行所有测试
pnpm test

# 运行特定模块测试
pnpm test triton-cascade

# 运行单元测试
pnpm test:unit

# 运行集成测试 (需要环境变量)
TRITON_API_TOKEN=xxx pnpm test:integration

# 生成覆盖率报告
pnpm test:coverage

# 运行带调试信息的测试
DEBUG=triton-cascade:* pnpm test
```

---

## 5.6 CI/CD 集成

```yaml
# .github/workflows/test-triton-cascade.yml
name: Test Triton Cascade

on:
    push:
        paths:
            - 'packages/workflow-engine/src/triton-cascade/**'
    pull_request:
        paths:
            - 'packages/workflow-engine/src/triton-cascade/**'

jobs:
    test:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v2
            - name: Install dependencies
              run: pnpm install
            - name: Run unit tests
              run: pnpm test:unit
            - name: Run integration tests
              env:
                  TRITON_API_TOKEN: ${{ secrets.TRITON_API_TOKEN }}
              run: pnpm test:integration
            - name: Upload coverage
              uses: codecov/codecov-action@v3
```

---

## ✅ Phase 5 验收标准

- [ ] 所有单元测试用例编写完成
- [ ] 所有集成测试用例编写完成
- [ ] Mock 数据准备完成
- [ ] 测试覆盖率目标设定 (90%)
- [ ] CI/CD 配置完成
- [ ] 测试可以在本地和 CI 环境中运行

**验收通过后，进入 Phase 6: Implementation →**
