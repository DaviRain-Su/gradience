# AgentM Pro - Task Breakdown (Phase 4)

## 1. 任务清单

### Sprint 1: Foundation (Week 1)

| ID | Task | Estimated | Dependencies | Owner |
|----|------|-----------|--------------|-------|
| S1-1 | 初始化项目 (copy from agentm-web) | 2h | - | Dev |
| S1-2 | 配置路由 (react-router-dom) | 2h | S1-1 | Dev |
| S1-3 | 设置 Zustand store | 2h | S1-1 | Dev |
| S1-4 | 实现 Layout 组件 (Sidebar + Header) | 4h | S1-2 | Dev |
| S1-5 | 集成 Privy 认证 | 4h | S1-1 | Dev |

**Sprint 1 交付:** 可运行的基础框架，支持登录

---

### Sprint 2: Profile 管理 (Week 2)

| ID | Task | Estimated | Dependencies | Owner |
|----|------|-----------|--------------|-------|
| S2-1 | ProfileForm 组件 | 6h | S1-4 | Dev |
| S2-2 | ProfileCard 组件 | 4h | S1-4 | Dev |
| S2-3 | ProfileCreateView | 4h | S2-1 | Dev |
| S2-4 | ProfileEditView | 4h | S2-1, S2-3 | Dev |
| S2-5 | useProfile hook (CRUD) | 6h | S1-3 | Dev |
| S2-6 | DashboardView (list profiles) | 4h | S2-2 | Dev |

**Sprint 2 交付:** 完整的 Profile CRUD 功能

---

### Sprint 3: Reputation & Stats (Week 3)

| ID | Task | Estimated | Dependencies | Owner |
|----|------|-----------|--------------|-------|
| S3-1 | ReputationScore 组件 | 6h | S1-4 | Dev |
| S3-2 | RevenueChart 组件 | 6h | S1-4 | Dev |
| S3-3 | StatsView | 4h | S3-1, S3-2 | Dev |
| S3-4 | useStats hook | 4h | S1-3 | Dev |
| S3-5 | SDK 集成测试 | 4h | S2-5, S3-4 | Dev |

**Sprint 3 交付:** 声誉评分和统计数据展示

---

### Sprint 4: Polish & Launch (Week 4)

| ID | Task | Estimated | Dependencies | Owner |
|----|------|-----------|--------------|-------|
| S4-1 | 错误处理 (toast notifications) | 4h | All | Dev |
| S4-2 | Loading 状态优化 | 4h | All | Dev |
| S4-3 | 移动端适配 | 6h | All | Dev |
| S4-4 | E2E 测试 | 6h | All | QA |
| S4-5 | 性能优化 | 4h | S4-4 | Dev |
| S4-6 | 部署到 pro.gradiences.xyz | 2h | S4-5 | Dev |

**Sprint 4 交付:** 生产就绪版本

---

## 2. 依赖图

```
Week 1:  Foundation
┌─────────┐    ┌─────────┐    ┌─────────┐
│ S1-1    │───▶│ S1-2    │───▶│ S1-4    │
│ Init    │    │ Router  │    │ Layout  │
└────┬────┘    └─────────┘    └────┬────┘
     │                              │
     │    ┌─────────┐    ┌─────────┐
     └───▶│ S1-3    │    │ S1-5    │
          │ Store   │    │ Privy   │
          └─────────┘    └─────────┘

Week 2:  Profile
              ┌─────────┐
         ┌───▶│ S2-1    │
         │    │ Form    │
         │    └────┬────┘
         │         │
         │    ┌────▼────┐    ┌─────────┐
         └───▶│ S2-3    │───▶│ S2-4    │
              │ Create  │    │ Edit    │
              └─────────┘    └─────────┘

Week 3:  Stats
┌─────────┐    ┌─────────┐    ┌─────────┐
│ S3-1    │    │ S3-2    │───▶│ S3-3    │
│ Reputation    Revenue  │    │ StatsView
└─────────┘    └─────────┘    └─────────┘
```

## 3. 里程碑

| 里程碑 | 日期 | 验收标准 |
|--------|------|----------|
| M1: Foundation | Week 1 结束 | 登录功能可用，基础布局完成 |
| M2: Profile MVP | Week 2 结束 | 可创建/编辑/查看 Profile |
| M3: Stats MVP | Week 3 结束 | 声誉和收入数据展示 |
| M4: Launch | Week 4 结束 | 部署到 pro.gradiences.xyz |

## 4. 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| SDK API 变更 | 中 | 高 | 与 SDK 团队保持沟通，预留缓冲时间 |
| Privy 集成问题 | 低 | 中 | 参考 agentm-web 实现，复用代码 |
| 性能问题 (大量数据) | 中 | 中 | 分页加载，虚拟列表 |

---
**Status:** Draft  
**Created:** 2026-04-03  
**Owner:** Product Manager
