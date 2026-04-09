# Daemon + Web 集成任务清单

## 🐛 发现的 Bug

### Bug 1: 端口配置不一致

- **问题**: Daemon 使用 7420，Web 使用 3939
- **影响**: Web 无法连接到 Daemon
- **修复**: 统一为 7420

### Bug 2: Daemon 缺少 Social API

- **问题**: 没有 Profile/Following/Feed 的 API 端点
- **影响**: Web 社交功能无法工作
- **修复**: 添加 Social API 路由

### Bug 3: Web hooks 使用 Mock 数据

- **问题**: useProfile/useFollowing/useFeed 都是假数据
- **影响**: 用户看不到真实数据
- **修复**: 改为调用 Daemon API

---

## 📋 任务列表

### 任务 1: 统一端口配置

**文件**: `apps/agentm-web/src/components/connection/ConnectionPanel.tsx`

```typescript
// 修改前
const [daemonUrl, setDaemonUrl] = useState('http://localhost:3939');

// 修改后
const [daemonUrl, setDaemonUrl] = useState('http://localhost:7420');
```

**检查其他文件**:

- `apps/agentm-web/src/hooks/use-web-entry.ts`
- `apps/agentm-web/src/lib/connection/api.ts`
- `apps/agentm-web/src/app/app/page.tsx`

---

### 任务 2: Daemon 添加 Social API

#### 2.1 创建 Profile Route

**文件**: `apps/agent-daemon/src/api/routes/profile.ts`

```typescript
import type { FastifyInstance } from 'fastify';

export function registerProfileRoutes(app: FastifyInstance) {
    // GET /api/profile/:address
    app.get('/api/profile/:address', async (request, reply) => {
        const { address } = request.params as { address: string };
        // 从数据库获取 Profile
        // 返回 Profile 数据
    });

    // POST /api/profile
    app.post('/api/profile', async (request, reply) => {
        // 更新 Profile
    });
}
```

#### 2.2 创建 Following Routes

**文件**: `apps/agent-daemon/src/api/routes/following.ts`

```typescript
// GET /api/followers/:address
// GET /api/following/:address
// POST /api/follow
// POST /api/unfollow
```

#### 2.3 创建 Feed Route

**文件**: `apps/agent-daemon/src/api/routes/feed.ts`

```typescript
// GET /api/feed
// GET /api/posts/:id
// POST /api/posts
// POST /api/posts/:id/like
```

#### 2.4 注册路由

**文件**: `apps/agent-daemon/src/api/server.ts`

```typescript
import { registerProfileRoutes } from './routes/profile.js';
import { registerFollowingRoutes } from './routes/following.js';
import { registerFeedRoutes } from './routes/feed.js';

// 在 createAPIServer 中添加
registerProfileRoutes(app);
registerFollowingRoutes(app);
registerFeedRoutes(app);
```

---

### 任务 3: Web hooks 调用 Daemon API

#### 3.1 修改 useProfile

**文件**: `apps/agentm-web/src/hooks/useProfile.ts`

```typescript
import { useConnection } from '@/lib/connection/api';

export function useProfile(addressOrDomain?: string) {
    const { daemonUrl, isConnected } = useConnection();

    useEffect(() => {
        if (!isConnected || !addressOrDomain) return;

        // 改为调用 Daemon API
        fetch(`${daemonUrl}/api/profile/${addressOrDomain}`)
            .then((res) => res.json())
            .then((data) => setProfile(data));
    }, [addressOrDomain, daemonUrl, isConnected]);
}
```

#### 3.2 修改 useFollowing

**文件**: `apps/agentm-web/src/hooks/useFollowing.ts`

```typescript
// 改为调用:
// GET ${daemonUrl}/api/followers/${address}
// GET ${daemonUrl}/api/following/${address}
// POST ${daemonUrl}/api/follow
// POST ${daemonUrl}/api/unfollow
```

#### 3.3 修改 useFeed

**文件**: `apps/agentm-web/src/hooks/useFeed.ts`

```typescript
// 改为调用:
// GET ${daemonUrl}/api/feed?page=${page}
// POST ${daemonUrl}/api/posts/${id}/like
```

---

### 任务 4: 数据库 Schema（如果需要）

检查 Daemon 的 SQLite 数据库是否需要新表：

```sql
-- profiles 表
CREATE TABLE profiles (
  address TEXT PRIMARY KEY,
  domain TEXT,
  display_name TEXT,
  bio TEXT,
  reputation INTEGER DEFAULT 0,
  soul_profile JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- following 表
CREATE TABLE following (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_address TEXT NOT NULL,
  following_address TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_address, following_address)
);

-- posts 表
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_address TEXT NOT NULL,
  content TEXT NOT NULL,
  media JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  likes INTEGER DEFAULT 0
);
```

---

## 🚀 执行顺序

```
Step 1: 修复端口配置（5分钟）
    ↓
Step 2: Daemon 添加 Profile API（30分钟）
    ↓
Step 3: Web useProfile 调用 Daemon（15分钟）
    ↓
Step 4: 测试 Profile 功能（15分钟）
    ↓
Step 5: Daemon 添加 Following API（30分钟）
    ↓
Step 6: Web useFollowing 调用 Daemon（15分钟）
    ↓
Step 7: Daemon 添加 Feed API（30分钟）
    ↓
Step 8: Web useFeed 调用 Daemon（15分钟）
    ↓
Step 9: 完整测试（30分钟）

总计: 约 3 小时
```

---

## ✅ 验收标准

每个任务完成后检查：

- [ ] 代码编译通过
- [ ] 没有 TypeScript 错误
- [ ] Daemon 启动正常
- [ ] Web 能连接到 Daemon
- [ ] API 调用返回正确数据

全部完成后：

- [ ] Web 显示真实 Profile 数据
- [ ] Web 显示真实 Following 数据
- [ ] Web 显示真实 Feed 数据
- [ ] 可以 Follow/Unfollow
- [ ] 可以 Like 帖子
