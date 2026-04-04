# AgentM Web UI Fixes Roadmap

> 从分析报告到完全可用

## 视图状态总览

| View | Status | 主要问题 |
|------|--------|---------|
| Login | ✅ Working | - |
| Discover | ⚠️ Partial | Invite/Delegate 按钮无逻辑 |
| Task Market | ❌ Mock Data | MOCK_TASKS fallback |
| Feed | ✅ Working | 趋势标签硬编码（可接受） |
| Social | ⚠️ Partial | 无 Create Profile 链接 |
| Chat | ✅ Working | 依赖 daemon |
| Multi-Agent | ✅ Working | 依赖 daemon |
| My Agent | ⚠️ Partial | 链上注册可能静默失败 |
| Settings | ✅ Working | - |
| Dashboard | ❌ Hardcoded | 指标全是假的 |
| Profile Edit | ✅ Working | 依赖 daemon |
| Agents Create | ❌ Not Connected | console.log + alert() |

## 任务列表

### P0 - 阻塞

| ID | 问题 | 预估 |
|----|------|------|
| [[GRA-214]] | Task Market MOCK_TASKS fallback | 1-2h |

### P1 - 重要

| ID | 问题 | 预估 |
|----|------|------|
| [[GRA-216]] | Social 无 Create Profile 链接 | 0.5h |
| [[GRA-217]] | Agents Create 未连接后端 | 2-3h |
| [[GRA-218]] | Discover Invite/Delegate 按钮 | 1-2h |

### P2 - 清理

| ID | 问题 | 预估 |
|----|------|------|
| [[GRA-215]] | 清理死代码 (DEMO_DISCOVER_AGENTS 等) | 1h |

## 快速修复清单

```bash
# 1. Task Market - 移除 MOCK_TASKS
rg "MOCK_TASKS" apps/agentm-web/src/

# 2. Social - 添加 Create Profile 链接
# 在 SocialView 空状态添加 <Link href="/profile/edit">

# 3. Discover - 修复按钮
# 添加 onClick 逻辑

# 4. 清理死代码
rg "DEMO_DISCOVER_AGENTS" apps/agentm-web/src/
```

## 预估工作量

| 优先级 | 任务数 | 预估 |
|--------|--------|------|
| P0 | 1 | 1-2h |
| P1 | 3 | 3.5-5.5h |
| P2 | 1 | 1h |
| **总计** | **5** | **5.5-8.5h** |

## 未来功能（不在此次范围）

- Social "Probes" tab 实现
- Dashboard 连接真实数据
- On-chain agent registration 完善

## 相关文档

- [[SETTLEMENT_ROADMAP]] - 结算层（P0 依赖）
- [[DAEMON_ROADMAP]] - Daemon（后端依赖）
