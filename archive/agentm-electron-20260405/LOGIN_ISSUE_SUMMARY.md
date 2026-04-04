# AgentM 登录问题 - 待修复

> **问题**: React "Maximum update depth exceeded" 无限循环  
> **位置**: `apps/agentm/src/renderer/App.tsx`  
> **状态**: 待修复

---

## 问题描述

点击 "Sign in with Google" 后，React 报错：
```
Maximum update depth exceeded. This can happen when a component repeatedly 
calls setState inside componentWillUpdate or componentDidUpdate.
```

---

## 已尝试的修复

### 1. 移除 useEffect 依赖项
- 移除了 `setAuth`, `setIdentityRegistrationStatus` 等依赖
- 结果: 仍然报错

### 2. 简化 useEffect
- 合并多个 useEffect 为一个
- 添加条件判断避免重复更新
- 结果: 仍然报错

### 3. 使用 store.subscribe
- 参考 AgentM Pro 的模式
- 使用 `store.subscribe` 监听状态变化
- 结果: 仍然报错

---

## 参考实现

AgentM Pro 有正确的 Privy 集成：
- 文件: `apps/agentm-pro/src/hooks/useAuth.ts`
- 特点: 简单的 useMemo + usePrivy，没有复杂 useEffect

---

## 可能的原因

1. **Zustand store 的订阅机制** - `store.subscribe` 可能触发重复渲染
2. **useAppStore hook** - selector 函数可能导致闭包问题
3. **store.ts 中的持久化** - `store.subscribe` 保存到 localStorage 可能触发循环
4. **组件重新创建** - 每次渲染创建新的函数引用

---

## 建议的修复方向

### 方案 1: 完全禁用持久化
在 `store.ts` 中临时禁用 `persistence` 测试是否是持久化导致的问题。

### 方案 2: 使用 React Context
替换 Zustand，使用 React Context + useReducer 管理状态。

### 方案 3: 参考 AgentM Pro
完全重写 App.tsx，采用 AgentM Pro 的简化模式：
- 使用 `useAuth` hook
- 不使用 store.subscribe
- 简单的状态管理

### 方案 4: 调试工具
使用 React DevTools Profiler 找出具体哪个组件在无限循环。

---

## 当前环境

- AgentM 运行中: http://localhost:5199
- 合约已部署: ChainHub Program ID `6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec`
- Solana Devnet: 21.14 SOL
- 测试通过: 113 个单元测试

---

## 相关文件

```
apps/agentm/src/renderer/
├── App.tsx              # 问题文件
├── hooks/useAppStore.ts # store hook
├── lib/store.ts         # store 定义 + 持久化
└── components/ErrorBoundary.tsx  # 错误边界

apps/agentm-pro/src/hooks/useAuth.ts  # 参考实现
```

---

**建议**: 找有 React + Zustand 经验的开发者，重点检查 store 订阅和状态更新逻辑。
