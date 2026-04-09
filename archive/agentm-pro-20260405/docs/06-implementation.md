# AgentM Pro - Implementation Guide (Phase 6)

## 1. 开发前检查清单

### 1.1 环境准备

- [ ] Node.js 20+ 已安装
- [ ] pnpm/npm 可用
- [ ] Vercel CLI 已登录 (`vercel whoami`)
- [ ] Privy App ID 已获取
- [ ] 本地 .env 文件已配置

### 1.2 代码库准备

- [ ] 从 agentm-web 复制基础代码
- [ ] 安装依赖 (`npm install`)
- [ ] 能本地运行 (`npm run dev`)

### 1.3 文档确认

- [ ] Phase 3 Technical Spec 已评审通过
- [ ] Phase 4 Task Breakdown 已确认
- [ ] Phase 5 Test Spec 测试骨架已就绪

---

## 2. 编码规范

### 2.1 文件命名

- 组件: PascalCase (e.g., `ProfileForm.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useProfile.ts`)
- Utils: camelCase (e.g., `formatDate.ts`)
- 样式: 同组件名 + `.css` (e.g., `ProfileForm.css`)

### 2.2 代码风格

```typescript
// ✅ Good: Explicit types, early returns
function ProfileCard({ profile }: { profile: AgentProfile }) {
  if (!profile) return null;

  return (
    <div className="profile-card">
      <h3>{profile.name}</h3>
    </div>
  );
}

// ❌ Bad: Implicit types, nested logic
function ProfileCard(props) {
  if (props.profile) {
    return <div>{props.profile.name}</div>;
  }
}
```

### 2.3 状态管理

- 使用 Zustand 进行全局状态管理
- 组件本地状态使用 useState
- 表单状态使用 react-hook-form (推荐)

---

## 3. 实现顺序

### Sprint 1: Foundation

```bash
# Step 1: 复制并初始化
mkdir apps/agentm-pro/src
cp -r apps/agentm-web/src/* apps/agentm-pro/src/
cd apps/agentm-pro
npm install

# Step 2: 清理不需要的代码
# - 删除 views/ChatView.tsx (Pro 不需要聊天)
# - 删除 views/DiscoverView.tsx (Pro 是管理端)
# - 保留 auth hooks 和基础组件

# Step 3: 创建基础路由
# src/App.tsx 添加路由配置

# Step 4: 实现 Layout
# src/components/layout/Sidebar.tsx
# src/components/layout/Header.tsx
```

### Sprint 2: Profile 管理

```bash
# Step 1: 创建 ProfileForm
# src/components/profile/ProfileForm.tsx

# Step 2: 创建 useProfile hook
# src/hooks/useProfile.ts

# Step 3: 实现 DashboardView
# src/views/DashboardView.tsx

# Step 4: 实现 ProfileCreateView
# src/views/ProfileCreateView.tsx
```

### Sprint 3: Stats

```bash
# Step 1: 创建 ReputationScore 组件
# src/components/stats/ReputationScore.tsx

# Step 2: 创建 useStats hook
# src/hooks/useStats.ts

# Step 3: 实现 StatsView
# src/views/StatsView.tsx
```

---

## 4. 常见问题及解决

### 4.1 Privy 集成问题

**问题:** 登录后无法获取 Solana 地址
**解决:**

```typescript
// 确保在 PrivyProvider 中配置 embeddedWallets
<PrivyProvider
  config={{
    embeddedWallets: {
      solana: { createOnLogin: 'users-without-wallets' }
    }
  }}
>
```

### 4.2 SDK 调用失败

**问题:** 调用 SDK 返回 401
**解决:**

- 检查 JWT token 是否正确传递
- 确认用户已完成身份验证
- 检查 SDK 初始化配置

### 4.3 状态更新不同步

**问题:** Zustand 状态更新后 UI 未刷新
**解决:**

```typescript
// 使用 selector 精确选择需要的字段
const profile = useProStore((s) => s.currentProfile);

// 避免使用整个 store
// ❌ const store = useProStore();
```

---

## 5. 代码审查清单

### 5.1 自测清单 (提交前)

- [ ] `npm run build` 成功
- [ ] `npm run typecheck` 无错误
- [ ] `npm run test:unit` 通过
- [ ] 手动测试核心流程

### 5.2 Review 检查项

- [ ] 符合 Technical Spec
- [ ] 有对应的单元测试
- [ ] 错误处理完善
- [ ] 无 console.log 残留
- [ ] 性能无明显问题

---

## 6. 偏差记录

| 日期 | 预期 | 实际 | 原因 | 解决方案 |
| ---- | ---- | ---- | ---- | -------- |
| -    | -    | -    | -    | -        |

---

**Status:** Draft  
**Created:** 2026-04-03  
**Owner:** Product Manager / Tech Lead
