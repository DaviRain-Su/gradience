# AgentM 黑屏问题修复

> **问题**: 点击钱包创建后黑屏  
> **原因**: localStorage 数据损坏 + 缺少错误处理  
> **状态**: ✅ 已修复

---

## 修复内容

### 1. 存储安全加载 (store.ts)

添加了存储数据验证，自动清除损坏数据：

```typescript
load: () => {
    const raw = storage.getItem(DEFAULT_PERSIST_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        // 验证必要字段
        if (!parsed.auth || typeof parsed.auth !== 'object') {
            console.warn('[AgentM] Invalid storage data, resetting...');
            return null; // 返回 null 使用默认状态
        }
        return parsed;
    } catch (e) {
        console.error('[AgentM] Failed to parse storage:', e);
        storage.removeItem(DEFAULT_PERSIST_KEY); // 清除损坏数据
        return null;
    }
};
```

### 2. 错误边界组件 (ErrorBoundary.tsx)

添加 React 错误边界，捕获渲染错误：

```tsx
<ErrorBoundary>{privyAppId ? <PrivyApp /> : <DemoApp />}</ErrorBoundary>
```

当发生错误时显示：

- 错误信息
- "Reset and Reload" 按钮
- 自动清除 localStorage 并重载

### 3. OWS Adapter 方法补全

添加缺失的方法：

- `getIdentity()`
- `signTransaction()`
- `credentials` 字段

---

## 测试步骤

1. **访问应用**: http://localhost:5199
2. **点击登录**: "Sign in with Google"
3. **验证**: 应该正常进入主界面，不再黑屏

---

## 如果仍有问题

在浏览器控制台执行：

```javascript
// 手动清除存储
localStorage.removeItem('agent-im.store.v1');
location.reload();
```

---

**状态**: 修复完成，应用已重启！
