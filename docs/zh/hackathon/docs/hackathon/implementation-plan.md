# 黑客松实施计划 - Privy + OWS
> 立即开始执行

---

## 🚀 今日任务清单

### Phase 1: Privy 集成 (2小时)

**Task 1**: 注册 Privy 并获取 App ID
- [ ] 访问 https://dashboard.privy.io
- [ ] 创建 Application
- [ ] 获取 App ID
- [ ] 配置允许的域名 (localhost, vercel.app)

**Task 2**: 安装并配置 Privy SDK
```bash
npm install @privy-io/react-auth @privy-io/wagmi-connector
```

**Task 3**: 创建认证组件
- [ ] 创建 PrivyProvider wrapper
- [ ] 创建 LoginButton 组件
- [ ] 创建 UserProfile 组件

**Task 4**: 集成到 AgentM Pro
- [ ] 替换现有登录逻辑
- [ ] 测试 Google 登录
- [ ] 测试钱包连接

---

### Phase 2: OWS 协议实现 (4小时)

**Task 5**: 创建 OWS Core 接口
```typescript
- OWSProvider interface
- Wallet discovery
- Connection management
```

**Task 6**: 实现 Wallet Providers
- [ ] MetaMask Provider
- [ ] Phantom Provider
- [ ] OKX Wallet Provider
- [ ] Privy Embedded Wallet Provider

**Task 7**: 创建 OWS Adapter
- [ ] 统一接口封装
- [ ] 自动发现逻辑
- [ ] 连接状态管理

---

### Phase 3: 结合演示 (2小时)

**Task 8**: 创建演示页面
- [ ] 钱包发现展示
- [ ] 一键连接功能
- [ ] 签名演示
- [ ] Agent 集成演示

**Task 9**: 部署到 Vercel
- [ ] 构建测试
- [ ] 环境变量配置
- [ ] 在线演示

---

## 📁 项目结构

```
apps/hackathon-demo/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── PrivyLogin.tsx       # Privy 登录组件
│   │   │   └── WalletSelector.tsx   # 钱包选择器
│   │   ├── ows/
│   │   │   ├── OWSAdapter.ts        # OWS 核心适配器
│   │   │   ├── MetaMaskProvider.ts  # MetaMask 支持
│   │   │   ├── PhantomProvider.ts   # Phantom 支持
│   │   │   └── OKXProvider.ts       # OKX 支持
│   │   └── demo/
│   │       ├── WalletDiscovery.tsx  # 钱包发现演示
│   │       ├── ConnectionDemo.tsx   # 连接演示
│   │       └── AgentDemo.tsx        # Agent 集成演示
│   ├── hooks/
│   │   ├── usePrivyAuth.ts          # Privy 认证 Hook
│   │   └── useOWS.ts                # OWS Hook
│   ├── pages/
│   │   ├── index.tsx                # 主页面
│   │   └── demo.tsx                 # 演示页面
│   └── providers/
│       └── PrivyProvider.tsx        # Privy 配置
├── package.json
└── .env.local
```

---

## 🎯 成功标准

1. **Privy 集成** ✅
   - Google 登录可用
   - Email 登录可用
   - 钱包连接可用

2. **OWS 实现** ✅
   - 发现多个钱包
   - 统一连接接口
   - 支持签名操作

3. **演示完成** ✅
   - 在线可访问
   - 3分钟演示流程
   - 评委可交互

---

*Plan created: 2026-04-03*
