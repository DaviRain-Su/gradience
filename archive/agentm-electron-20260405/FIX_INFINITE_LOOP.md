# React 无限循环问题修复

> **问题**: Maximum update depth exceeded  
> **原因**: useEffect 依赖项包含 Zustand store 函数，导致无限循环  
> **状态**: ✅ 已修复

---

## 问题分析

React 错误：`Maximum update depth exceeded`

**根本原因**:

```tsx
// 错误代码
const setAuth = useAppStore((s) => s.setAuth);

useEffect(() => {
    setAuth({...});
}, [setAuth]); // ❌ setAuth 每次渲染都是新引用
```

每次组件重新渲染时，`useAppStore` 的 selector 函数返回新的函数引用，导致 `useEffect` 认为依赖项变化，从而无限循环。

---

## 修复方案

### 1. 移除 store 函数依赖

```tsx
// 修复前
useEffect(() => {
    setAuth({...});
}, [ready, authenticated, user, setAuth]); // ❌ 包含 setAuth

// 修复后
useEffect(() => {
    setAuth({...});
}, [ready, authenticated, user]); // ✅ 移除 setAuth
```

### 2. 使用 store 实例直接设置状态

```tsx
import { store as appStore } from './hooks/useAppStore.ts';

// 修复前
const setAuth = useAppStore((s) => s.setAuth);
setAuth(EMPTY_AUTH);

// 修复后
appStore.setState({ auth: EMPTY_AUTH });
```

---

## 修改的文件

| 文件      | 修改内容                            |
| --------- | ----------------------------------- |
| `App.tsx` | 修复 useEffect 依赖项               |
| `App.tsx` | 使用 appStore.setState 替代 setAuth |

---

## 测试步骤

1. **访问应用**: http://localhost:5199
2. **点击登录**: "Sign in with Google"
3. **验证**: 应该正常进入主界面，不再出现无限循环错误

---

## 如果仍有问题

在浏览器控制台执行：

```javascript
// 清除存储并刷新
localStorage.removeItem('agent-im.store.v1');
location.reload();
```

---

**状态**: 修复完成，应用已重启！
