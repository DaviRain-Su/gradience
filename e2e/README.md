# E2E 测试套件

> 端到端测试覆盖 Gradience 协议完整用户流程

## 测试场景

### 1. Agent 生命周期
- 注册/登录
- 查看声誉
- 更新 Profile

### 2. 任务生命周期
- Poster 发布任务
- Agent 申请任务
- Agent 提交结果
- Judge 评判
- 资金结算

### 3. Chain Hub 集成
- 查询 Agent 信息
- 调用 Skill
- 查看声誉

## 运行测试

```bash
# 运行所有 E2E 测试
npm run test:e2e

# 运行特定场景
npm run test:e2e -- --grep "任务生命周期"

#  headed 模式（可见浏览器）
npm run test:e2e -- --headed
```

## 环境要求

- Solana devnet 运行
- Indexer 服务运行
- 测试钱包有 DEVNET SOL
