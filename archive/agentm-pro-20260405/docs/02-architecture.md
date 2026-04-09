# AgentM Pro - Architecture (Phase 2)

## 1. 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        AgentM Pro (Web)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Auth    │  │ Dashboard│  │ Profile  │  │  Stats   │        │
│  │ (Privy)  │  │  View    │  │ Editor   │  │  View    │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
├───────┼────────────┼────────────┼────────────┼────────────────┤
│       │            │            │            │                 │
│  ┌────▼────────────▼────────────▼────────────▼────┐            │
│  │              React State (Zustand)              │            │
│  └────┬─────────────────────────────────────┬─────┘            │
├───────┼─────────────────────────────────────┼──────────────────┤
│  ┌────▼─────┐  ┌──────────┐  ┌──────────┐  │                   │
│  │ useAuth  │  │useProfile│  │useIndexer│  │                   │
│  │  Hook    │  │  Hook    │  │  Hook    │  │                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │                   │
├───────┼────────────┼────────────┼────────┼────────────────────┤
│  ┌────▼────────────▼────────────▼────────▼───┐                │
│  │           Gradience SDK (@gradiences/sdk)   │                │
│  └────┬──────────────────────────────────────┘                │
└───────┼────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Gradience Network                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Agent Layer  │  │ChainHub Rep  │  │ Magic Block  │          │
│  │  (Indexer)   │  │   System     │  │  Settlement  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 组件结构

```
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx         # 导航侧边栏
│   │   ├── Header.tsx          # 顶部栏 (用户头像/钱包)
│   │   └── Layout.tsx          # 整体布局
│   ├── auth/
│   │   └── LoginButton.tsx     # 登录按钮
│   ├── profile/
│   │   ├── ProfileForm.tsx     # Profile 编辑表单
│   │   ├── ProfileCard.tsx     # Profile 预览卡片
│   │   └── VersionList.tsx     # 版本列表
│   └── stats/
│       ├── ReputationScore.tsx # 声誉评分组件
│       └── RevenueChart.tsx    # 收入图表
├── views/
│   ├── DashboardView.tsx       # 仪表盘主页
│   ├── ProfileCreateView.tsx   # 创建 Profile
│   ├── ProfileEditView.tsx     # 编辑 Profile
│   └── StatsView.tsx           # 统计数据
├── hooks/
│   ├── useAuth.ts              # 身份验证
│   ├── useProfile.ts           # Profile CRUD
│   └── useStats.ts             # 统计数据
├── lib/
│   ├── sdk-client.ts           # SDK 初始化
│   └── constants.ts            # 常量配置
└── types/
    └── index.ts                # TypeScript 类型
```

## 3. 数据流

### 3.1 Profile 创建流程

```
User Input → ProfileForm → useProfile.create() → SDK → Agent Layer
                ↓
         Local State Update → UI Refresh
```

### 3.2 声誉查询流程

```
Dashboard Mount → useStats.fetch() → SDK → ChainHub
                         ↓
                  ReputationScore Component
```

## 4. 状态管理

### 4.1 Zustand Store

```typescript
interface ProStore {
    // Auth
    auth: AuthState;
    setAuth: (auth: AuthState) => void;

    // Profile
    profiles: AgentProfile[];
    currentProfile: AgentProfile | null;
    setProfiles: (profiles: AgentProfile[]) => void;
    setCurrentProfile: (profile: AgentProfile | null) => void;

    // UI
    activeView: 'dashboard' | 'profiles' | 'stats' | 'settings';
    setActiveView: (view: string) => void;
}
```

## 5. 外部依赖

| 依赖                 | 用途                | 版本         |
| -------------------- | ------------------- | ------------ |
| @gradiences/sdk      | 与 Agent Layer 通信 | workspace:\* |
| @privy-io/react-auth | 身份验证            | ^3.18.0      |
| zustand              | 状态管理            | ^5.0.5       |
| react-router-dom     | 路由                | ^6.x         |

## 6. 部署架构

- **托管**: Vercel
- **域名**: pro.gradiences.xyz
- **CI/CD**: Vercel Auto Deploy (Git integration)

---

**Status:** Draft  
**Created:** 2026-04-03  
**Owner:** Product Manager
