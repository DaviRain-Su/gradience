# 合约目录统一迁移计划

**日期**: 2026-04-04  
**目标**: 将分散在 `apps/` 下的合约统一迁移到 `programs/` 目录

---

## 当前状态

### 现有合约分布

```
projects/
├── apps/
│   ├── a2a-protocol/
│   │   └── program/          # A2A Protocol Solana Program
│   ├── agent-arena/
│   │   └── program/          # Agent Arena Core Program
│   ├── chain-hub/
│   │   └── program/          # Chain Hub Program
│   ├── agentm-core/
│   │   └── program/          # AgentM Core Program
│   └── agent-layer-evm/
│       └── contracts/        # EVM Solidity Contracts
│
└── programs/                 # 新的统一目录
    └── workflow-marketplace/ # 已在此目录
```

### 问题分析

1. **结构不一致**: 有的用 `program/` 有的用 `contracts/`
2. **workspace 分散**: 每个 app 有自己的 Cargo workspace
3. **维护困难**: 合约逻辑和应用逻辑混在一起
4. **构建复杂**: 需要分别进入每个目录构建

---

## 目标结构

```
programs/
├── a2a-protocol/             # 从 apps/a2a-protocol/program/ 迁移
├── agent-arena/              # 从 apps/agent-arena/program/ 迁移
├── chain-hub/                # 从 apps/chain-hub/program/ 迁移
├── agentm-core/              # 从 apps/agentm-core/program/ 迁移
├── agent-layer-evm/          # 从 apps/agent-layer-evm/contracts/ 迁移
└── workflow-marketplace/     # 保持不变
```

---

## 迁移步骤

### Phase 1: 创建统一 Workspace (建议先完成)

在 `programs/` 下创建顶层 `Cargo.toml`：

```toml
[workspace]
members = [
    "a2a-protocol",
    "agent-arena",
    "chain-hub",
    "agentm-core",
    "workflow-marketplace",
]
resolver = "2"

[workspace.package]
version = "0.1.0"
edition = "2021"

[workspace.dependencies]
pinocchio = { version = "^0.10.1", features = ["copy"] }
pinocchio-system = "^0.5.0"
pinocchio-token = "***"
pinocchio-token-2022 = "^0.2"
pinocchio-associated-token-account = "^0.3"
pinocchio-log = "^0.5.1"
solana-address = { version = "^2.5.0", features = ["curve25519"] }
borsh = { version = "^1.6.0", features = ["derive"] }
thiserror = "^2.0.17"
codama = "^0.7.2"
```

### Phase 2: 逐个迁移合约

#### 1. Agent Arena (最高优先级)

```bash
# 创建新目录
mkdir -p programs/agent-arena

# 迁移代码
cp -r apps/agent-arena/program/* programs/agent-arena/
cp apps/agent-arena/program-keypair.json programs/agent-arena/

# 更新 Cargo.toml
# - 移除 workspace 配置（使用顶层配置）
# - 保留程序特定依赖
```

**需要处理的文件**:

- `Cargo.toml` - 简化为单包配置
- `src/` - 代码保持不变
- `build.rs` - 保持不变
- `program-keypair.json` - 保持不变

#### 2. A2A Protocol

```bash
mkdir -p programs/a2a-protocol
cp -r apps/a2a-protocol/program/* programs/a2a-protocol/
```

**注意**:

- A2A 有 `tests/` 目录，考虑是否一起迁移或保留在 apps/
- 建议测试保留在 apps/a2a-protocol/，只迁移程序代码

#### 3. Chain Hub

```bash
mkdir -p programs/chain-hub
cp -r apps/chain-hub/program/* programs/chain-hub/
```

**注意**:

- Chain Hub 有集成测试 `tests/integration-tests/`
- 建议测试代码保留在原位置

#### 4. AgentM Core

```bash
mkdir -p programs/agentm-core
cp -r apps/agentm-core/program/* programs/agentm-core/
```

#### 5. Agent Layer EVM

```bash
mkdir -p programs/agent-layer-evm
cp -r apps/agent-layer-evm/contracts/* programs/agent-layer-evm/
```

**特殊处理**:

- EVM 是 Solidity，不是 Rust
- 需要单独的 Hardhat/Foundry 配置

### Phase 3: 更新引用路径

#### 1. 文档更新

更新以下文档中的路径引用：

```
docs/02-architecture.md      # 程序路径引用
docs/03-technical-spec.md    # 技术规格中的路径
docs/04-task-breakdown.md    # 任务分解中的路径
docs/06-implementation.md    # 实现日志中的路径
```

#### 2. 脚本更新

```
scripts/build.sh             # 构建脚本
scripts/deploy.sh            # 部署脚本
scripts/test.sh              # 测试脚本
```

#### 3. CI/CD 配置

```
.github/workflows/*.yml      # GitHub Actions
```

#### 4. SDK 和客户端

检查 SDK 中是否有硬编码的程序路径：

```
apps/agent-arena/clients/rust/
apps/a2a-protocol/clients/
```

### Phase 4: 验证和测试

#### 构建验证

```bash
cd programs/
cargo build --release
```

#### 测试验证

```bash
# Agent Arena
cd programs/agent-arena
cargo test-sbf

# A2A Protocol
cd programs/a2a-protocol
cargo test-sbf

# Chain Hub
cd programs/chain-hub
cargo test-sbf
```

#### 部署验证

```bash
# 使用新路径部署到 devnet
./scripts/deploy.sh --network devnet
```

---

## 依赖关系处理

### 当前依赖图

```
agent-arena/
├── program/           # 要迁移
├── indexer/           # 保留在 apps/
├── clients/rust/      # 保留在 apps/
└── tests/             # 保留在 apps/

chain-hub/
├── program/           # 要迁移
└── tests/             # 保留在 apps/

a2a-protocol/
├── program/           # 要迁移
└── tests/             # 保留在 apps/
```

### 分离原则

- **程序代码** → `programs/`
- **应用逻辑** → `apps/`
- **测试代码** → 可以保留在 `apps/` 或移到 `tests/`
- **客户端/SDK** → 保留在 `apps/` 或移到 `packages/`

---

## 迁移时间表

| 阶段     | 任务                 | 预计时间   | 优先级 |
| -------- | -------------------- | ---------- | ------ |
| 1        | 创建统一 workspace   | 30分钟     | P0     |
| 2        | 迁移 agent-arena     | 1小时      | P0     |
| 3        | 迁移 chain-hub       | 1小时      | P0     |
| 4        | 迁移 a2a-protocol    | 1小时      | P0     |
| 5        | 迁移 agentm-core     | 30分钟     | P1     |
| 6        | 迁移 agent-layer-evm | 30分钟     | P1     |
| 7        | 更新文档和脚本       | 2小时      | P0     |
| 8        | 验证测试             | 1小时      | P0     |
| **总计** |                      | **~7小时** |        |

---

## 风险评估

| 风险           | 概率 | 影响 | 缓解措施                         |
| -------------- | ---- | ---- | -------------------------------- |
| 路径引用遗漏   | 高   | 中   | 全局搜索 `apps/xxx/program` 替换 |
| Workspace 冲突 | 中   | 高   | 逐步迁移，逐个验证               |
| 测试失效       | 中   | 中   | 保留测试在原位置，只迁移程序     |
| CI/CD 中断     | 低   | 高   | 在非主分支测试，确认后再合并     |

---

## 回滚计划

如果迁移失败：

1. 保留原 `apps/*/program/` 目录不变（先复制再修改）
2. 快速切换回原有配置
3. 删除 `programs/` 下的新目录
4. 恢复脚本和文档

---

## 执行命令摘要

```bash
# 1. 备份（可选）
cp -r apps apps-backup-$(date +%Y%m%d)

# 2. 创建统一 workspace
cat > programs/Cargo.toml << 'EOF'
[workspace]
members = [
    "a2a-protocol",
    "agent-arena",
    "chain-hub",
    "agentm-core",
    "workflow-marketplace",
]
resolver = "2"
EOF

# 3. 迁移合约（逐个执行）
cp -r apps/agent-arena/program/* programs/agent-arena/
cp -r apps/chain-hub/program/* programs/chain-hub/
cp -r apps/a2a-protocol/program/* programs/a2a-protocol/
cp -r apps/agentm-core/program/* programs/agentm-core/

# 4. 更新程序 Cargo.toml（移除 workspace 配置）
# 手动编辑每个 programs/*/Cargo.toml

# 5. 验证构建
cd programs && cargo build --release

# 6. 运行测试
cargo test-sbf
```

---

**建议**: 这个迁移可以在一个独立的 feature branch 上进行，测试通过后再合并到 main。
