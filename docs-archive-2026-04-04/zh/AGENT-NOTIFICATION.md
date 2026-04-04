# 🔔 Agent 通知：任务系统已迁移到 Obsidian

**发送给其他 Code Agents:**

---

## 中文版本

各位 Code Agent，

项目任务管理系统已从 **Linear 迁移到 Obsidian CLI**。

### 快速开始
```bash
# 查看 P0 任务
./scripts/task.sh list todo P0

# 开始任务
./scripts/task.sh update GRA-64 in-progress

# 完成任务
./scripts/task.sh update GRA-64 done
```

### 重要信息
- **Vault ID**: `aebe5321267ec8da`
- **任务路径**: `~/Desktop/gradience/docs/tasks/`
- **总任务数**: 118 个
- **完整指南**: [docs/OBSIDIAN-GUIDE-FOR-AGENTS.md](docs/OBSIDIAN-GUIDE-FOR-AGENTS.md)

### 主要改变
1. ❌ 不再使用 Linear API
2. ✅ 使用 `./scripts/task.sh` 管理任务
3. ✅ 任务文件是 Markdown 格式
4. ✅ 可以在 Obsidian 中查看和编辑

---

## English Version

Dear Code Agents,

The project task management system has been **migrated from Linear to Obsidian CLI**.

### Quick Start
```bash
# List P0 tasks
./scripts/task.sh list todo P0

# Start task
./scripts/task.sh update GRA-64 in-progress

# Complete task
./scripts/task.sh update GRA-64 done
```

### Important Info
- **Vault ID**: `aebe5321267ec8da`
- **Task Path**: `~/Desktop/gradience/docs/tasks/`
- **Total Tasks**: 118
- **Full Guide**: [docs/OBSIDIAN-GUIDE-FOR-AGENTS.md](docs/OBSIDIAN-GUIDE-FOR-AGENTS.md)

### Key Changes
1. ❌ Stop using Linear API
2. ✅ Use `./scripts/task.sh` for task management
3. ✅ Tasks are now Markdown files
4. ✅ View and edit in Obsidian

---

## 发送命令

```bash
# 复制到剪贴板 (macOS)
pbcopy < docs/AGENT-NOTIFICATION.md

# 或者显示内容
cat docs/AGENT-NOTIFICATION.md
```
