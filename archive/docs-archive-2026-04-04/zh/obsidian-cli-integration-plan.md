# Obsidian CLI 集成方案

> 使用 Obsidian CLI 替代 Linear 管理 Gradience 项目

---

## 🎉 Obsidian CLI 现已可用

Obsidian 1.12+ 版本新增了官方 CLI 支持！

### CLI 基本功能

```bash
# 打开 Obsidian
obsidian

# 打开特定 vault
obsidian ~/projects/gradiences/docs

# 打开特定文件
obsidian ~/projects/gradiences/docs/01-prd.md

# URI 协议支持
obsidian://open?vault=gradiences&file=01-prd
```

---

## 🚀 迁移方案：Linear → Obsidian CLI

### 第 1 步：任务格式标准化

创建统一的任务 Markdown 格式：

```markdown
---
linear-id: GRA-119
title: 'Implement SNS SDK'
status: todo
priority: P0
project: 'Agent Social'
created: 2026-04-03
assignee: 'Code Agent'
tags: [task, p0, agent-social]
---

# GRA-119: Implement SNS SDK

## Description

Integrate Bonfida SNS SDK for domain resolution

## Acceptance Criteria

- [ ] Research SNS API
- [ ] Implement resolve function
- [ ] Add tests
- [ ] Documentation

## Related

- [[GRA-107]] SNS Research
- [[GRA-109]] Architecture Design
- [Linear Issue](https://linear.app/gradiences/issue/GRA-119)

## Notes

## Log

- 2026-04-03: Created
```

### 第 2 步：创建任务管理脚本

```bash
#!/bin/bash
# scripts/task.sh - Task management CLI

VAULT_PATH="$HOME/projects/gradiences/docs/tasks"

# Get tasks by status
function get_tasks() {
    local status=$1  # todo, in-progress, done
    grep -r "status: $status" $VAULT_PATH --include="*.md" -l | \
    while read file; do
        id=$(grep "linear-id:" "$file" | cut -d: -f2 | tr -d ' ')
        title=$(grep "^# " "$file" | head -1 | sed 's/# //')
        priority=$(grep "priority:" "$file" | cut -d: -f2 | tr -d ' ')
        echo "[$priority] $id: $title"
    done
}

# Update task status
function update_status() {
    local task_id=$1
    local new_status=$2
    local file=$(grep -r "linear-id: $task_id" $VAULT_PATH --include="*.md" -l)

    if [ -f "$file" ]; then
        sed -i '' "s/status: .*/status: $new_status/" "$file"
        echo "✅ Updated $task_id to $new_status"

        # Add log entry
        echo "- $(date +%Y-%m-%d): Status changed to $new_status" >> "$file"

        # Open in Obsidian
        obsidian "$file"
    else
        echo "❌ Task not found: $task_id"
    fi
}

# Create new task
function create_task() {
    local title=$1
    local priority=$2
    local project=$3

    local id="GRA-$(date +%s)"
    local file="$VAULT_PATH/$id.md"

    cat > "$file" << EOF
---
linear-id: $id
title: "$title"
status: todo
priority: $priority
project: "$project"
created: $(date +%Y-%m-%d)
assignee: "Code Agent"
tags: [task, ${priority,,}, ${project,,}]
---

# $id: $title

## Description

## Acceptance Criteria
- [ ]

## Related

## Notes

## Log
- $(date +%Y-%m-%d): Created
EOF

    echo "✅ Created $id: $title"
    obsidian "$file"
}

# Main
case $1 in
    list)
        get_tasks ${2:-todo}
        ;;
    update)
        update_status $2 $3
        ;;
    create)
        create_task "$2" $3 "$4"
        ;;
    open)
        obsidian "$VAULT_PATH"
        ;;
    *)
        echo "Usage: task.sh [list|update|create|open]"
        echo "  list [status]     - List tasks (todo/in-progress/done)"
        echo "  update ID STATUS  - Update task status"
        echo "  create TITLE P PROJECT - Create new task"
        echo "  open              - Open Obsidian"
        ;;
esac
```

### 第 3 步：Code Agent 适配

更新 `AGENTS.md`:

````markdown
## Obsidian Task Management

Tasks are managed in Obsidian vault at `docs/tasks/`

### Get Assigned Tasks

```bash
# List all P0 tasks
./scripts/task.sh list todo | grep "\[P0\]"

# List tasks in project
ls docs/tasks/ | xargs -I {} grep -l "project: \"Agent Social\"" docs/tasks/{}
```
````

### Update Task Status

```bash
# Start working on task
./scripts/task.sh update GRA-119 in-progress

# Mark as done
./scripts/task.sh update GRA-119 done
```

### Task Format

Tasks are Markdown files with YAML frontmatter:

- `status`: todo | in-progress | done
- `priority`: P0 | P1 | P2 | P3
- `project`: Project name
- `assignee`: Code Agent

```

---

## 📂 新的项目结构

```

gradiences/
├── apps/ # 应用程序
├── docs/ # Obsidian Vault
│ ├── .obsidian/ # Obsidian 配置
│ │ ├── plugins/ # 插件
│ │ ├── snippets/ # CSS 片段
│ │ └── themes/ # 主题
│ ├── tasks/ # 任务管理 (替代 Linear)
│ │ ├── GRA-001.md
│ │ ├── GRA-002.md
│ │ └── ...
│ ├── 01-prd.md # 7-Phase 文档
│ ├── 02-architecture.md
│ ├── ideas/ # Idea 文档
│ │ └── agent-social-domain.md
│ ├── daily/ # 每日笔记
│ │ └── 2026-04-03.md
│ └── templates/ # 模板
│ ├── task-template.md
│ └── prd-template.md
├── protocol/ # 协议文档
├── scripts/ # 脚本
│ ├── task.sh # 任务管理 CLI
│ └── migrate-from-linear.sh
└── AGENTS.md # 更新后的 Agent 指令

````

---

## 🔌 推荐的 Obsidian 插件

### 必需插件

1. **Dataview** - 任务查询
```dataview
TABLE priority, status, project
FROM "tasks"
WHERE status != "done"
SORT priority ASC
````

2. **Kanban** - 看板视图

- 创建任务看板
- 拖拽变更状态

3. **Git** - 版本控制

- 自动备份
- 团队协作

4. **Templater** - 模板

- 快速创建任务
- 标准化格式

### 可选插件

5. **Day Planner** - 日程管理
6. **Mind Map** - 思维导图
7. **Excalidraw** - 手绘图表

---

## 📊 与 Linear 的对比 (使用 CLI 后)

| 功能         | Linear   | Obsidian CLI              | 实现方式     |
| ------------ | -------- | ------------------------- | ------------ |
| **任务创建** | 点击按钮 | `task.sh create`          | ✅ 脚本      |
| **状态更新** | 拖拽     | `task.sh update`          | ✅ 脚本      |
| **任务列表** | 看板视图 | `task.sh list` + Dataview | ✅ 脚本+插件 |
| **优先级**   | P0/P1/P2 | YAML frontmatter          | ✅ 统一      |
| **分配**     | @mention | assignee 字段             | ✅ 统一      |
| **API**      | GraphQL  | 文件系统 + grep           | ✅ 可行      |
| **知识关联** | 弱       | [[双向链接]]              | ✅ 更强      |
| **离线使用** | 有限     | 完全支持                  | ✅ 优势      |
| **数据控制** | 云端     | 本地 Git                  | ✅ 优势      |

---

## 🔄 迁移计划

### 第 1 周：准备

- [ ] 安装 Obsidian CLI
- [ ] 配置插件 (Dataview, Kanban, Git)
- [ ] 创建 `scripts/task.sh`
- [ ] 设计任务模板

### 第 2 周：迁移

- [ ] 导出 Linear 任务 → Markdown
- [ ] 批量转换格式
- [ ] 验证所有任务可访问
- [ ] 更新 AGENTS.md

### 第 3 周：切换

- [ ] Code Agent 使用新系统
- [ ] 停止使用 Linear
- [ ] 团队培训
- [ ] 反馈迭代

---

## ⚠️ 风险与缓解

### 风险 1: 学习成本

**缓解**: 提供完整文档和培训

### 风险 2: 任务丢失

**缓解**: Git 版本控制 + 定期备份

### 风险 3: Code Agent 不适应

**缓解**: 保持脚本接口简单，测试充分

### 风险 4: 多人协作冲突

**缓解**: Git 工作流 + 频繁同步

---

## 🎯 立即行动

要不要我现在就开始：

1. **安装 Obsidian CLI** 并配置
2. **创建 `scripts/task.sh`** 脚本
3. **迁移 10 个测试任务** 验证流程
4. **更新 AGENTS.md** 让 Code Agent 使用新系统

或者你想先了解更多 Obsidian CLI 的功能？
