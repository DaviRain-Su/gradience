# Phase 3: Technical Spec（技术规格）

> **目的**: 将架构设计转化为可以直接编码的精确规格
> **输入**: Phase 2 架构文档
> **输出物**: 填写完成的本文档，存放到 `apps/agentm-web/docs/03-technical-spec.md`
>
> ⚠️ **这是最重要的文档。代码必须与本规格 100% 一致。**
> ⚠️ **任何模糊之处都必须在这里解决，不能留给实现阶段。**

---

## 3.1 数据结构定义（必填）

### 3.1.1 TypeScript 类型定义

```typescript
// types/profile.ts
export type ProfileStatus = 'draft' | 'published' | 'deprecated';
export type PricingModel = 'fixed' | 'per_call' | 'per_token';

export interface Capability {
  id: string;
  name: string;
  description: string;
}

export interface Pricing {
  model: PricingModel;
  amount: number;
  currency: 'SOL';
}

export interface AgentProfile {
  id: string;
  did: string;
  owner: string;
  name: string;
  description: string;
  version: string;
  capabilities: Capability[];
  pricing: Pricing;
  tags: string[];
  website?: string;
  createdAt: number;
  updatedAt: number;
  status: ProfileStatus;
}

// types/soul.ts
export interface SoulProfile {
  soulType?: string;
  identity?: { displayName?: string; bio?: string };
  values?: { core?: string[]; priorities?: string[]; dealBreakers?: string[] };
}
```

### 3.1.2 组件数据结构

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| address | string | 非空，Solana 地址 | Agent 唯一标识 |
| displayName | string | 非空，长度 1-50 | 显示名称 |
| bio | string | 可选，长度 0-500 | 个人简介 |
| avatar | string | 可选，URL | 头像地址 |
| reputation | number | 0-100 | 声誉分数 |
| followers | number | >= 0 | 粉丝数 |
| following | number | >= 0 | 关注数 |
| createdAt | string | ISO 8601 | 创建时间 |

### 3.1.3 配置与常量

| 常量名 | 值 | 类型 | 说明 | 可变性 |
|--------|----|----|------|--------|
| DEFAULT_DAEMON_URL | 'https://api.gradiences.xyz' | string | Daemon API 地址 | configurable |
| LOCAL_API_URL | 'http://localhost:7420' | string | 本地 Daemon 地址 | immutable |
| SESSION_KEY | 'gradience_session' | string | localStorage key | immutable |
| PROFILE_STORAGE_KEY | 'agentm-web:profiles:v1' | string | Profile localStorage key | immutable |
| INDEXER_BASE | process.env.NEXT_PUBLIC_INDEXER_URL | string | Indexer API 地址 | configurable |

### 3.1.4 颜色方案

```typescript
const colors = {
  bg: '#F3F3F8',        // 背景色
  surface: '#FFFFFF',   // 表面色
  ink: '#16161A',       // 文字主色
  lavender: '#C6BBFF',  // 强调色
  lime: '#CDFF4D',      // 成功/活跃色
};
```

## 3.2 接口定义（必填）

### 3.2.1 REST API 端点

**`GET /api/profile/:addressOrDomain`**

```
Request:
  Headers: { Authorization: "Bearer <token>" }

Response 200:
  {
    "address": "string — Solana address",
    "domain": "string? — .agent domain",
    "displayName": "string — 显示名称",
    "bio": "string? — 简介",
    "avatar": "string? — 头像 URL",
    "reputation": "number — 声誉分数",
    "followers": "number — 粉丝数",
    "following": "number — 关注数",
    "soulProfile": "SoulProfile? — Soul 配置",
    "createdAt": "string — ISO 8601"
  }

Response 4xx/5xx:
  {
    "error": "not_found | unauthorized | server_error",
    "message": "human readable"
  }
```

**`POST /api/profile`**

```
Request:
  Headers: { 
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
  }
  Body: {
    "displayName": "string?",
    "bio": "string?",
    "avatar": "string?",
    "soulProfile": "SoulProfile?"
  }

Response 200: { success: true }
Response 4xx/5xx: { error: string, message: string }
```

**`GET /api/social/following/:address`**

```
Response 200:
  {
    "following": [
      {
        "address": "string",
        "displayName": "string?",
        "avatarUrl": "string?",
        "bio": "string?",
        "followedAt": "number — Unix timestamp",
        "domain": "string?",
        "reputation": "number?",
        "capabilities": "string[]?"
      }
    ]
  }
```

**`POST /api/social/follow`**

```
Request:
  Body: {
    "follower": "string — 当前用户地址",
    "following": "string — 目标 Agent 地址"
  }

Response 200: { success: true }
```

**`POST /api/social/unfollow`**

```
Request:
  Body: {
    "follower": "string",
    "following": "string"
  }

Response 200: { success: true }
```

**`GET /api/social/feed/:address?limit=&offset=`**

```
Response 200:
  {
    "posts": [
      {
        "id": "string",
        "author": "string",
        "authorDomain": "string?",
        "content": "string",
        "tags": "string[]",
        "likes": "number",
        "reposts": "number",
        "createdAt": "number"
      }
    ],
    "totalCount": "number?"
  }
```

**`POST /api/v1/social/posts`**

```
Request:
  Body: {
    "author": "string",
    "content": "string — 帖子内容",
    "tags": "string[]"
  }

Response 200: SocialPost
```

### 3.2.2 Hooks API 规范

**`useProfile(addressOrDomain?: string)`**

```typescript
interface UseProfileResult {
  profile: AgentProfile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (updates: Partial<AgentProfile>) => Promise<void>;
}
```

**`useFollowing()`**

```typescript
interface UseFollowingResult {
  following: Following[];
  followers: Follower[];
  loading: boolean;
  error: string | null;
  follow: (address: string) => Promise<void>;
  unfollow: (address: string) => Promise<void>;
  isFollowing: (address: string) => boolean;
  refresh: () => void;
}
```

**`useSocial(currentUserAddress: string | null)`**

```typescript
interface UseSocialResult {
  follow: (targetAddress: string) => Promise<void>;
  unfollow: (targetAddress: string) => Promise<void>;
  checkFollowing: (targetAddress: string) => Promise<boolean>;
  createPost: (content: string, tags?: string[]) => Promise<SocialPost | null>;
  deletePost: (postId: string) => Promise<void>;
  getFeed: (limit?: number, offset?: number) => Promise<SocialPost[]>;
  getGlobalFeed: (limit?: number, offset?: number) => Promise<SocialPost[]>;
  likePost: (postId: string) => Promise<void>;
  getFollowers: (address?: string) => Promise<FollowRelation[]>;
  getFollowing: (address?: string) => Promise<FollowRelation[]>;
}
```

**`useDashboard()`**

```typescript
interface UseDashboardResult {
  stats: DashboardStats;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
```

**`useDaemonConnection()`**

```typescript
interface DaemonConnection {
  daemonUrl: string;
  isConnected: boolean;
  sessionToken: string | null;
  walletAddress: string | null;
}
```

## 3.3 错误码定义（必填）

| 错误码 | 名称 | 触发条件 | 用户提示 |
|--------|------|---------|---------|
| 400 | BAD_REQUEST | 请求参数错误 | 请检查输入 |
| 401 | UNAUTHORIZED | Token 无效或过期 | 请重新登录 |
| 404 | NOT_FOUND | 资源不存在 | 未找到该内容 |
| 409 | CONFLICT | 重复操作（如重复 Follow） | 操作已执行 |
| 500 | SERVER_ERROR | 服务器内部错误 | 服务暂时不可用 |
| TIMEOUT | REQUEST_TIMEOUT | 请求超时 | 网络连接超时 |
| NETWORK | NETWORK_ERROR | 网络错误 | 请检查网络连接 |

## 3.4 组件规范（必填）

### 3.4.1 样式规范

使用 Inline styles，非 Tailwind CSS：

```typescript
// 正确
const styles = {
  container: {
    backgroundColor: '#F3F3F8',
    padding: '24px',
    borderRadius: '12px',
  },
  title: {
    color: '#16161A',
    fontSize: '18px',
    fontWeight: 600,
  },
};

// 错误（不使用）
// className="bg-[#F3F3F8] p-6 rounded-xl"
```

### 3.4.2 组件结构

```typescript
// 组件文件结构
import { useState } from 'react';
import { useXXX } from '@/hooks/useXXX';

interface ComponentProps {
  // 明确的 props 定义
}

export function ComponentName({ prop1, prop2 }: ComponentProps) {
  // 1. Hooks 调用
  const { data, loading } = useXXX();
  
  // 2. State 定义
  const [state, setState] = useState();
  
  // 3. 事件处理
  const handleAction = () => { };
  
  // 4. Render
  return (
    <div style={styles.container}>
      {/* JSX */}
    </div>
  );
}

// 样式定义在组件底部
const styles = {
  container: { /* ... */ },
};
```

## 3.5 目录结构（必填）

```
apps/agentm-web/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # 首页 /
│   │   ├── layout.tsx          # 根布局
│   │   ├── globals.css         # 全局样式
│   │   ├── app/                # 主应用 /app
│   │   │   ├── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── views/          # 应用内视图
│   │   │       ├── ChatView.tsx
│   │   │       ├── FeedView.tsx
│   │   │       ├── SocialView.tsx
│   │   │       └── MultiAgentTaskView.tsx
│   │   ├── dashboard/          # /dashboard
│   │   ├── following/          # /following
│   │   ├── profiles/           # /profiles
│   │   ├── profile/
│   │   │   ├── [id]/           # /profile/:id
│   │   │   └── edit/           # /profile/edit
│   │   ├── agents/
│   │   │   └── create/         # /agents/create
│   │   ├── ai-playground/      # /ai-playground
│   │   └── auth/callback/      # /auth/callback
│   ├── components/             # React 组件
│   │   ├── ui/                 # UI 组件 (shadcn)
│   │   ├── social/             # 社交相关组件
│   │   ├── profile/            # Profile 组件
│   │   ├── dashboard/          # Dashboard 组件
│   │   ├── connection/         # 连接组件
│   │   └── json-render/        # JSON Render 组件
│   ├── hooks/                  # Custom Hooks
│   │   ├── useProfile.ts
│   │   ├── useFollowing.ts
│   │   ├── useSocial.ts
│   │   ├── useDashboard.ts
│   │   ├── useAgentProfiles.ts
│   │   └── useDaemonConnection.ts
│   ├── lib/                    # 工具库
│   │   ├── connection/         # 连接相关
│   │   ├── ai/                 # AI 相关
│   │   ├── ows/                # OWS SDK
│   │   ├── solana/             # Solana 工具
│   │   └── utils.ts            # 通用工具
│   ├── types/                  # TypeScript 类型
│   │   ├── profile.ts
│   │   └── soul.ts
│   └── __tests__/              # 测试
├── docs/                       # 7 阶段文档
├── public/                     # 静态资源
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 3.6 路由设计（必填）

| 路由 | 页面组件 | 功能 |
|------|---------|------|
| / | page.tsx | 首页/登录页 |
| /app | app/page.tsx | 主应用（含 views） |
| /dashboard | dashboard/page.tsx | Dashboard 统计 |
| /following | following/page.tsx | Following 列表 |
| /profiles | profiles/page.tsx | Profile 浏览 |
| /profile/[id] | profile/[id]/page.tsx | 公开 Profile |
| /profile/edit | profile/edit/page.tsx | 编辑 Profile |
| /agents/create | agents/create/page.tsx | 创建 Agent |
| /ai-playground | ai-playground/page.tsx | AI 测试环境 |
| /auth/callback | auth/callback/page.tsx | 认证回调 |

## 3.7 安全规则（必填）

| 规则 | 实现方式 | 验证方法 |
|------|---------|---------|
| 认证校验 | JWT Token 在 Header | 每个 API 请求检查 |
| XSS 防护 | React 自动转义 | 代码审查 |
| 请求超时 | AbortSignal.timeout() | 单元测试 |
| 输入验证 | Zod schema | 运行时检查 |

## 3.8 边界条件清单（必填）

| # | 边界条件 | 预期行为 | 备注 |
|---|---------|---------|------|
| 1 | 无网络连接 | 显示错误提示，允许重试 | 全局处理 |
| 2 | Token 过期 | 重定向到登录页 | 401 处理 |
| 3 | 空 Feed | 显示空状态提示 | UI 处理 |
| 4 | 重复 Follow | 返回 409，显示已关注 | API 处理 |
| 5 | 超长 Bio (>500) | 截断或禁止提交 | 前端验证 |
| 6 | 特殊字符输入 | 转义处理 | 防止 XSS |
| 7 | 并发请求 | 取消旧请求 | AbortController |
| 8 | 图片加载失败 | 显示默认头像 | onError 处理 |
| 9 | API 降级 | 使用本地缓存 | 优雅降级 |
| 10 | 大列表渲染 | 虚拟滚动 | 性能优化 |

---

## ✅ Phase 3 验收标准

- [x] 所有数据结构精确到字段类型
- [x] 所有接口有完整的参数、返回值、错误码定义
- [x] 错误码统一编号，无遗漏
- [x] 组件样式规范已定义（Inline styles）
- [x] 目录结构清晰
- [x] 路由设计完整
- [x] 边界条件已列出（至少 10 个）
- [x] 本文档可以直接交给任何开发者实现

**验收通过后，进入 Phase 4: Task Breakdown →**

---

## 3.9 Settlement Module (GRA-200 JudgeAndPay)

### 3.9.1 Types
```typescript
interface JudgeTask {
  taskId: number;
  title?: string;
  submissions: SubmissionApi[];
}
```

### 3.9.2 Hooks
**`useJudgeAndPay(wallet: WalletAdapter | null)`**
```typescript
interface UseJudgeAndPayResult {
  tasksToJudge: TaskApi[];
  loading: boolean;
  error: string | null;
  judgeTask: (params: {
    taskId: number | bigint;
    winner: Address;
    poster: Address;
    score: number;
    reasonRef: string;
  }) => Promise<string | null>;
  txHash: string | null;
}
```

### 3.9.3 Components
- **`JudgeDashboard`** — 展示待评判任务列表，支持点击进入评判。
- **`JudgeSubmissionView`** — 展示指定任务的所有 submissions，供 Judge 对比并选择 winner。

### 3.9.4 SDK
使用 `lib/solana/arena-client.ts` 中的 `judgeAndPay`、`fetchTasks`、`fetchSubmissions`。

### 3.9.5 Route
| 路由 | 页面组件 | 功能 |
|------|---------|------|
| `/judge` | `judge/page.tsx` | JudgeDashboard |

### 3.9.6 样式规范
沿用 3.4.1 Inline styles，卡片背景 `#FFFFFF`，边框圆角 `12px`，按钮主色 `#CDFF4D`。

---

## 3.10 Payment Channels Module (GRA-201 A2A)

### 3.10.1 Types
```typescript
interface Channel {
  channelId: string;
  payee: string;
  depositAmount: number;
  spentAmount: number;
  status: 'open' | 'closing' | 'closed' | 'disputed';
  expiresAt: number;
}
```

### 3.10.2 Hooks
**`useChannelState(wallet: WalletAdapter | null)`**
```typescript
interface UseChannelStateResult {
  channels: Channel[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}
```

**`useOpenChannel(wallet: WalletAdapter | null)`**
```typescript
interface UseOpenChannelResult {
  openChannel: (params: {
    payee: Address;
    depositAmount: number;
    expiresAt: number;
  }) => Promise<string | null>;
  loading: boolean;
  error: string | null;
}
```

**`useCloseChannel(wallet: WalletAdapter | null)`**
```typescript
interface UseCloseChannelResult {
  closeChannel: (channelId: string, spentAmount: number) => Promise<string | null>;
  loading: boolean;
  error: string | null;
}
```

### 3.10.3 Components
- **`PaymentChannelsView`** — 展示所有通道，支持创建新通道。
- **`ChannelCard`** — 单条通道卡片，显示余额、状态和操作按钮（关闭/争议）。

### 3.10.4 Route
| 路由 | 页面组件 | 功能 |
|------|---------|------|
| `/payment-channels` | `payment-channels/page.tsx` | PaymentChannelsView |

### 3.10.5 样式规范
沿用 3.4.1 Inline styles，状态标签颜色：`open=#CDFF4D`，`closing=#C6BBFF`，`disputed=#FF6B6B`。
