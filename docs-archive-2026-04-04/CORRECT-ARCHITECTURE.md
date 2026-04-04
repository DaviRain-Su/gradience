# 正确的架构：Web + 本地守护进程

## ✅ 你的理解完全正确！

**架构模式：**
```
┌─────────────────────────────────────────────────────────────┐
│                    用户浏览器                               │
│              (AgentM Web - https://agentm.io)              │
│                     ↓                                       │
│         HTTP/WebSocket 连接到本地                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼ localhost:3939 或 :7420
┌─────────────────────────────────────────────────────────────┐
│              Agent Daemon (运行在用户电脑)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ HTTP API     │  │ WebSocket    │  │ Playwright   │      │
│  │ (Fastify)    │  │ (实时通信)    │  │ (浏览器控制)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                     ↓                                       │
│              与链交互 / A2A 通信                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Solana 区块链                                  │
│         (Gradience 智能合约)                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 找到的代码证据

### 1. Agent Daemon 端口配置
```typescript
// apps/agent-daemon/src/config.ts
port: z.number().default(7420),  // 默认端口 7420

// 但 Web 端使用的是 3939
// apps/agentm-web/src/components/connection/ConnectionPanel.tsx
const [daemonUrl, setDaemonUrl] = useState('http://localhost:3939');
```

### 2. Web 连接 Daemon 的方式
```typescript
// apps/agentm-web/src/lib/connection/api.ts
const { daemonUrl, isConnected } = useConnection();

const response = await fetch(`${daemonUrl}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
});
```

### 3. 连接流程（Pair Code）
```typescript
// apps/agentm-web/src/components/connection/ConnectionPanel.tsx
<li>Run npm run demo:stage-a in your local AgentM daemon</li>
<li>Enter the pair code shown in the daemon console</li>

await connect(pairCode, daemonUrl);
```

---

## 🎯 为什么需要 Daemon

| 功能 | 为什么需要本地 Daemon |
|------|---------------------|
| **浏览器自动化** | Playwright 需要本地运行，Web 无法直接控制浏览器 |
| **A2A 通信** | WebSocket P2P 连接需要本地端口 |
| **私钥安全** | 用户私钥保存在本地，不上传到服务器 |
| **任务执行** | 长时间运行的任务在本地执行 |
| **文件系统** | 访问本地文件、下载内容 |

---

## 🔧 当前发现的问题

### 问题 1：端口不一致
```
Daemon 配置：7420
Web 默认：3939
```

**需要统一！**

### 问题 2：AgentM Web 缺少连接管理
检查到的文件：
- `src/components/connection/ConnectionPanel.tsx` ✅ 存在
- `src/lib/connection/api.ts` ✅ 存在
- `src/hooks/use-web-entry.ts` ✅ 存在

但新创建的 Profile/Following/Feed hooks 使用的是 Mock 数据，**没有连接到 Daemon**！

---

## 🚀 正确的数据流

### 现在（错误）
```
Web 前端
    ↓
Mock Data（假数据）
```

### 目标（正确）
```
Web 前端
    ↓ HTTP/WebSocket
Agent Daemon (localhost:7420)
    ↓ SQLite/内存
本地数据 + 与链交互
```

### 或者（混合模式）
```
Web 前端
    ├── ← 读取数据 ← Indexer (可选，用于大数据查询)
    ├── ← 提交交易 ← Solana RPC (直连)
    └── ← 本地功能 ← Agent Daemon (必须)
```

---

## 📋 需要修复的内容

### 1. 统一端口配置
```typescript
// 建议统一为 7420
// 修改 apps/agentm-web/src/components/connection/ConnectionPanel.tsx
const [daemonUrl, setDaemonUrl] = useState('http://localhost:7420');
```

### 2. 让 Profile/Following/Feed 使用 Daemon API
当前：
```typescript
// useProfile.ts - 错误！使用 Mock
const mockProfile = { ... };
```

应该：
```typescript
// useProfile.ts - 正确！调用 Daemon API
const response = await fetch(`${daemonUrl}/api/profile/${address}`);
```

### 3. 确保 Daemon 有这些 API
```
Daemon 需要提供：
├── GET /api/profile/:address      ← 获取 Profile
├── GET /api/followers/:address    ← 获取 Followers
├── GET /api/following/:address    ← 获取 Following
├── GET /api/feed                  ← 获取 Feed
├── POST /api/follow               ← 关注
├── POST /api/unfollow             ← 取消关注
└── WebSocket /ws/messages         ← 实时消息
```

---

## ❓ 关键问题

### Daemon 目前有哪些 API？
```
apps/agent-daemon/src/api/routes/
├── agents.ts       ✅ Agent 管理
├── keys.ts         ✅ 密钥管理
├── messages.ts     ✅ 消息路由
├── solana.ts       ✅ Solana 交易
├── status.ts       ✅ 状态检查
├── tasks.ts        ✅ 任务队列
└── wallet.ts       ✅ 钱包授权
```

**缺少 Social API！**
- 没有 `/api/profile`
- 没有 `/api/followers`
- 没有 `/api/feed`

---

## 🎯 结论

**你的理解 100% 正确！**

**Web 端需要：**
1. ✅ 前端 UI（已完成）
2. ❌ 连接到本地 Daemon（需要修复 hooks）
3. ❌ Daemon 需要提供 Social API（需要添加）

**下一步：**
- A. **先启动 Daemon**，看看当前有哪些 API
- B. **给 Daemon 添加 Social API**（Profile/Following/Feed）
- C. **修改 Web hooks**，从调用 Mock 改为调用 Daemon

要我：
1. 先启动 Daemon 检查当前状态？
2. 还是直接给 Daemon 添加 Social API？
3. 还是先修改 Web 的 hooks 架构？
