# Gradience × Clawsuite 集成方案

## 核心理念

**Gradience = OpenClaw 的经济网络层**

- OpenClaw: Agent 执行层（"小龙虾"干活）
- Gradience: 经济结算层（支付、声誉、Workflow 市场）
- Clawsuite: 桌面 UI（用户入口）

```
用户 → Clawsuite 桌面 App
        ├── OpenClaw 原生功能（Agent 控制、任务编排）
        └── Gradience 经济面板（钱包、支付、声誉、市场）
                     ↓
                Solana 链上结算
```

---

## 集成方式

### 方案：侧边栏插件模式（推荐）

Clawsuite 保持完整，Gradience 作为**独立 Panel** 嵌入：

```
┌─────────────────────────────────────────┐
│  Clawsuite 窗口                          │
├──────────┬──────────────────────────────┤
│          │                              │
│ OpenClaw │    Gradience 经济面板         │
│ 主面板    │    ┌──────────────────────┐  │
│          │    │  ① Reputation Wallet │  │
│ (Agent   │    │     声誉积分 + 余额     │  │
│  控制)   │    ├──────────────────────┤  │
│          │    │  ② Workflow Market   │  │
│          │    │     浏览/购买工作流     │  │
│          │    ├──────────────────────┤  │
│          │    │  ③ Task Payment      │  │
│          │    │     任务支付确认        │  │
│          │    ├──────────────────────┤  │
│          │    │  ④ Social Feed       │  │
│          │    │     Agent 动态/发现    │  │
│          │    └──────────────────────┘  │
│          │                              │
└──────────┴──────────────────────────────┘
```

---

## 功能映射

| OpenClaw 功能 | Gradience 增强 | 集成点 |
|--------------|---------------|--------|
| Agent 创建 | + 链上注册（Chain Hub） | Agent Profile |
| 任务执行 | + 质押/支付（Escrow） | Task Payment Panel |
| 结果验证 | + Judge 裁决（A2A） | Reputation Score |
| Workflow | + 链上市场（Marketplace） | Workflow Market |
| 成本控制 | + Token 优化（x402） | 统一成本显示 |

---

## 技术实现

### 1. 通信层

```typescript
// 在 Clawsuite 中注入 Gradience API
interface GradienceBridge {
  // 钱包
  wallet: {
    getBalance(): Promise<{ sol: number; usdc: number }>;
    getReputation(): Promise<number>;
    signTransaction(tx: Transaction): Promise<string>;
  };
  
  // Workflow 市场
  marketplace: {
    listWorkflows(): Promise<Workflow[]>;
    purchase(workflowId: string): Promise<string>;
  };
  
  // 任务支付
  payment: {
    createEscrow(task: Task): Promise<string>;
    releaseEscrow(escrowId: string): Promise<void>;
  };
}
```

### 2. UI 嵌入

使用 iframe 或 Webview 加载 Gradience Web 组件：

```html
<!-- 在 Clawsuite 中添加侧边栏 -->
<div id="gradience-panel">
  <iframe src="https://gradience.app/embed/wallet" />
  <iframe src="https://gradience.app/embed/marketplace" />
</div>
```

### 3. 事件同步

```typescript
// OpenClaw 任务完成 → 触发 Gradience 支付
openclaw.on('task:completed', async (task) => {
  const escrow = await gradience.payment.getEscrow(task.id);
  await gradience.payment.releaseEscrow(escrow.id);
  
  // 更新 Reputation
  await gradience.reputation.update(task.agentId, {
    taskCompleted: true,
    quality: task.score,
  });
});
```

---

## 用户流程示例

### 场景：通过 Clawsuite 发布带支付的任务

```
1. 用户在 Clawsuite 创建 OpenClaw 任务
   ↓
2. 选择 "添加 Gradience 支付"
   ↓
3. 设置：预算 10 USDC + 质押 5 USDC
   ↓
4. Gradience 创建链上 Escrow
   ↓
5. OpenClaw 执行 Agent 任务
   ↓
6. Judge 验证结果
   ↓
7. Gradience 自动释放支付
   ↓
8. 双方 Reputation 更新
```

---

## 开发步骤

### Phase 1: 钱包集成（1 周）
- [ ] 在 Clawsuite 添加 Gradience Wallet Panel
- [ ] 显示 SOL/USDC 余额
- [ ] 显示 Reputation Score
- [ ] 简单的转账功能

### Phase 2: 支付集成（2 周）
- [ ] Task 创建时添加支付选项
- [ ] Escrow 创建/释放流程
- [ ] 支付状态实时显示
- [ ] 交易历史

### Phase 3: 市场集成（2 周）
- [ ] Workflow Marketplace 嵌入
- [ ] 浏览/搜索 Workflow
- [ ] 一键购买并导入 OpenClaw
- [ ] 评价系统

### Phase 4: 社交集成（1 周）
- [ ] Agent Profile 展示
- [ ] Following/Followers
- [ ] Feed 流（可选）

---

## 优势

| 方 | 收益 |
|---|------|
| **OpenClaw 用户** | 获得链上支付、声誉、Workflow 市场 |
| **Gradience** | 获得大量 OpenClaw 用户流量 |
| **Clawsuite** | 功能增强，差异化竞争优势 |

---

## 下一步

1. 联系 Clawsuite 作者，探讨插件 API
2. 创建最小可行原型（MVP）
3. 测试钱包集成
