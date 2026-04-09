# 多 Repo 迁移指南

本文档说明如何将 Gradience 从单体仓库 (Monorepo) 迁移到多仓库 (Multi-Repo) 架构。

## 📖 阅读顺序

1. [迁移方案](./MULTI_REPO_MIGRATION_PLAN.md) - 整体规划和架构设计
2. [依赖关系](./REPO_DEPENDENCIES.md) - 仓库间依赖和版本管理
3. **本文件** - 实操指南

---

## 🚀 快速开始

### 一键迁移

```bash
# 确保已登录 GitHub CLI
gh auth login

# 运行迁移脚本
./scripts/migrate-to-multi-repo.sh your-github-org
```

### 手动迁移

如果不想使用脚本，可以按照以下步骤手动操作。

---

## 📦 分步迁移指南

### Step 1: 合约仓库 (gradience-protocol)

**原因**: 合约是基础层，其他所有仓库都依赖它。

````bash
# 1. 在 GitHub 创建 gradience-protocol 仓库
gh repo create yourorg/gradience-protocol --public

# 2. 提取 programs/ 目录并保留 Git 历史
cd /tmp
git clone --bare /path/to/gradience gradience-protocol-tmp
cd gradience-protocol-tmp

# 使用 git-filter-repo 提取目录
git filter-repo --path programs/ --path-rename programs/:./

# 3. 添加新文件
cat > README.md << 'EOF'
# Gradience Protocol

Solana 智能合约集合。

## 程序列表

- `a2a-protocol` - Agent 通信协议
- `agent-arena` - Agent 竞技场
- `chain-hub` - 跨链索引
- `agentm-core` - 核心钱包
- `workflow-marketplace` - 工作流市场

## 快速开始

```bash
cargo build
cargo test
````

EOF

# 4. 推送到新仓库

git remote add origin git@github.com:yourorg/gradience-protocol.git
git push -u origin main

````

### Step 2: 设置 CI/CD

在 `gradience-protocol` 中添加 GitHub Actions:

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build
        run: cargo build --release

      - name: Generate IDL
        run: ./scripts/generate-idl.sh

      - name: Release
        uses: softprops/action-gh-release@v1
        with:
          files: target/idl/*.json
````

### Step 3: Agent Arena 仓库

```bash
# 1. 创建仓库
gh repo create yourorg/agent-arena --public

# 2. 提取代码
git clone --bare /path/to/gradience agent-arena-tmp
cd agent-arena-tmp
git filter-repo --path apps/agent-arena/ --path-rename apps/agent-arena/:./

# 3. 删除备份的 program
git filter-repo --path program-backup --invert-paths

# 4. 更新依赖
# 修改 Cargo.toml，从 workspace 依赖改为 crates.io
# 之前:
# pinocchio = { workspace = true }
# 之后:
# pinocchio = "0.10"
# gradience-protocol = "0.5"

# 5. 推送
git remote add origin git@github.com:yourorg/agent-arena.git
git push -u origin main
```

### Step 4: Chain Hub 仓库

类似 Agent Arena，提取 `apps/chain-hub/`。

### Step 5: AgentM 仓库

提取多个应用并设置为 Turborepo:

```bash
git clone --bare /path/to/gradience agentm-tmp
cd agentm-tmp

# 提取多个目录
git filter-repo \
  --path apps/agentm/ --path-rename apps/agentm/:apps/electron/ \
  --path apps/agentm-web/ --path-rename apps/agentm-web/:apps/web/ \
  --path apps/agentm-pro/ --path-rename apps/agentm-pro/:apps/pro/

# 添加 Turborepo 配置
# ... (参见迁移方案)

git remote add origin git@github.com:yourorg/agentm.git
git push -u origin main
```

### Step 6: 文档仓库

```bash
git clone --bare /path/to/gradience dev-docs-tmp
cd dev-docs-tmp
git filter-repo --path docs/ --path-rename docs/:./

# 添加 Docusaurus 配置
# ...

git remote add origin git@github.com:yourorg/dev-docs.git
git push -u origin main
```

---

## 🔧 迁移后配置

### 1. 分支保护

在每个新仓库中设置:

```yaml
# .github/settings.yml
branches:
    - name: main
      protection:
          required_pull_request_reviews:
              required_approving_review_count: 1
          required_status_checks:
              - ci/test
              - ci/build
```

### 2. Secrets

```bash
# 在每个仓库中添加必要的 secrets
gh secret set RPC_URL --body "https://..."
gh secret set DEPLOY_KEY --body "..."
```

### 3. 自动化

- 开启 Dependabot
- 开启 CodeQL 安全扫描
- 设置 PR 模板

---

## 📝 检查清单

### 每个仓库必须包含

- [ ] README.md (说明、徽章、链接)
- [ ] LICENSE (MIT)
- [ ] CONTRIBUTING.md
- [ ] .github/workflows/ci.yml
- [ ] .github/pull_request_template.md
- [ ] CODEOWNERS (审核人配置)
- [ ] .gitignore

### 依赖更新

- [ ] 删除 workspace 引用
- [ ] 更新为 crates.io/npm 依赖
- [ ] 添加版本锁定文件 (Cargo.lock/package-lock.json)

### 文档

- [ ] 更新原仓库 README，指向新仓库
- [ ] 更新所有外部文档链接
- [ ] 更新 CI badge

---

## ⚠️ 常见问题

### Q: Git 历史丢失了怎么办?

A: 使用 `git-filter-repo` 会保留历史。如果已经丢失，可以从原仓库重新提取。

### Q: 依赖版本如何同步?

A: 使用 Dependabot 自动更新，并在 CI 中检查版本兼容性。

### Q: 跨仓库搜索代码怎么办?

A: 使用 `gh search code` 或 Sourcegraph。

### Q: 如何批量修改多个仓库?

A: 使用 `gh` CLI + xargs:

```bash
# 在所有仓库中创建分支
gh repo list yourorg --limit 100 | while read repo; do
  gh api repos/$repo/git/refs -f ref='refs/heads/feature' -f sha='...'
done
```

---

## 📅 迁移时间线

| 阶段     | 时长     | 任务                     |
| -------- | -------- | ------------------------ |
| 准备     | 2天      | 创建仓库、配置 CI        |
| 合约迁移 | 3天      | gradience-protocol       |
| 应用迁移 | 5天      | arena、chain-hub、agentm |
| 文档迁移 | 2天      | dev-docs                 |
| 验证     | 3天      | 测试、修复问题           |
| **总计** | **15天** | 约3周                    |

---

## 💡 最佳实践

1. **不要删除原仓库**，先标记为 archived
2. **保留6个月**，确保没有遗漏的引用
3. **逐个迁移**，不要同时进行
4. **测试每个仓库**的 CI/CD 后再迁移下一个
5. **更新文档链接**后再通知团队

---

## 🆘 需要帮助?

- 查看 [MIGRATION_PLAN](./MULTI_REPO_MIGRATION_PLAN.md) 了解详细设计
- 查看 [DEPENDENCIES](./REPO_DEPENDENCIES.md) 了解依赖关系
- 运行 `./scripts/migrate-to-multi-repo.sh --dry-run` 预览迁移过程
