# 多 Repo 迁移方案

> **目标**: 将单体仓库 (Monorepo) 拆分为多个独立仓库，提高模块化程度和部署灵活性。

---

## 📊 现状分析

当前为单体仓库结构：

```
gradience/
├── programs/          # 5个 Solana/EVM 合约 (统一 workspace)
├── apps/              # 12个应用/模块
│   ├── agent-arena/   # 前端 + Indexer + CLI + SDK
│   ├── chain-hub/     # Indexer + SDK
│   ├── agentm/        # Electron 应用
│   ├── agentm-web/    # Web 应用
│   └── ...
├── docs/              # 37个文档文件
└── scripts/           # 共享脚本
```

**问题**:

1. 合约发布与应用开发耦合
2. CI/CD 时间长，影响所有模块
3. 权限管理困难
4. 版本号统一管理导致频繁变更

---

## 🎯 目标架构

拆分为 **5个独立仓库**:

```
gradience-protocol/     # 核心合约层
├── a2a-protocol/
├── agent-arena/
├── chain-hub/
├── agentm-core/
└── workflow-marketplace/

agent-arena/            # Agent Arena 应用
├── frontend/
├── indexer/
├── cli/
├── sdk/
└── docs/

agentm/                 # AgentM 客户端
├── electron/
├── web/
├── pro/
└── shared/

chain-hub/              # Chain Hub 服务
├── indexer/
├── sdk/
└── docs/

dev-docs/               # 开发者文档
├── api-reference/
├── tutorials/
└── whitepaper/
```

---

## 📦 仓库详细设计

### 1. gradience-protocol (合约仓库)

**职责**: Solana/EVM 智能合约

```
gradience-protocol/
├── Cargo.toml              # Workspace 定义
├── Anchor.toml             # Anchor 配置 (如需要)
├── Makefile
├── README.md
├── .github/workflows/
│   ├── test.yml
│   ├── build.yml
│   └── release.yml
├── programs/
│   ├── a2a-protocol/
│   ├── agent-arena/
│   ├── chain-hub/
│   ├── agentm-core/
│   └── workflow-marketplace/
├── idl/                    # 生成的 IDL 文件
├── tests/
└── scripts/
    ├── build.sh
    ├── test.sh
    └── deploy.sh
```

**发布物**:

- Crate 包 (crates.io)
- IDL 文件 (GitHub Releases)
- 已部署合约地址文档

**版本策略**: Semver (合约升级遵循 Solana 升级规则)

---

### 2. agent-arena (应用仓库)

**职责**: Agent Arena 完整应用栈

```
agent-arena/
├── README.md
├── package.json            # 根工作区
├── Cargo.toml              # Rust 工作区
├── .github/workflows/
├── docker-compose.yml
├── frontend/               # Next.js/React
├── indexer/                # Rust + PostgreSQL
├── cli/                    # Rust CLI
├── sdk/
│   ├── rust/              # 依赖 gradience-protocol
│   └── ts/                # 依赖 @gradience/protocol
├── docs/
└── scripts/
```

**依赖**:

- `gradience-protocol` (IDL/Types)
- `@solana/web3.js`
- Internal: `frontend -> sdk/ts`, `indexer -> sdk/rust`

---

### 3. agentm (客户端仓库)

**职责**: AgentM 客户端应用

```
agentm/
├── README.md
├── package.json
├── turbo.json              # Turborepo 配置
├── .github/workflows/
├── apps/
│   ├── electron/          # Electron 桌面端
│   ├── web/               # Next.js Web 端
│   └── pro/               # Pro 版本
├── packages/
│   ├── shared/            # 共享组件
│   ├── ui/                # UI 组件库
│   └── config/            # 共享配置
└── docs/
```

**依赖**:

- `@gradience/protocol`
- `agent-arena/sdk` (用于竞技场功能)

---

### 4. chain-hub (服务仓库)

**职责**: Chain Hub 索引和 API 服务

```
chain-hub/
├── README.md
├── Cargo.toml
├── docker-compose.yml
├── .github/workflows/
├── indexer/               # 区块链索引服务
├── api/                   # GraphQL/REST API
├── sdk/
│   ├── rust/
│   └── ts/
├── migrations/            # DB 迁移
└── docs/
```

**依赖**:

- `gradience-protocol`
- PostgreSQL, Redis

---

### 5. dev-docs (文档仓库)

**职责**: 开发者文档和 Whitepaper

```
dev-docs/
├── README.md
├── package.json          # Docusaurus/Next.js
├── .github/workflows/
│   └── deploy.yml        # 自动部署到 GitHub Pages
├── docs/
│   ├── whitepaper/       # v1.2.md
│   ├── api/              # API 文档
│   ├── tutorials/
│   └── architecture/
├── static/
└── docusaurus.config.js
```

**CI**: 推送到 main 自动部署到 docs.gradience.io

---

## 🔗 依赖关系图

```
gradience-protocol (基础层)
    │
    ├── IDL/Types ───────> agent-arena/sdk
    │                       │
    │                       ├──> agent-arena/frontend
    │                       └──> agent-arena/indexer
    │
    ├── IDL/Types ───────> chain-hub/sdk
    │                       │
    │                       └──> chain-hub/indexer
    │
    └── IDL/Types ───────> agentm/packages/shared
                            │
                            ├──> agentm/apps/electron
                            ├──> agentm/apps/web
                            └──> agentm/apps/pro

dev-docs (独立，仅引用)
```

---

## 🚀 迁移步骤

### Phase 1: 准备工作 (Week 1)

1. **创建新仓库**

    ```bash
    # GitHub 上创建 5 个空仓库
    gh repo create gradience-protocol --public
    gh repo create agent-arena --public
    gh repo create agentm --public
    gh repo create chain-hub --public
    gh repo create dev-docs --public
    ```

2. **保留 Git 历史**

    ```bash
    # 使用 git filter-repo 提取子目录历史
    git clone --bare gradience gradience-protocol-tmp
    cd gradience-protocol-tmp
    git filter-repo --path programs/ --path-rename programs/:./
    git push https://github.com/yourorg/gradience-protocol.git
    ```

3. **更新依赖引用**
    - 将 workspace 依赖改为 crates.io/npm 依赖
    - 创建发布流水线

### Phase 2: 合约仓库独立 (Week 2)

1. **迁移 programs/**

    ```bash
    # 已经迁移到 programs/，只需推送到新仓库
    cd gradience-protocol
    git init
    git add .
    git commit -m "Initial: protocol contracts v0.1.0"
    git remote add origin git@github.com:yourorg/gradience-protocol.git
    git push -u origin main
    ```

2. **设置发布流程**
    - GitHub Actions: 合并到 main 自动发布 IDL
    - crates.io 自动发布 (可选)

### Phase 3: 应用仓库拆分 (Week 3-4)

1. **agent-arena**
    - 迁移 apps/agent-arena (不包括 program-backup)
    - 更新依赖: 从本地路径改为 @gradience/protocol
    - 设置 CI/CD

2. **chain-hub**
    - 迁移 apps/chain-hub
    - 设置 Docker Compose 部署

3. **agentm**
    - 迁移 apps/agentm, agentm-web, agentm-pro
    - 设置为 Turborepo 结构

### Phase 4: 文档仓库 (Week 5)

1. **dev-docs**
    - 迁移 docs/ 到独立仓库
    - 设置 Docusaurus 自动部署

### Phase 5: 清理与归档 (Week 6)

1. **更新原仓库**

    ```bash
    # 在 gradience 原仓库
    git checkout -b archive/monorepo
    # 添加 README 说明已迁移
    # 保留 6 个月后归档
    ```

2. **更新文档链接**
    - 所有 README 指向新仓库
    - 更新 CI badge

---

## 📋 版本管理策略

### 合约版本 (gradience-protocol)

```toml
# Cargo.toml
[workspace.package]
version = "0.5.0"  # 跟随 pinocchio-token 版本

# 合约地址管理
# - devnet: 自动部署
# - mainnet: 手动审核后部署
```

### SDK 版本

```json
// package.json
{
    "name": "@gradience/protocol",
    "version": "0.5.0", // 与合约版本对齐
    "dependencies": {
        "@solana/web3.js": "^1.87.0"
    }
}
```

### 版本对齐规则

| 合约版本 | SDK 版本 | 说明     |
| -------- | -------- | -------- |
| 0.5.0    | 0.5.0    | 初始版本 |
| 0.5.1    | 0.5.1    | Bugfix   |
| 0.6.0    | 0.6.0    | 新功能   |

---

## 🔐 权限与 CI/CD

### 分支保护

```yaml
# .github/settings.yml
branches:
    - name: main
      protection:
          required_pull_request_reviews:
              required_approving_review_count: 2 # 合约需要2人审核
          required_status_checks:
              - test
              - build
              - clippy
```

### CI/CD 流水线

```yaml
# gradience-protocol/.github/workflows/release.yml
name: Release
on:
    push:
        tags: ['v*']
jobs:
    build:
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
                  files: |
                      target/idl/*.json
```

---

## 📝 迁移检查清单

### 每个仓库必须包含

- [ ] README.md (使用说明、徽章、链接)
- [ ] LICENSE (与主仓库一致)
- [ ] CONTRIBUTING.md
- [ ] .github/workflows/ci.yml
- [ ] .github/ISSUE_TEMPLATE/
- [ ] .gitignore
- [ ] CODEOWNERS (代码审核人)

### 依赖更新

- [ ] 删除 workspace 依赖，改用 crates.io/npm
- [ ] 更新 import 路径
- [ ] 更新文档中的链接
- [ ] 更新环境变量名 (避免冲突)

---

## ⚠️ 风险与缓解

| 风险         | 影响 | 缓解措施                                   |
| ------------ | ---- | ------------------------------------------ |
| 代码历史丢失 | 高   | 使用 git filter-repo 保留历史              |
| 依赖更新滞后 | 中   | 设置自动化发布 + Dependabot                |
| 文档分散     | 中   | 集中文档到 dev-docs，其他仓库只保留 README |
| CI 配置重复  | 低   | 创建 gradience-actions 共享 workflow       |
| 版本不一致   | 高   | 版本号强制对齐，CI 检查                    |

---

## 📅 时间线

| Week | 任务                    | 负责人        |
| ---- | ----------------------- | ------------- |
| 1    | 创建仓库、工具准备      | DevOps        |
| 2    | gradience-protocol 独立 | Contract Team |
| 3    | agent-arena 拆分        | Arena Team    |
| 4    | agentm + chain-hub 拆分 | Client Team   |
| 5    | dev-docs + 文档迁移     | Docs Team     |
| 6    | 清理、归档、监控        | All           |

---

## 💡 决策记录

### 2025-04-04: 为什么拆分为 5 个仓库?

1. **合约独立**: 合约升级需要审计，与应用开发节奏不同
2. **应用独立**: AgentM 和 Agent Arena 有不同发布周期
3. **服务独立**: Chain Hub 需要 24/7 运维，其他不需要
4. **文档独立**: 文档更新频繁，不应触发 CI

### 为什么不拆得更细?

- 避免管理 overhead
- 减少跨仓库 PR
- 保持团队专注

---

## 📚 参考

- [Git filter-repo 文档](https://github.com/newren/git-filter-repo)
- [GitHub 多仓库管理](https://docs.github.com/en/repositories)
- [Cargo Workspace 最佳实践](https://doc.rust-lang.org/cargo/reference/workspaces.html)
