# Gradience 项目仪表盘

> Obsidian 知识库仪表盘  
> 最后更新: 2026-04-03

---

## 🚀 代码代理快速入门

**新功能:** 任务已从 Linear 迁移到 Obsidian！

```bash
# 获取你的 P0 任务
./scripts/task.sh list todo P0

# 开始工作
./scripts/task.sh update GRA-64 in-progress

# 标记完成
./scripts/task.sh update GRA-64 done
```

**📖 完整指南:** [[OBSIDIAN-GUIDE-FOR-AGENTS]]

---

---

## 📊 项目统计

```dataview
TABLE priority, status, project
FROM "tasks"
WHERE status != "done"
SORT priority ASC, file.name ASC
```

---

## 🔴 P0 - 关键（优先处理）

```dataview
LIST
FROM "tasks"
WHERE priority = "P0" AND status != "done"
SORT file.name ASC
```

### 关键阻塞项
- [[GRA-64]] Chain Hub Indexer Profile API
- [[GRA-91]] Metaplex Agent Kit 研究
- [[GRA-70]] EVM cancel_task

---

## 🟡 P1 - 高优先级

```dataview
LIST
FROM "tasks"
WHERE priority = "P1" AND status = "todo"
LIMIT 10
```

---

## 🏆 活跃黑客松

### 💎 Metaplex Agents 赛道 ($5,000)
- [[GRA-91]] 研究 Metaplex Agent Kit
- [[GRA-92]] 集成 Agent Kit
- [[GRA-93]] 在 Solana 上注册 Agent
- [[GRA-94]] 发布 Agent 代币
- [[GRA-95]] 构建 A2A 交互
- [[GRA-96]] 集成 Chain Hub 声誉系统 ⭐
- [[GRA-97]] 创建演示
- [[GRA-98]] X 文章 & 提交

### 📊 GoldRush Agentic 赛道 ($500)
- [[GRA-99]] 研究 GoldRush API
- [[GRA-100]] 钱包风险评分
- [[GRA-104]] 交易对手信任评分
- [[GRA-105]] Chain Hub 集成

---

## 📁 快速链接

### 文档
- [[01-prd]] 产品需求文档
- [[02-architecture]] 系统架构
- [[03-technical-spec]] 技术规格
- [[methodology/README|开发方法论]]

### 项目分析
- [[project-analysis-2026-04-03|项目分析]]
- [[project-progress-report-2026-04-03|进度报告]]
- [[hackathon-comparison-2026-04-03|黑客松对比]]
- [[execution-dashboard|执行仪表盘]]

### 想法
- [[idea-agent-social-domain-analysis|Agent 社交 + Web3 域名]]
- [[obsidian-cli-integration-plan|Obsidian CLI 迁移计划]]

### 经验报告
- [[experience-reports/2026-04-03-website-deployment|网站部署]]
- [[experience-reports/2026-04-03-agentm-web-white-screen|AgentM Web Bug]]

---

## 🚀 入门指南

### 面向代码代理

1. **检查任务**
   ```bash
   ./scripts/task.sh list todo P0
   ```

2. **选择任务**
   ```bash
   ./scripts/task.sh show GRA-64
   ```

3. **开始工作**
   ```bash
   ./scripts/task.sh update GRA-64 in-progress --open
   ```

4. **标记完成**
   ```bash
   ./scripts/task.sh update GRA-64 done
   ```

### 任务命令

| 命令 | 描述 |
|---------|-------------|
| `task.sh list` | 列出所有任务 |
| `task.sh list todo P0` | 列出 P0 待办任务 |
| `task.sh show GRA-64` | 显示任务详情 |
| `task.sh update GRA-64 done` | 标记为完成 |
| `task.sh create "标题" P0 "项目"` | 创建新任务 |
| `task.sh stats` | 显示统计 |

---

## 📈 模块状态

| 模块 | 状态 | 完成度 |
|--------|--------|------------|
| AgentM Pro | ✅ 完成 | 100% |
| AgentM Web | ✅ 完成 | 100% |
| P0 修复 | ✅ 完成 | 100% |
| Agent Arena | 🟡 进行中 | 83% |
| A2A Protocol | 🟡 进行中 | 57% |
| Chain Hub | 🟡 进行中 | 71% |
| Agent Layer EVM | 🔴 阻塞 | 44% |
| AgentM Core | 🔴 未开始 | 0% |

---

## 🎯 本周目标

- [ ] [[GRA-64]] Indexer API 设计
- [ ] [[GRA-91]] Metaplex 研究
- [ ] [[GRA-92]] Metaplex 集成
- [ ] [[GRA-70]] EVM cancel_task

---

*使用 `Cmd/Ctrl + 点击` 在笔记间导航*
