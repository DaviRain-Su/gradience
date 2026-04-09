# 项目管理工具对比：Linear vs Obsidian

> 为 Gradience 项目选择合适的工具

---

## 📊 快速对比

| 维度            | **Linear**   | **Obsidian**  |
| --------------- | ------------ | ------------- |
| **类型**        | 云端项目管理 | 本地知识库    |
| **数据控制**    | 云端 ☁️      | 本地 💾       |
| **API 自动化**  | ✅ 完善      | ❌ 需插件     |
| **任务状态流**  | ✅ 原生支持  | ⚠️ 需模板     |
| **Markdown**    | ❌ 有限      | ✅ 原生       |
| **双向链接**    | ❌ 无        | ✅ 强大       |
| **图谱视图**    | ❌ 无        | ✅ 强大       |
| **与 Git 集成** | ✅ PR 关联   | ✅ 文件同库   |
| **Code Agent**  | ✅ 直接 API  | ⚠️ 需解析文件 |
| **看板视图**    | ✅ 原生      | ⚠️ 插件       |
| **离线使用**    | ⚠️ 有限      | ✅ 完全支持   |
| **协作**        | ✅ 实时      | ⚠️ Git 同步   |
| **费用**        | 免费版有限   | 免费个人版    |

---

## ✅ Linear 的优势（当前使用）

### 1. **专为软件开发设计**

- Issue 状态流转：Backlog → Todo → In Progress → Done
- 优先级系统（P0/P1/P2/P3）
- Sprint/Cycle 管理
- 与 GitHub/Codeberg PR 集成

### 2. **API 自动化（关键！）**

```bash
# Code Agent 可以直接读写
curl -H "Authorization: $LINEAR_API_KEY" \
  -d '{"query": "{ issues { nodes { title } } }"}'
```

**重要**: 你的 Code Agent 依赖这个 API 获取任务

### 3. **可视化**

- 看板视图
- 列表视图
- 甘特图（时间线）

### 4. **当前已投入**

- 118 个 Issues 已创建
- 51 个已完成
- 团队已熟悉流程

---

## ✅ Obsidian 的优势

### 1. **数据本地控制**

- 所有数据在本地 Markdown 文件
- 不依赖第三方服务
- Git 版本控制友好

### 2. **强大的知识管理**

```markdown
[[AgentM Pro]] 链接到其他文档 #任务/高优先级 标签系统
```

### 3. **图谱视图**

- 文档关系图谱
- 可视化知识结构
- 发现隐藏关联

### 4. **与代码库同位置**

```
project/
├── apps/
├── docs/          ← Obsidian vault
│   ├── 01-prd.md
│   ├── tasks/     ← 任务文件
│   └── ...
└── .obsidian/     ← Obsidian 配置
```

### 5. **Markdown 原生**

- 7-Phase 文档已经是 Markdown
- 无需格式转换
- 代码高亮、Mermaid 图表

---

## ❌ Obsidian 的挑战

### 1. **Code Agent 集成困难**

Linear API:

```bash
# 直接查询任务
curl linear.app/api "Get tasks for Agent"
```

Obsidian:

```bash
# 需要解析 Markdown 文件
grep -r "\[ \]" docs/tasks/  # 未完成任务
grep -r "\[x\]" docs/tasks/ # 已完成任务
```

**需要额外开发**:

- 任务解析脚本
- 状态更新脚本
- Code Agent 指令修改

### 2. **任务状态管理**

Linear: 点击按钮 → 状态变更
Obsidian: 手动编辑 Markdown

```markdown
<!-- Obsidian 任务格式 -->

- [ ] Task Name
    - status: in-progress
    - priority: P0
    - assignee: Code Agent
```

### 3. **协作复杂性**

Linear: 多人实时协作
Obsidian: Git 冲突解决

---

## 🎯 我的建议

### 方案 A: 混合使用（推荐 ⭐）

**Obsidian**: 知识管理 + 文档中心
**Linear**: 任务追踪 + Code Agent 集成

```
知识管理 (Obsidian)          任务追踪 (Linear)
├─ 7-Phase 文档              ├─ GRA-64 (Indexer)
├─ 架构图                    ├─ GRA-91 (Metaplex)
├─ 研究笔记                  └─ GRA-107 (SNS)
├─ 会议记录                       ↑
└─ 决策记录                       └─ Code Agent
```

**优点**:

- 保留 Linear 的自动化能力
- Obsidian 管理复杂知识
- 两者互补

**实施**:

1. 保持 Linear 任务不变
2. 创建 Obsidian vault 在 `docs/obsidian/`
3. 用 Obsidian 打开 `docs/` 目录
4. 链接 [[Linear Issue]] 到文档

---

### 方案 B: 迁移到 Obsidian（挑战）

如果坚持用 Obsidian 替代 Linear:

**需要开发**:

1. **任务格式标准**

```markdown
---
id: GRA-119
title: 'Implement SNS SDK'
status: todo
priority: P0
project: 'Agent Social'
created: 2026-04-03
---

# Implement SNS SDK

## Description

Integrate Bonfida SNS SDK for domain resolution...

## Checklist

- [ ] Research SNS API
- [ ] Implement resolve function
- [ ] Add tests
- [ ] Documentation

## Notes

[[SNS Research]]
```

2. **Code Agent 适配**

```bash
# 获取任务的脚本
./scripts/get-tasks.sh --priority P0 --status todo

# 更新任务状态
./scripts/update-task.sh GRA-119 --status done
```

3. **Obsidian 插件**

- Dataview: 任务查询
- Kanban: 看板视图
- Git: 自动同步

**优点**:

- 完全本地控制
- 统一 Markdown 工作流
- 强大的知识图谱

**缺点**:

- 需要开发时间（1-2 周）
- 失去 Linear 的便捷性
- 需要团队学习新流程

---

## 📋 决策矩阵

| 如果你的优先级是...   | 推荐工具 |
| --------------------- | -------- |
| **Code Agent 自动化** | Linear   |
| **数据本地控制**      | Obsidian |
| **快速启动**          | Linear   |
| **复杂知识管理**      | Obsidian |
| **团队协作**          | Linear   |
| **长期可持续性**      | Obsidian |
| **视觉化管理**        | Linear   |
| **Markdown 原生**     | Obsidian |

---

## 🚀 推荐实施方案

### 短期（保持 Linear）

1. 继续使用 Linear 管理 118 个任务
2. Code Agent 保持现有工作流
3. 创建 Obsidian vault 用于知识管理

### 中期（混合使用）

1. Obsidian: 管理 7-Phase 文档、架构图
2. Linear: 管理任务状态、Sprint
3. 在 Obsidian 中链接到 Linear Issues

### 长期（可选迁移）

1. 如果团队足够大，可以投资开发 Obsidian 工作流
2. 创建自定义插件和脚本
3. 完全本地化管理

---

## 💡 立即行动

### 如果你想试试 Obsidian:

```bash
# 1. 安装 Obsidian
# https://obsidian.md

# 2. 创建 vault 在项目中
mkdir -p docs/obsidian

# 3. 打开 vault
# File → Open Vault → Open folder as vault → select docs/

# 4. 创建任务索引
cat > docs/obsidian/00-dashboard.md << 'EOF'
# Project Dashboard

## Active Tasks (from Linear)
- [[Linear-GRA-64]] Chain Hub Indexer
- [[Linear-GRA-91]] Metaplex Research
- [[Linear-GRA-107]] SNS SDK Research

## Key Documents
- [[01-prd]] Product Requirements
- [[02-architecture]] System Architecture
- [[idea-agent-social]] Agent Social Idea

## Quick Links
- [Linear Board](https://linear.app/gradiences)
- [GitHub Repo](https://github.com/...)
EOF
```

---

## ❓ 关键问题

**问**: Code Agent 能否使用 Obsidian?
**答**: 可以，但需要开发文件解析脚本，不如 Linear API 直接。

**问**: 118 个任务如何迁移?
**答**: 可以写脚本导出 Linear → Markdown，但需要大量手工调整。

**问**: 团队成员怎么协作?
**答**: Obsidian + Git，但会有冲突；Linear 更顺畅。

---

## 🎯 我的最终建议

**保持 Linear，添加 Obsidian 作为知识层**。

理由:

1. 你已有 118 个任务在 Linear
2. Code Agent 依赖 Linear API
3. Obsidian 更适合文档和知识
4. 两者结合 = 最佳效果

---

_分析完成: 2026-04-03_
