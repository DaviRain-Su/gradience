# Obsidian 任务系统 - Code Agent 快速指南

> **迁移完成**: 所有任务已从 Linear 迁移到 Obsidian  
> **Vault ID**: `aebe5321267ec8da`  
> **路径**: `~/Desktop/gradience/docs/tasks/`

---

## 🚀 30 秒快速开始

```bash
# 1. 查看你的任务（按优先级）
./scripts/task.sh list todo P0

# 2. 开始执行任务
./scripts/task.sh update GRA-64 in-progress

# 3. 完成任务
./scripts/task.sh update GRA-64 done
```

---

## 📋 常用命令

| 命令                                          | 说明         |
| --------------------------------------------- | ------------ |
| `./scripts/task.sh list`                      | 列出所有任务 |
| `./scripts/task.sh list todo`                 | 待办任务     |
| `./scripts/task.sh list todo P0`              | P0 待办任务  |
| `./scripts/task.sh list in-progress`          | 进行中任务   |
| `./scripts/task.sh show GRA-64`               | 查看任务详情 |
| `./scripts/task.sh update GRA-64 in-progress` | 标记为进行中 |
| `./scripts/task.sh update GRA-64 done`        | 标记为完成   |
| `./scripts/task.sh stats`                     | 查看统计     |

---

## 🎯 工作流

### 1. 获取任务

```bash
# 获取 P0 任务
./scripts/task.sh list todo P0 | head -1

# 输出示例:
# [P0] [todo]       GRA-64: [Indexer] Design Profile API specification
```

### 2. 阅读任务详情

```bash
./scripts/task.sh show GRA-64
```

### 3. 开始工作

```bash
./scripts/task.sh update GRA-64 in-progress
```

### 4. 完成任务

```bash
./scripts/task.sh update GRA-64 done
```

### 5. Git 提交

```bash
git commit -m "feat: implement feature (GRA-64)"
```

---

## 📝 任务文件格式

任务存储在 `~/Desktop/gradience/docs/tasks/GRA-XX.md`:

```markdown
---
linear-id: GRA-64
title: '[Indexer] Design Profile API specification'
status: in-progress # todo | in-progress | done
priority: P0 # P0 | P1 | P2 | P3
project: 'Chain Hub Indexer'
created: 2026-04-03
assignee: 'Code Agent'
tags: [task, p0, chain-hub-indexer]
---

# GRA-64: [Indexer] Design Profile API specification

## Description

Design Indexer Profile API specification

## Acceptance Criteria

- [ ] Research complete
- [ ] API design documented
- [ ] Review passed

## Related

- [[GRA-65]] Next task
- [[docs/03-technical-spec]] Reference

## Notes

## Log

- 2026-04-03: Migrated from Linear
- 2026-04-03: Status changed to "in-progress"
```

---

## 🔍 查找任务

### 按项目

```bash
# 查找 Chain Hub 相关任务
./scripts/task.sh list all all "Chain Hub"

# 查找 Metaplex 相关任务
./scripts/task.sh list all all "Metaplex"
```

### 搜索内容

```bash
./scripts/task.sh search "indexer"
```

---

## ⚡ 快捷方式

添加到 `.bashrc` 或 `.zshrc`:

```bash
alias tasks='./scripts/task.sh'
alias my-tasks='./scripts/task.sh list todo P0'
alias task-done='./scripts/task.sh update'
```

然后:

```bash
tasks list todo P0      # 列出 P0 任务
my-tasks                 # 快捷方式
task-done GRA-64 done    # 完成任务
```

---

## 🆘 故障排除

### 任务脚本找不到

```bash
# 确保在项目根目录
cd ~/projects/gradience  # 或你的项目路径
chmod +x scripts/task.sh
```

### Obsidian 没有打开

```bash
# 手动打开 vault
open "obsidian://open?vault=aebe5321267ec8da"
```

### 任务文件不存在

```bash
# 检查 vault 路径
ls ~/Desktop/gradience/docs/tasks/
```

---

## 📊 项目状态概览

```bash
./scripts/task.sh stats
```

输出示例:

```
Task Statistics:
================
Total tasks:        118
  Todo:              24
  In Progress:       13
  Done:              81

By Priority:
  P0:        4
  P1:       34
  P2:       51
  P3:       29
```

---

## 🔗 相关文档

- [AGENTS.md](../AGENTS.md) - 完整 Agent 指南
- [00-dashboard.md](00-dashboard.md) - 项目 Dashboard
- [obsidian-cli-integration-plan.md](obsidian-cli-integration-plan.md) - 迁移计划

---

**开始使用**: `./scripts/task.sh list todo P0`
