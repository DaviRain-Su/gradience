# 🚀 Gradience OWS 部署状态

## ✅ 部署完成时间

**2025年4月3日 13:45**

---

## 📦 组件状态

### 1. CLI 工具 ✅

**位置**: `./dist/cli/index.js`

**可用命令**:

```bash
# Agent 管理
node ./dist/cli/index.js agent register --name "agent-name"
node ./dist/cli/index.js agent list
node ./dist/cli/index.js agent info agent-name

# 声誉系统
node ./dist/cli/index.js reputation check agent-name.ows.eth
node ./dist/cli/index.js reputation simulate agent-name --score 5 --amount 100
node ./dist/cli/index.js reputation leaderboard

# 钱包管理
node ./dist/cli/index.js wallet create-sub --parent agent-name --name sub-name
node ./dist/cli/index.js wallet check-policy agent-name.ows.eth
node ./dist/cli/index.js wallet simulate-tx agent-name.ows.eth --amount 50
```

**演示脚本**:

```bash
./scripts/demo.sh  # 完整演示流程
```

---

### 2. Web Demo ✅

**地址**: http://localhost:3002

**功能**:

- Overview 页面: 项目介绍和功能展示
- Live Demo 页面: 交互式终端演示

**启动命令**:

```bash
cd demo/web && npm run dev
```

---

## 🎯 快速测试

### 端到端测试

```bash
cd /Users/davirian/dev/active/gradience/apps/hackathon-ows

# 1. 注册 Agent
node ./dist/cli/index.js agent register --name "test-agent" --chains ethereum,solana

# 2. 查看声誉
node ./dist/cli/index.js reputation check test-agent.ows.eth

# 3. 模拟任务
node ./dist/cli/index.js reputation simulate test-agent --score 5 --amount 100

# 4. 创建子钱包
node ./dist/cli/index.js wallet create-sub --parent test-agent --name "sub-1"

# 5. 查看排行榜
node ./dist/cli/index.js reputation leaderboard
```

---

## 📊 项目结构

```
apps/hackathon-ows/
├── dist/                    # 编译输出
│   ├── cli/                 # CLI 工具
│   ├── core/                # 核心服务
│   └── ows/                 # OWS 集成
├── demo/web/                # Web Demo
│   ├── src/app/
│   │   ├── page.tsx         # 主页面
│   │   ├── layout.tsx       # 布局
│   │   └── globals.css      # 样式
│   └── package.json
├── src/
│   ├── cli/commands/        # CLI 命令
│   ├── core/                # 业务逻辑
│   └── ows/                 # OWS 集成
├── scripts/
│   └── demo.sh              # 演示脚本
├── README.md
└── DEPLOYMENT.md            # 本文件
```

---

## 🔧 技术栈

- **后端**: Node.js + TypeScript
- **CLI**: Commander.js
- **Web**: Next.js 14 + Tailwind CSS + Framer Motion
- **状态**: 内存存储 (演示用)

---

## 🎨 演示流程

### CLI 演示 (3分钟)

```bash
# 步骤 1: 注册 Agent
$ node ./dist/cli/index.js agent register --name "trading-agent"
✓ Created OWS wallet
✓ Registered ENS: trading-agent.ows.eth
✓ Initial reputation: 50 (Bronze)

# 步骤 2: 查看声誉
$ node ./dist/cli/index.js reputation check trading-agent.ows.eth
Score: 50/100 [Bronze]

# 步骤 3: 完成任务 → 提升声誉
$ node ./dist/cli/index.js reputation simulate trading-agent --score 5 --amount 100
Reputation: 50 → 65 (+15)
Level up: Bronze → Silver

# 步骤 4: 创建子钱包
$ node ./dist/cli/index.js wallet create-sub --parent trading-agent --name "high-freq"
Daily Limit: $65 (inherited from parent)
```

### Web 演示

1. 访问 http://localhost:3002
2. 查看 Overview 了解项目
3. 点击 "Live Demo" 观看交互式演示
4. 点击 "Next" 浏览各个步骤

---

## 🚀 生产部署 (可选)

### Vercel 部署

```bash
cd demo/web
npm run build
vercel --prod
```

### NPM 发布 CLI

```bash
npm version patch
npm publish
```

---

## ✅ 检查清单

- [x] TypeScript 编译通过
- [x] CLI 命令可用
- [x] Web Demo 可访问
- [x] 演示脚本可用
- [ ] 持久化存储 (可选)
- [ ] 智能合约部署 (可选)
- [ ] ENS 真实集成 (可选)

---

**状态**: ✅ 可以开始黑客松演示！

**访问地址**:

- CLI: `node ./dist/cli/index.js --help`
- Web: http://localhost:3002
