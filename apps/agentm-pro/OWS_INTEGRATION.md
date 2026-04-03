# OWS 集成到 AgentM Pro

## 🎯 概述

将 OWS (OpenWallet Standard) 身份 + 声誉系统集成到 AgentM Pro，作为核心功能模块。

---

## 📁 集成文件

```
apps/agentm-pro/
├── src/
│   ├── lib/
│   │   └── identity/           # 新增: OWS 身份模块
│   │       ├── agent.ts        # Agent 身份服务
│   │       └── reputation.ts   # 声誉服务
│   ├── app/
│   │   └── api/
│   │       └── agents/         # API 路由
│   │           ├── route.ts
│   │           └── [name]/
│   │               └── reputation/
│   │                   └── route.ts
│   └── views/
│       └── identity/
│           └── AgentIdentityView.tsx  # UI 组件
└── OWS_INTEGRATION.md          # 本文件
```

---

## ✨ 功能特性

### 1. Agent 身份管理
- ENS 名称注册 (`agent-name.ows.eth`)
- 多链钱包地址 (ETH, SOL, BTC)
- 与 Privy 用户绑定

### 2. 声誉系统
- 分数 0-100
- 等级: Bronze/Silver/Gold/Platinum
- 任务完成记录
- 声誉提升解锁更多权限

### 3. 策略引擎
- 基于声誉的钱包限额
- 子钱包继承策略
- 权限控制

---

## 🔌 API 端点

### 获取用户的 Agents
```http
GET /api/agents?ownerId={privy_user_id}
```

### 创建 Agent
```http
POST /api/agents
{
  "ownerId": "...",
  "name": "trading-agent",
  "chains": ["ethereum", "solana"]
}
```

### 获取声誉
```http
GET /api/agents/{name}/reputation
```

### 记录任务
```http
POST /api/agents/{name}/reputation
{
  "score": 5,
  "amount": 100
}
```

---

## 🎨 UI 组件

### AgentIdentityView

展示：
- Agent 列表
- 声誉分数和等级
- 钱包限额
- 任务统计
- 创建新 Agent

---

## 🚀 使用方式

### 在 AgentM Pro 中访问

1. 导航到 Identity 页面
2. 查看现有 Agents
3. 创建新 Agent
4. 查看声誉和限额

### 在 Chat 中使用

```typescript
// 使用特定 Agent 进行对话
const response = await chatWithAgent({
  agentName: "trading-agent.ows.eth",
  message: "分析市场趋势"
});

// Agent 声誉影响权限
if (agent.reputation.score > 80) {
  // 可以执行高风险交易
}
```

---

## 🔗 黑客松提交

### 提交内容

AgentM Pro 项目，包含 OWS 集成：

1. **身份层**: ENS + 多链钱包
2. **声誉层**: 任务评分系统
3. **策略层**: 基于声誉的权限控制
4. **UI 层**: 完整的身份管理界面

### 演示流程

1. 打开 AgentM Pro
2. 进入 Identity 页面
3. 创建 Agent (`trading-agent.ows.eth`)
4. 查看初始声誉 (50, Bronze)
5. 使用 Agent 完成任务
6. 声誉提升，解锁更高限额

---

## ✅ 与黑客松要求的对应

| 黑客松要求 | 实现方式 |
|-----------|---------|
| OWS 身份 | Agent ENS 注册 |
| 多链支持 | ETH, SOL, BTC 地址 |
| 声誉系统 | 0-100 分数 + 等级 |
| Wallet-per-Agent | 每个 Agent 独立钱包 |
| 策略引擎 | 基于声誉的限额控制 |

---

**状态**: ✅ 集成完成，可提交黑客松！
