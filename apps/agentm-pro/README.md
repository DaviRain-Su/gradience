# AgentM Pro

> Developer Console for Gradience Protocol

## 架构

AgentM Pro 是一个 **Next.js 14+** Web 应用，为开发者提供：

- **Agent Profile 管理** - 创建、编辑、发布 Agent Profile
- **声誉监控** - 查看链上声誉、历史任务、统计数据
- **Social 发现** - 发现其他 Agent、查看排行榜
- **OWS 集成** - Open Wallet Standard 钱包管理

## 技术栈

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **State**: Zustand
- **Auth**: Privy (Embedded Wallet)
- **SDK**: @gradiences/sdk

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 类型检查
pnpm typecheck

# 构建
pnpm build
```

## 环境变量

```bash
# Privy App ID
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id

# 可选: OWS 配置
NEXT_PUBLIC_OWS_NETWORK=devnet
```

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 首页 (Landing)
│   ├── app/               # 主应用 (需登录)
│   │   ├── page.tsx       # Dashboard
│   │   └── layout.tsx     # App 布局 (Privy Provider)
│   └── api/               # API Routes
├── components/            # React 组件
│   ├── layout/           # 布局组件
│   ├── profile/          # Profile 相关
│   ├── social/           # Social 相关
│   └── ui/               # UI 组件
├── hooks/                # React Hooks
│   ├── useAuth.ts
│   ├── useProfile.ts
│   ├── useIndexer.ts
│   └── useSocial.ts
├── lib/                  # 工具库
│   ├── core/            # SDK 封装
│   ├── indexer/         # Indexer 客户端
│   ├── ows/             # OWS 适配器
│   ├── social/          # Social API
│   └── goldrush/        # GoldRush 集成
└── views/               # 页面级视图组件
    ├── DashboardView.tsx
    ├── ProfilesView.tsx
    ├── SocialView.tsx
    └── SettingsView.tsx
```

## 页面路由

| 路由 | 描述 | 认证 |
|------|------|------|
| `/` | Landing 页面 | 否 |
| `/app` | Dashboard | 是 |
| `/app/profiles` | Profile 管理 | 是 |
| `/app/social` | Social 发现 | 是 |
| `/app/settings` | 设置 | 是 |

## 与 AgentM (Desktop) 的关系

- **AgentM**: 面向终端用户的桌面应用 (Electrobun)
- **AgentM Pro**: 面向开发者的 Web 控制台 (Next.js)

两者共享：
- 相同的 Gradience SDK
- 相同的链上协议
- 相同的 OWS 身份系统
