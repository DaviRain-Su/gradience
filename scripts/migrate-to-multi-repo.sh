#!/bin/bash
# Multi-Repo 迁移脚本
# Usage: ./migrate-to-multi-repo.sh <github-org>

set -e

ORG=${1:-"yourorg"}
ROOT_DIR=$(pwd)
MONOREPO_URL="https://github.com/$ORG/gradience"

echo "🚀 Gradience Multi-Repo Migration Tool"
echo "======================================"
echo "Target Org: $ORG"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查依赖
check_dependencies() {
    echo "📦 Checking dependencies..."
    
    if ! command -v git &> /dev/null; then
        echo -e "${RED}❌ git is required${NC}"
        exit 1
    fi
    
    if ! command -v gh &> /dev/null; then
        echo -e "${YELLOW}⚠️  gh CLI not found. Install from: https://cli.github.com/${NC}"
        exit 1
    fi
    
    if ! command -v git-filter-repo &> /dev/null; then
        echo -e "${YELLOW}⚠️  git-filter-repo not found. Install: pip install git-filter-repo${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All dependencies found${NC}"
}

# 创建 GitHub 仓库
create_repos() {
    echo ""
    echo "📁 Creating GitHub repositories..."
    
    repos=(
        "gradience-protocol"
        "agent-arena"
        "agentm"
        "chain-hub"
        "dev-docs"
    )
    
    for repo in "${repos[@]}"; do
        echo -n "Creating $repo... "
        if gh repo view "$ORG/$repo" &> /dev/null; then
            echo -e "${YELLOW}already exists${NC}"
        else
            gh repo create "$ORG/$repo" --public --description "Gradience: $repo"
            echo -e "${GREEN}created${NC}"
        fi
    done
}

# 迁移合约仓库
migrate_protocol() {
    echo ""
    echo "🔨 Migrating gradience-protocol..."
    
    cd /tmp
    rm -rf gradience-protocol-migration
    
    # 克隆裸仓库
    git clone --bare "$ROOT_DIR" gradience-protocol-migration
    cd gradience-protocol-migration
    
    # 提取 programs/ 目录
    git filter-repo --path programs/ --path-rename programs/:./
    
    # 清理不需要的文件
    rm -rf apps/ docs/ scripts/ 2>/dev/null || true
    
    # 添加 README
    cat > README.md << 'EOF'
# Gradience Protocol

Solana/EVM smart contracts for the Gradience ecosystem.

## Programs

- `a2a-protocol` - Agent-to-Agent communication protocol
- `agent-arena` - Agent competition and evaluation
- `chain-hub` - Cross-chain indexing and verification
- `agentm-core` - Core wallet and identity management
- `workflow-marketplace` - Workflow trading and execution

## Quick Start

```bash
# Build all programs
cargo build

# Run tests
cargo test

# Generate IDL
./scripts/generate-idl.sh
```

## Documentation

- [API Reference](https://docs.gradience.io)
- [Whitepaper](https://docs.gradience.io/whitepaper)

## License

MIT
EOF
    
    # 推送到新仓库
    git remote add origin "git@github.com:$ORG/gradience-protocol.git"
    git push -u origin main --force
    
    echo -e "${GREEN}✅ gradience-protocol migrated${NC}"
    cd "$ROOT_DIR"
}

# 迁移 Agent Arena
migrate_agent_arena() {
    echo ""
    echo "🎮 Migrating agent-arena..."
    
    cd /tmp
    rm -rf agent-arena-migration
    
    git clone --bare "$ROOT_DIR" agent-arena-migration
    cd agent-arena-migration
    
    # 提取 apps/agent-arena/ 目录，排除 program-backup
    git filter-repo --path apps/agent-arena/ --path-rename apps/agent-arena/:./
    
    # 删除备份目录
    git filter-repo --path program-backup --invert-paths
    
    # 添加 README
    cat > README.md << 'EOF'
# Agent Arena

Agent competition platform for evaluating AI agents.

## Structure

- `frontend/` - Next.js web application
- `indexer/` - Rust blockchain indexer
- `cli/` - Rust CLI tool
- `sdk/` - TypeScript and Rust SDKs

## Development

```bash
# Install dependencies
pnpm install

# Start development
docker-compose up -d  # Start PostgreSQL
pnpm dev
```

## License

MIT
EOF
    
    git remote add origin "git@github.com:$ORG/agent-arena.git"
    git push -u origin main --force
    
    echo -e "${GREEN}✅ agent-arena migrated${NC}"
    cd "$ROOT_DIR"
}

# 迁移 Chain Hub
migrate_chain_hub() {
    echo ""
    echo "⛓️  Migrating chain-hub..."
    
    cd /tmp
    rm -rf chain-hub-migration
    
    git clone --bare "$ROOT_DIR" chain-hub-migration
    cd chain-hub-migration
    
    git filter-repo --path apps/chain-hub/ --path-rename apps/chain-hub/:./
    git filter-repo --path program-backup --invert-paths 2>/dev/null || true
    
    cat > README.md << 'EOF'
# Chain Hub

Cross-chain indexing and verification service.

## Structure

- `indexer/` - Rust blockchain indexer
- `sdk/` - TypeScript and Rust SDKs
- `migrations/` - Database migrations

## License

MIT
EOF
    
    git remote add origin "git@github.com:$ORG/chain-hub.git"
    git push -u origin main --force
    
    echo -e "${GREEN}✅ chain-hub migrated${NC}"
    cd "$ROOT_DIR"
}

# 迁移 AgentM
migrate_agentm() {
    echo ""
    echo "🖥️  Migrating agentm..."
    
    cd /tmp
    rm -rf agentm-migration
    
    git clone --bare "$ROOT_DIR" agentm-migration
    cd agentm-migration
    
    # 提取多个目录
    git filter-repo \
        --path apps/agentm/ --path-rename apps/agentm/:apps/electron/ \
        --path apps/agentm-web/ --path-rename apps/agentm-web/:apps/web/ \
        --path apps/agentm-pro/ --path-rename apps/agentm-pro/:apps/pro/
    
    # 创建 Turborepo 结构
    cat > package.json << 'EOF'
{
  "name": "agentm",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^1.10.0"
  }
}
EOF
    
    cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {}
  }
}
EOF
    
    cat > README.md << 'EOF'
# AgentM

Multi-platform AI agent client.

## Apps

- `electron/` - Desktop application
- `web/` - Web application
- `pro/` - Pro version with advanced features

## Development

```bash
# Install dependencies
pnpm install

# Start all apps
pnpm dev

# Build all
pnpm build
```

## License

MIT
EOF
    
    git add -A
    git commit -m "chore: setup Turborepo structure"
    
    git remote add origin "git@github.com:$ORG/agentm.git"
    git push -u origin main --force
    
    echo -e "${GREEN}✅ agentm migrated${NC}"
    cd "$ROOT_DIR"
}

# 迁移文档
migrate_docs() {
    echo ""
    echo "📚 Migrating dev-docs..."
    
    cd /tmp
    rm -rf dev-docs-migration
    
    git clone --bare "$ROOT_DIR" dev-docs-migration
    cd dev-docs-migration
    
    git filter-repo --path docs/ --path-rename docs/:./
    
    cat > README.md << 'EOF'
# Gradience Developer Documentation

Documentation site for Gradience Protocol.

## Structure

- `whitepaper/` - Protocol whitepaper
- `api/` - API reference
- `tutorials/` - Developer tutorials
- `architecture/` - System design docs

## Development

```bash
pnpm install
pnpm dev
```

## Deployment

Auto-deployed to docs.gradience.io on push to main.

## License

MIT
EOF
    
    git remote add origin "git@github.com:$ORG/dev-docs.git"
    git push -u origin main --force
    
    echo -e "${GREEN}✅ dev-docs migrated${NC}"
    cd "$ROOT_DIR"
}

# 更新原仓库
update_original_repo() {
    echo ""
    echo "📝 Updating original repository..."
    
    cat > MIGRATION_NOTICE.md << EOF
# Repository Migration Notice

This repository has been split into multiple focused repositories:

| Repository | Description | Link |
|------------|-------------|------|
| gradience-protocol | Smart contracts | https://github.com/$ORG/gradience-protocol |
| agent-arena | Competition platform | https://github.com/$ORG/agent-arena |
| agentm | Client applications | https://github.com/$ORG/agentm |
| chain-hub | Indexing service | https://github.com/$ORG/chain-hub |
| dev-docs | Documentation | https://github.com/$ORG/dev-docs |

## Status

This repository is now in maintenance mode. New development should happen in the respective repositories above.

Last updated: $(date +%Y-%m-%d)
EOF
    
    echo -e "${YELLOW}⚠️  MIGRATION_NOTICE.md created. Please review and commit.${NC}"
}

# 主流程
main() {
    check_dependencies
    
    echo ""
    read -p "⚠️  This will create new repositories and push code. Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
    
    create_repos
    migrate_protocol
    migrate_agent_arena
    migrate_chain_hub
    migrate_agentm
    migrate_docs
    update_original_repo
    
    echo ""
    echo "======================================"
    echo -e "${GREEN}✅ Migration completed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review the migrated repositories on GitHub"
    echo "2. Setup branch protection rules"
    echo "3. Configure CI/CD pipelines"
    echo "4. Update documentation links"
    echo "5. Archive this repository after 6 months"
}

main
