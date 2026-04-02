# Phase 3: Technical Spec — Agent.im

> **范围**: `apps/agent-im/` — Gradience 协议参考客户端（桌面 IM 应用）
> **定位**: 人和 Agent 共用的超级入口，双界面设计（GUI + API）

---

## 1. 技术栈

| 项目 | 版本/说明 |
|------|---------|
| Electrobun | 桌面框架（TypeScript + Bun，系统 webview，~12MB） |
| React | 19.x，前端 UI |
| Vite | 构建工具（Electrobun 推荐） |
| Tailwind CSS | 样式 |
| Zustand | 状态管理 |
| @privy-io/react-auth | Google OAuth → 嵌入式 Solana 钱包 |
| @gradience/sdk | 链上调用（声誉、任务） |
| magicblock-a2a.ts | A2A 传输层（迁移自 agent-social） |
| ranking.ts | Agent 排名算法（迁移自 agent-social） |
| Whisper.cpp (WASM) | 语音识别（本地） |
| Web Speech API | 语音合成（浏览器内置 TTS） |

---

## 2. 文件结构与职责

```
apps/agent-im/
├── docs/
│   ├── 01-prd.md
│   ├── 02-architecture.md
│   ├── 03-technical-spec.md（本文）
│   └── 05-test-spec.md
├── src/
│   ├── main/                          — Electrobun 主进程（Bun 运行时）
│   │   ├── index.ts                   — 主入口，窗口创建，IPC 注册
│   │   ├── auth.ts                    — Privy 认证封装
│   │   ├── api-server.ts             — localhost:3939 API（Agent 接入）
│   │   ├── voice-engine.ts           — Whisper + TTS 管理
│   │   └── store.ts                  — SQLite 本地存储
│   ├── renderer/                      — 前端（React + Vite）
│   │   ├── App.tsx                    — 主布局
│   │   ├── views/
│   │   │   ├── MeView.tsx            — "我的"视角
│   │   │   ├── DiscoverView.tsx      — "社交"发现广场
│   │   │   └── ChatView.tsx          — 对话视角
│   │   ├── components/
│   │   │   ├── reputation-panel.tsx   — 声誉面板（迁移）
│   │   │   ├── task-history.tsx       — 任务历史（迁移）
│   │   │   ├── agent-discovery.tsx    — Agent 列表（迁移）
│   │   │   ├── agent-profile.tsx      — Agent 详情（迁移）
│   │   │   ├── chat-message.tsx       — 消息气泡（新建）
│   │   │   ├── chat-input.tsx         — 输入框 + 语音按钮（新建）
│   │   │   └── sidebar.tsx            — 侧边栏导航（新建）
│   │   ├── lib/
│   │   │   ├── a2a-client.ts          — A2A 封装（迁移 magicblock-a2a.ts）
│   │   │   ├── ranking.ts             — 排名算法（迁移）
│   │   │   ├── indexer-api.ts        — Indexer REST 客户端（新建）
│   │   │   └── store.ts              — Zustand 状态管理（新建）
│   │   └── hooks/
│   │       ├── useAuth.ts             — 认证 hook
│   │       ├── useReputation.ts       — 声誉查询 hook
│   │       ├── useA2A.ts              — A2A 消息 hook
│   │       └── useVoice.ts            — 语音交互 hook
│   └── shared/
│       └── types.ts                   — 主进程/渲染进程共享类型
├── electrobun.config.ts
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 3. 数据结构

### 3.1 认证状态

```typescript
interface AuthState {
    /** 是否已登录 */
    authenticated: boolean;
    /** Solana 公钥（Base58 编码） */
    publicKey: string | null;
    /** Google 邮箱（仅用于显示，不上链） */
    email: string | null;
    /** Privy 用户 ID */
    privyUserId: string | null;
}
```

### 3.2 A2A 消息（复用已有协议）

以下类型直接从 `magicblock-a2a.ts` 迁移，不做修改：

```typescript
// 原样迁移，不修改
interface A2AEnvelope {
    id: string;                    // `${Date.now()}-${Math.random()}`
    from: string;                  // 发送方地址
    to: string;                    // 接收方地址
    topic: string;                 // 主题
    message: string;               // 正文
    createdAt: number;             // 创建时间 ms
    paymentMicrolamports: number;  // 微支付金额
}

interface A2ADelivery {
    envelope: A2AEnvelope;
    direction: 'incoming' | 'outgoing';
    latencyMs: number;
    channel: string;
    receivedAt: number;
}

interface SendInviteInput {
    to: string;
    topic: string;
    message: string;
}

interface MicropaymentPolicy {
    baseMicrolamports: number;     // 默认 100
    perByteMicrolamports: number;  // 默认 2
}
```

### 3.3 对话（新增，本地存储）

```typescript
interface Conversation {
    /** 对方地址 */
    peerAddress: string;
    /** 对方名称（来自 Indexer 或手动设置） */
    peerName: string | null;
    /** 最后一条消息摘要 */
    lastMessage: string;
    /** 最后消息时间 */
    lastMessageAt: number;
    /** 未读消息数 */
    unreadCount: number;
}

interface ChatMessage {
    /** A2AEnvelope.id */
    id: string;
    /** 对方地址 */
    peerAddress: string;
    /** 方向 */
    direction: 'incoming' | 'outgoing';
    /** 主题 */
    topic: string;
    /** 正文 */
    message: string;
    /** 微支付金额 */
    paymentMicrolamports: number;
    /** 消息状态 */
    status: 'sending' | 'sent' | 'delivered' | 'failed';
    /** 创建时间 */
    createdAt: number;
}
```

### 3.4 Agent 发现（复用已有类型）

```typescript
// 原样迁移自 ranking.ts
interface AgentDiscoveryRow {
    agent: string;
    stake: number;
    weight: number;
    reputation: {
        global_avg_score: number;
        global_completed: number;
        global_total_applied: number;
        win_rate: number;
    } | null;
}
```

### 3.5 应用全局状态（Zustand）

```typescript
interface AppStore {
    // 认证
    auth: AuthState;
    setAuth: (auth: AuthState) => void;

    // 当前视图
    activeView: 'me' | 'discover' | 'chat';
    setActiveView: (view: AppStore['activeView']) => void;

    // 对话列表
    conversations: Conversation[];
    activeConversation: string | null;  // peerAddress
    setActiveConversation: (peer: string | null) => void;

    // 消息（按 peerAddress 分组）
    messages: Map<string, ChatMessage[]>;
    addMessage: (msg: ChatMessage) => void;

    // Agent 发现
    discoveryRows: AgentDiscoveryRow[];
    discoveryQuery: string;
    setDiscoveryQuery: (q: string) => void;

    // 声誉
    myReputation: ReputationOnChain | null;
}
```

---

## 4. 认证模块（auth.ts）

### Privy 集成

```typescript
// 初始化配置
const privyConfig = {
    appId: 'GRADIENCE_PRIVY_APP_ID',
    loginMethods: ['google'],
    embeddedWallets: {
        createOnLogin: 'all-users',
        chains: ['solana'],
    },
};
```

### 登录流程

```
1. 用户点击"Google 登录"
2. Privy SDK 弹出 OAuth 窗口
3. Google 认证成功 → Privy 回调
4. Privy 自动创建/恢复 Solana keypair（MPC 分片，用户无感）
5. 获取 publicKey → 更新 AuthState
6. 用 publicKey 查询 Indexer（声誉 + 任务历史）
7. 渲染主界面
```

### 登出

```
1. 清除 Privy 会话
2. 清除 AuthState（publicKey = null）
3. 保留本地消息历史（不删除 IndexedDB）
4. 返回登录页
```

---

## 5. 对话系统（ChatView）

### 5.1 消息发送

```typescript
async function sendMessage(to: string, topic: string, message: string): Promise<void> {
    // 1. 创建本地消息记录（status: 'sending'）
    const localMsg: ChatMessage = {
        id: `${Date.now()}-${Math.random()}`,
        peerAddress: to,
        direction: 'outgoing',
        topic,
        message,
        paymentMicrolamports: estimateMicropayment(topic, message),
        status: 'sending',
        createdAt: Date.now(),
    };
    store.addMessage(localMsg);

    // 2. 通过 A2A 客户端发送
    try {
        agent.sendInvite({ to, topic, message });
        updateMessageStatus(localMsg.id, 'sent');
    } catch (err) {
        updateMessageStatus(localMsg.id, 'failed');
    }
}
```

### 5.2 消息接收

```typescript
// 在 A2A Agent 启动时注册监听
agent.onDelivery((delivery) => {
    if (delivery.direction === 'incoming') {
        const msg: ChatMessage = {
            id: delivery.envelope.id,
            peerAddress: delivery.envelope.from,
            direction: 'incoming',
            topic: delivery.envelope.topic,
            message: delivery.envelope.message,
            paymentMicrolamports: delivery.envelope.paymentMicrolamports,
            status: 'delivered',
            createdAt: delivery.envelope.createdAt,
        };
        store.addMessage(msg);
        updateConversation(msg.peerAddress, msg);
    }
});
```

### 5.3 本地存储

消息历史存储在 IndexedDB（渲染进程）或 SQLite（主进程），结构：

```
表 conversations:
  peer_address TEXT PRIMARY KEY
  peer_name TEXT
  last_message TEXT
  last_message_at INTEGER
  unread_count INTEGER

表 messages:
  id TEXT PRIMARY KEY
  peer_address TEXT NOT NULL
  direction TEXT NOT NULL  -- 'incoming' | 'outgoing'
  topic TEXT
  message TEXT
  payment_microlamports INTEGER
  status TEXT              -- 'sending' | 'sent' | 'delivered' | 'failed'
  created_at INTEGER
  INDEX idx_peer_time (peer_address, created_at)
```

---

## 6. A2A API 服务（api-server.ts）

### 6.1 概述

主进程启动一个 Bun HTTP 服务（localhost:3939），Agent 程序通过此 API 接入。
GUI 用户操作和 API 调用产生**完全相同的链上效果**。

### 6.2 端点

```typescript
// POST /a2a/send — 发送 A2A 消息
interface SendRequest {
    to: string;
    topic: string;
    message: string;
}
interface SendResponse {
    ok: boolean;
    envelope: A2AEnvelope;
}

// GET /a2a/messages?peer={address}&limit={n}&before={timestamp}
interface MessagesResponse {
    messages: ChatMessage[];
    hasMore: boolean;
}

// GET /discover/agents?category={cat}&query={q}
interface DiscoverResponse {
    agents: AgentDiscoveryRow[];
}

// GET /me/reputation
interface ReputationResponse {
    publicKey: string;
    reputation: ReputationOnChain | null;
}

// POST /tasks/post
interface PostTaskRequest {
    description: string;
    evalRef: string;
    reward: number;
    mint?: string;
    deadline: number;
    minStake: number;
    category: number;
}
interface PostTaskResponse {
    ok: boolean;
    signature: string;
    taskId: number;
}

// GET /tasks/list?status={open|completed}&limit={n}
interface TaskListResponse {
    tasks: TaskSummary[];
}

// GET /status
interface StatusResponse {
    version: string;
    authenticated: boolean;
    publicKey: string | null;
    a2aConnected: boolean;
    uptime: number;
}
```

### 6.3 安全

- 仅绑定 `127.0.0.1:3939`，不暴露到网络
- 可选 Bearer token 认证（通过启动参数 `--api-token` 设置）
- 无 CORS（仅本地访问）

---

## 7. 语音引擎（voice-engine.ts）

### 7.1 语音识别（Speech-to-Text）

```typescript
interface VoiceEngine {
    /** 开始录音 */
    startRecording(): void;
    /** 停止录音并转文字 */
    stopAndTranscribe(): Promise<string>;
    /** 是否正在录音 */
    isRecording: boolean;
}
```

**实现**：
- 首选：Whisper.cpp 编译为 WASM（~40MB 模型 `whisper-base`）
- 备选：Web Speech API（`webkitSpeechRecognition`，浏览器内置，无需模型）
- 自动选择：WASM 加载成功用 Whisper，否则降级 Web Speech API

### 7.2 语音合成（Text-to-Speech）

```typescript
interface TTSEngine {
    /** 文字转语音并播放 */
    speak(text: string): Promise<void>;
    /** 停止播放 */
    stop(): void;
}
```

**实现**：Web Speech API `speechSynthesis`（所有现代浏览器/webview 内置）

### 7.3 语音交互流程

```
用户按住"语音"按钮
  → startRecording()
  → 松开按钮
  → stopAndTranscribe() → text
  → 判断意图：
      如果是命令（"发布任务"/"搜索 Agent"）→ 执行对应操作
      如果是消息 → sendMessage(activeConversation, 'voice', text)
  → Agent 回复 → TTS speak(reply)
```

---

## 8. 主布局（App.tsx）

```
┌──────────────────────────────────────────────┐
│  顶栏：Agent.im    [声誉分] [钱包地址] [设置] │
├──────┬───────────────────────────────────────┤
│ 侧栏 │             内容区                    │
│      │                                       │
│ [我的]│  根据 activeView 渲染：               │
│ [发现]│  - MeView:      声誉面板 + 任务历史   │
│ [对话]│  - DiscoverView: Agent 排名列表       │
│      │  - ChatView:     消息列表 + 输入框     │
│ ──── │                                       │
│ 对话  │                                       │
│ 列表  │                                       │
│ Alice │                                       │
│ Bob   │                                       │
│ ...   │                                       │
│      │                    [🎙️ 语音按钮]       │
└──────┴───────────────────────────────────────┘
```

### 路由

| 视图 | 组件 | 触发 |
|------|------|------|
| 登录 | `LoginView` | 未认证时 |
| 我的 | `MeView` | 侧栏"我的" |
| 发现 | `DiscoverView` | 侧栏"发现" |
| 对话 | `ChatView` | 侧栏"对话"或对话列表 |
| Agent 详情 | `AgentProfileModal` | 发现列表点击 Agent |

不使用 react-router（桌面应用无 URL），用 Zustand `activeView` 切换。

---

## 9. Indexer API 客户端（indexer-api.ts）

```typescript
class IndexerClient {
    constructor(private baseUrl: string = 'http://127.0.0.1:8787') {}

    async getReputation(address: string): Promise<ReputationApi | null>;
    async getTasks(params: { status?: string; poster?: string; limit?: number }): Promise<TaskApi[]>;
    async getJudgePool(category: number): Promise<JudgePoolEntryApi[]>;
    async getTaskSubmissions(taskId: number): Promise<SubmissionApi[]>;
}
```

**错误处理**：Indexer 不可用时显示"离线模式"提示，本地缓存数据仍可用。

---

## 10. 迁移清单

| 源文件 | 目标文件 | 修改内容 |
|--------|---------|---------|
| `agent-me/frontend/src/components/reputation-panel.tsx` | `agent-im/src/renderer/components/reputation-panel.tsx` | 移除 `'use client'`；`createSdk()` → 从 Zustand store 获取 |
| `agent-me/frontend/src/components/task-history.tsx` | `agent-im/src/renderer/components/task-history.tsx` | 同上 |
| `agent-me/frontend/src/components/wallet-manager.tsx` | 删除 | 被 Privy 替代，不迁移 |
| `agent-social/frontend/src/components/agent-discovery.tsx` | `agent-im/src/renderer/components/agent-discovery.tsx` | 移除 `'use client'`；props 改为从 Zustand 读取 |
| `agent-social/frontend/src/components/agent-profile.tsx` | `agent-im/src/renderer/components/agent-profile.tsx` | 同上 |
| `agent-social/frontend/src/components/invite-stub.tsx` | `agent-im/src/renderer/components/chat-input.tsx` | 重构为 IM 输入框，保留微支付逻辑 |
| `agent-social/frontend/src/lib/magicblock-a2a.ts` | `agent-im/src/renderer/lib/a2a-client.ts` | 原样迁移，不修改接口 |
| `agent-social/frontend/src/lib/ranking.ts` | `agent-im/src/renderer/lib/ranking.ts` | 原样迁移 |
| `agent-social/frontend/src/lib/sdk.ts` | `agent-im/src/renderer/lib/sdk.ts` | 原样迁移 |

---

## 11. 接口契约

### → Indexer REST API

| 端点 | 用途 |
|------|------|
| `GET /api/agents/{pubkey}/reputation` | 声誉查询 |
| `GET /api/tasks?poster={pubkey}&status=` | 任务列表 |
| `GET /api/judge-pool/{category}` | Agent 发现 |
| `GET /api/tasks/{id}/submissions` | 提交列表 |

### → @gradience/sdk

| 方法 | 用途 |
|------|------|
| `sdk.reputation.get(address)` | 链上声誉 PDA |
| `sdk.task.post(...)` | 发布任务 |
| `sdk.task.apply(...)` | 申请任务 |
| `sdk.judgePool.list(category)` | JudgePool 查询 |

### → A2A Protocol

| 类 | 方法 | 用途 |
|----|------|------|
| `MagicBlockA2AAgent` | `sendInvite(input)` | 发送 A2A 消息 |
| `MagicBlockA2AAgent` | `onDelivery(fn)` | 接收消息监听 |
| `MagicBlockA2AAgent` | `start()` / `stop()` | 启动/停止传输层 |
| — | `estimateMicropayment(topic, msg)` | 微支付计算 |
| — | `createDefaultMagicBlockTransport()` | 传输层自动选择 |

### → Privy SDK

| 方法 | 用途 |
|------|------|
| `usePrivy().login()` | 触发 Google OAuth |
| `usePrivy().logout()` | 登出 |
| `usePrivy().user.wallet.address` | 获取 Solana 地址 |
| `useSolanaWallets().wallets[0]` | 获取签名器 |

---

## 12. MVP 边界

**MVP 包含**：
- Google OAuth 登录 + Privy 嵌入式钱包
- "我的"视角（声誉面板 + 任务历史）
- "社交"视角（发现广场 + Agent 详情）
- 对话视角（A2A 消息收发 + 微支付）
- localhost:3939 API（Agent 平等接入）
- Electrobun 桌面打包（macOS + Windows + Linux）

**MVP 不包含**：
- 语音交互（P1，MVP 后第一优先）
- 任务发布/申请/评判（P1）
- Chain Hub 技能市场（P2）
- DashDomain 连接（P2）
- E2E 加密消息（P2）
- 8004scan 集成（P2，T49-T51）
- 移动端（后期）
