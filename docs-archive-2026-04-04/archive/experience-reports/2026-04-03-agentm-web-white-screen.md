# Bug Report: AgentM Web 白屏问题

## 基本信息
- **产品**: AgentM Web (apps/agentm-web)
- **环境**: Production (agentm.gradiences.xyz)
- **严重程度**: High (功能完全不可用)
- **状态**: Open
- **Assignee**: Code Agent (待分配)

## 问题描述
部署到生产环境后，打开 `https://agentm.gradiences.xyz` 显示空白页面，控制台可能有错误。

## 复现步骤
1. 访问 https://agentm.gradiences.xyz
2. 页面加载后显示空白

## 预期行为
正常显示 AgentM Web 应用界面，或在没有配置 Privy 时显示 Demo 界面。

## 实际行为
空白页面，无任何内容渲染。

## 根因分析

### 初步诊断
查看代码 `src/App.tsx`:
```typescript
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID ?? '';

export function App() {
    if (!PRIVY_APP_ID) {
        return <DemoApp />;  // 没有 Privy ID 时显示 DemoApp
    }
    // ...
}
```

问题：
1. **环境变量未设置**: Vercel 上没有配置 `VITE_PRIVY_APP_ID`
2. **DemoApp 未实现**: 查看代码发现 `DemoApp` 组件可能未正确导出或为空

### 代码检查
```typescript
// App.tsx 第 16 行
return <DemoApp />;

// 需要确认 DemoApp 组件是否存在且有内容
```

## 解决方案 (建议)

### 方案 A: 配置环境变量 (推荐)
在 Vercel Dashboard 添加环境变量：
```
VITE_PRIVY_APP_ID = <从 Privy Dashboard 获取的 App ID>
```

### 方案 B: 修复 DemoApp
如果暂时不想接入真实 Privy，可以实现一个简单的 DemoApp：
```typescript
function DemoApp() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1>AgentM</h1>
        <p>Demo Mode - Privy not configured</p>
        <button onClick={() => alert('This is a demo')}>
          Try Demo
        </button>
      </div>
    </div>
  );
}
```

## 修复检查清单
- [ ] 在 Vercel 添加 `VITE_PRIVY_APP_ID` 环境变量
- [ ] 重新部署应用
- [ ] 验证页面正常显示
- [ ] 测试登录功能

## 相关文档
- AgentM Web 代码: `apps/agentm-web/src/App.tsx`
- Privy 文档: https://docs.privy.io/
- 部署记录: `docs/experience-reports/2026-04-03-website-deployment.md`

## 备注
这个问题可能是之前开发时只在本地配置了环境变量，但生产环境未配置导致的。需要在部署文档中明确列出必需的环境变量。

---
**Reporter:** Product Manager  
**Created:** 2026-04-03  
**Priority:** High
