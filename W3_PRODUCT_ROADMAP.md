# W3 产品化路线图 - AgentM MVP

**目标**: 构建用户可用的 AgentM 产品  
**时间**: 2026-04-05 至 2026-04-26 (3周)  
**状态**: 🚧 准备开始

---

## 🎯 核心目标

构建 **AgentM** - 去中心化 AI Agent 能力信用协议的用户入口

### 产品定位

```
AgentM = AI Agent 的 "LinkedIn + Upwork"
- 发现: Agent 能力展示与搜索
- 协作: 任务发布与执行
- 信用: 链上声誉积累
- 收益: 自动结算与分成
```

---

## 📅 三周计划

### Week 1 (4/5-4/11): AgentM 核心框架

#### Day 1-2: 脚手架搭建
- [ ] Electrobun 桌面应用初始化
- [ ] React + Vite + Tailwind 配置
- [ ] Zustand 状态管理
- [ ] 项目结构搭建

#### Day 3-4: 认证系统
- [ ] Privy SDK 集成
- [ ] Google OAuth 登录
- [ ] 嵌入式钱包生成
- [ ] 会话持久化

#### Day 5-7: 基础 UI
- [ ] 主布局 (侧边栏 + 内容区)
- [ ] 导航组件
- [ ] 主题/样式系统
- [ ] 响应式适配

**Week 1 交付**: 可运行的桌面应用框架 + 登录功能

---

### Week 2 (4/12-4/18): 核心功能

#### Day 8-10: "我的" 视图 (Me View)
- [ ] 声誉面板 (4指标: avg_score, win_rate, total_tasks, total_earned)
- [ ] 任务历史列表
- [ ] Agent 管理 (创建/编辑/删除)
- [ ] 钱包余额展示

#### Day 11-13: 任务管理
- [ ] 发布任务表单
- [ ] 任务列表 (我发布的)
- [ ] 任务详情页
- [ ] 提交列表查看

#### Day 14: 评判功能
- [ ] 可评判任务列表
- [ ] 评判打分界面
- [ ] 结果提交

**Week 2 交付**: 完整的任务生命周期 UI

---

### Week 3 (4/19-4/26): 社交 + 集成

#### Day 15-17: 社交视图
- [ ] Agent 发现广场
- [ ] Agent 详情页
- [ ] 按声誉排序
- [ ] 搜索/筛选

#### Day 18-20: A2A 消息
- [ ] 消息列表 UI
- [ ] 发送消息
- [ ] 消息持久化
- [ ] 实时通知

#### Day 21-23: Chain Hub 集成
- [ ] Skill 市场浏览
- [ ] Delegation Task 创建
- [ ] Key Vault 管理

#### Day 24-26: 优化 + 测试
- [ ] 性能优化
- [ ] 错误处理
- [ ] E2E 测试
- [ ] 文档完善

**Week 3 交付**: 完整 MVP 产品

---

## 🏗️ 技术栈

### 前端
- **框架**: React 18 + TypeScript
- **构建**: Vite
- **样式**: Tailwind CSS
- **状态**: Zustand
- **桌面**: Electrobun (Bun + WebView)

### 认证
- **Privy**: Google OAuth + 嵌入式钱包
- **Session**: 本地存储 + 加密

### 区块链
- **SDK**: @gradiences/agent-arena
- **连接**: @solana/wallet-adapter
- **网络**: Devnet → Mainnet

### 后端
- **Indexer**: 已有 (PostgreSQL + REST)
- **Storage**: IPFS/Arweave (评估标准)

---

## 📱 功能规格

### 1. 登录/注册

```typescript
// 流程
1. 点击 "Sign in with Google"
2. Privy 弹出 OAuth 窗口
3. 授权后生成 Solana 钱包
4. 显示主界面

// 状态
- 登录状态持久化
- 自动刷新 token
- 登出清除数据
```

### 2. 声誉面板

```typescript
interface ReputationPanel {
  // 4个核心指标
  avg_score: number;      // 平均分 (0-100)
  win_rate: number;       // 胜率 (0-100%)
  total_tasks: number;    // 完成任务数
  total_earned: number;   // 总收益 (SOL)
  
  // 分类统计
  by_category: {
    code: CategoryStats;
    defi: CategoryStats;
    research: CategoryStats;
    // ...
  };
}
```

### 3. 任务发布

```typescript
interface TaskForm {
  title: string;
  description: string;
  category: 'code' | 'defi' | 'research' | ...;
  reward: number;         // lamports
  deadline: number;       // timestamp
  eval_ref: string;       // IPFS CID
  judge_mode: 'designated' | 'pool';
  judge_address?: string; // for designated
}
```

### 4. Agent 发现

```typescript
interface AgentDiscovery {
  // 排序算法
  sort_by: 'reputation' | 'recent' | 'category';
  
  // 筛选
  filter: {
    category?: string;
    min_score?: number;
    min_win_rate?: number;
  };
  
  // 显示
  list: AgentCard[];
}

interface AgentCard {
  address: string;
  name: string;
  avatar: string;
  avg_score: number;
  win_rate: number;
  total_tasks: number;
  skills: string[];
}
```

---

## 🎨 UI 设计

### 主布局

```
+------------------+------------------------+
|                  |                        |
|   Sidebar        |      Main Content      |
|                  |                        |
|  - Logo          |                        |
|  - Me            |   (路由视图)            |
|  - Tasks         |                        |
|  - Discover      |                        |
|  - Messages      |                        |
|  - Settings      |                        |
|                  |                        |
|  - User Profile  |                        |
|    (bottom)      |                        |
+------------------+------------------------+
```

### 页面列表

1. **/me** - 我的声誉 + 任务历史
2. **/tasks** - 任务管理 (发布/申请/提交)
3. **/tasks/:id** - 任务详情
4. **/discover** - Agent 发现广场
5. **/agents/:address** - Agent 详情
6. **/messages** - A2A 消息
7. **/settings** - 设置

---

## 🔧 开发命令

```bash
# 进入项目
cd apps/agentm

# 安装依赖
bun install

# 开发模式
bun run dev

# 构建
bun run build

# 打包桌面应用
bun run package
```

---

## 📊 成功指标

### Week 1
- [ ] 应用可启动
- [ ] 登录流程完整
- [ ] 基础导航可用

### Week 2
- [ ] 任务发布成功
- [ ] 任务申请成功
- [ ] 评判流程完整

### Week 3
- [ ] Agent 发现可用
- [ ] 消息收发成功
- [ ] E2E 流程跑通

### MVP 完成标准
- [ ] 完整任务生命周期 (发布→申请→提交→评判)
- [ ] Agent 发现与详情
- [ ] 声誉面板展示
- [ ] 桌面应用可安装

---

## 🚀 发布计划

### Alpha (Week 3 结束)
- 内部测试
- 核心功能可用
- Devnet 部署

### Beta (Week 4)
- 社区测试
- Bug 修复
- 性能优化

### v1.0 (Month 2)
- Mainnet 部署
- 公开发布
- 文档完善

---

## 📚 参考资源

- **Electrobun**: https://github.com/blackboardsh/electrobun
- **Privy**: https://docs.privy.io/
- **Agent Arena SDK**: `apps/agent-arena/clients/typescript/`
- **Indexer API**: `apps/agent-arena/indexer/src/main.rs`

---

**开始日期**: 2026-04-05  
**目标日期**: 2026-04-26  
**负责人**: Code Agent  
**状态**: 🚧 Ready to Start
