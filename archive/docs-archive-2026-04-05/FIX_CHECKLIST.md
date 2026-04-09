# 修复清单

## 🚨 紧急修复（阻塞构建）

### 1. 安装缺失依赖

```bash
cd apps/agentm-web

# JSON Render 相关
pnpm add @json-render/core @json-render/react

# Base UI 相关
pnpm add @base-ui/react

# 测试相关
pnpm add -D @playwright/test vitest
```

### 2. 修复类型错误

文件: `src/app/app/page.tsx`

```typescript
// 删除或注释未使用的类型
// OWSAgentSubWallet
// SolanaWalletCandidate
// OWSAgentWalletBinding
```

---

## ⚠️ 重要修复（影响功能）

### 3. 提取公共函数

创建 `src/lib/connection/useDaemonConnection.ts`:

```typescript
const DEFAULT_DAEMON_URL = 'http://localhost:7420';

export function useDaemonConnection() {
    try {
        const { useConnection } = require('@/lib/connection/ConnectionContext');
        const conn = useConnection();
        return {
            daemonUrl: conn.daemonUrl || DEFAULT_DAEMON_URL,
            isConnected: conn.isConnected || false,
        };
    } catch {
        return { daemonUrl: DEFAULT_DAEMON_URL, isConnected: false };
    }
}
```

然后修改 hooks 导入:

```typescript
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';
```

### 4. 定义 Database 接口

文件: `apps/agent-daemon/src/api/routes/social.ts`

```typescript
interface Database {
    query(sql: string, params?: unknown[]): Promise<unknown>;
    run(sql: string, params?: unknown[]): Promise<{ lastID: number; changes: number }>;
    get(sql: string, params?: unknown[]): Promise<unknown>;
    all(sql: string, params?: unknown[]): Promise<unknown[]>;
}
```

---

## 📋 一般修复（优化）

### 5. 修复类型错误

文件: `src/app/agents/create/page.tsx`

```typescript
// 第 157, 175, 192 行
// 添加显式类型
onChange={(value: string) => ...}
onCheckedChange={(checked: boolean) => ...}
```

### 6. 删除或修复测试文件

```bash
# 选项 A: 安装依赖使测试可用
pnpm add -D @playwright/test vitest

# 选项 B: 暂时删除测试文件
rm -rf e2e/ src/__tests__/
```

---

## ✅ 验证步骤

修复后运行:

```bash
# 1. 安装依赖
cd apps/agentm-web && pnpm install

# 2. 类型检查
npx tsc --noEmit

# 3. 构建
pnpm build

# 4. 启动测试
pnpm dev
```

---

## 📊 修复优先级

| 优先级 | 问题                     | 时间  | 影响     |
| ------ | ------------------------ | ----- | -------- |
| P0     | 安装 @json-render/core   | 5min  | 阻塞构建 |
| P0     | 安装 @base-ui/react      | 5min  | 阻塞构建 |
| P1     | 提取 useDaemonConnection | 15min | 代码重复 |
| P1     | 定义 Database 接口       | 10min | 类型安全 |
| P2     | 修复 page.tsx 类型       | 10min | 类型检查 |
| P2     | 处理测试文件             | 5min  | 类型检查 |

**总时间**: ~50 分钟
