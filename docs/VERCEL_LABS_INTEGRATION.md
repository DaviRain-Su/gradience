# Vercel Labs 库集成分析

> 分析 vercel-labs 组织的仓库，探索在 AgentM Web 项目中的应用可能性

## 📊 关键发现

### ⚠️ 关于 "render-json"

**没有找到名为 "render-json" 的仓库**，可能是以下情况之一：
1. 名称记错了，实际想找的是 **`json-render`** (13.9k ⭐)
2. 是其他组织的仓库
3. 已被删除或私有化

本文主要分析 **`json-render`** 和其他高价值的库。

---

## 🌟 推荐库详解

### 1. json-render (13.9k ⭐) - 强烈推荐

**描述**: The Generative UI framework  
**GitHub**: https://github.com/vercel-labs/json-render

#### 核心能力

```
自然语言提示 → AI 生成 JSON Spec → 渲染为 UI
```

**特点**:
- 🛡️ **Guardrailed**: AI 只能使用预定义组件（安全可控）
- 🔮 **Predictable**: JSON 输出始终匹配 schema
- ⚡ **Fast**: 流式渐进渲染
- 🌐 **跨平台**: React, Vue, Svelte, Solid, React Native
- 🎁 **开箱即用**: 36 个预建 shadcn/ui 组件

#### 安装

```bash
# React 基础
npm install @json-render/core @json-render/react

# 带 shadcn/ui 组件
npm install @json-render/shadcn

# Next.js 完整支持
npm install @json-render/core @json-render/react @json-render/next
```

#### 使用示例

```tsx
import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { defineRegistry, Renderer } from "@json-render/react";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";
import { shadcnComponents } from "@json-render/shadcn";

// 1. 定义组件库（声明 AI 可以使用的组件）
const catalog = defineCatalog(schema, {
  components: {
    Card: shadcnComponentDefinitions.Card,
    Button: shadcnComponentDefinitions.Button,
    Input: shadcnComponentDefinitions.Input,
    Select: shadcnComponentDefinitions.Select,
    Slider: shadcnComponentDefinitions.Slider,
    Table: shadcnComponentDefinitions.Table,
    Chart: shadcnComponentDefinitions.Chart,
  },
  actions: {
    submit: { description: "Submit form" },
    cancel: { description: "Cancel operation" },
  },
});

// 2. 创建 Registry（绑定实际组件实现）
const { registry } = defineRegistry(catalog, {
  components: {
    Card: shadcnComponents.Card,
    Button: shadcnComponents.Button,
    Input: shadcnComponents.Input,
    Select: shadcnComponents.Select,
    Slider: shadcnComponents.Slider,
    Table: shadcnComponents.Table,
    Chart: shadcnComponents.Chart,
  },
});

// 3. AI 生成的 Spec
const spec = {
  root: "dashboard",
  elements: {
    dashboard: {
      type: "Card",
      props: { title: "Wallet Overview" },
      children: ["balance", "chart", "actions"],
    },
    balance: {
      type: "Card",
      props: { title: "Balance", variant: "metric" },
      children: [],
    },
    chart: {
      type: "Chart",
      props: { type: "line", data: "${wallet.history}" },
      children: [],
    },
    actions: {
      type: "Button",
      props: { label: "Send", action: "openTransfer" },
      children: [],
    },
  },
};

// 4. 渲染
function DynamicUI() {
  return <Renderer spec={spec} registry={registry} />;
}
```

---

### 2. agent-browser (26.7k ⭐)

**描述**: Browser automation CLI for AI agents

**用途**:
- 让 AI agent 自动化操作浏览器
- 适合自动化测试和网页数据抓取

**AgentM 应用场景**:
```bash
# E2E 测试
agent-browser test "Create a new Agent and verify it appears in the list"

# 自动化演示
agent-browser run "Setup a trading workflow from scratch"
```

---

### 3. gemini-chatbot (1.3k ⭐)

**描述**: Build generative UI chatbot with AI SDK + Google Gemini

**与 json-render 结合**:
- 聊天界面 + 富媒体内容生成
- 用户可以用自然语言获取动态 UI 响应

---

## 💡 AgentM Web 集成方案

### 方案 1: 动态配置界面（推荐）

**场景**: Agent/任务配置

**当前**: 静态表单，所有字段都显示

**改进**: AI 根据用户描述生成针对性的配置界面

```tsx
// 用户输入: "我想创建一个监控 ETH 价格的 Agent，
//           当价格低于 2000 时通知我"

// AI 生成 Spec:
{
  "root": "price-monitor-config",
  "elements": {
    "price-monitor-config": {
      "type": "Card",
      "props": { "title": "Price Monitor Configuration" },
      "children": ["token", "condition", "threshold", "notification"]
    },
    "token": {
      "type": "Select",
      "props": { 
        "label": "Token",
        "value": "ETH",
        "options": ["ETH", "BTC", "SOL"]
      }
    },
    "condition": {
      "type": "Select",
      "props": {
        "label": "Condition",
        "value": "below",
        "options": ["above", "below", "equals"]
      }
    },
    "threshold": {
      "type": "Input",
      "props": {
        "label": "Price Threshold ($)",
        "type": "number",
        "value": 2000
      }
    },
    "notification": {
      "type": "Select",
      "props": {
        "label": "Notify via",
        "value": "push",
        "options": ["push", "email", "sms"]
      }
    }
  }
}
```

**优势**:
- ✅ 简化用户操作
- ✅ 减少配置错误
- ✅ 支持复杂条件
- ✅ 渐进式配置

---

### 方案 2: 智能仪表盘

**场景**: 数据展示

**当前**: 固定图表布局

**改进**: 用户问什么，AI 就生成什么

```tsx
// 用户: "显示我过去 7 天的交易量和收益"

// AI 自动生成:
{
  "root": "analytics-dashboard",
  "elements": {
    "analytics-dashboard": {
      "type": "Grid",
      "props": { "cols": 2 },
      "children": ["volume-chart", "pnl-chart", "metrics"]
    },
    "volume-chart": {
      "type": "Chart",
      "props": {
        "title": "Trading Volume (7d)",
        "type": "bar",
        "data": "${analytics.volume}",
        "timeRange": "7d"
      }
    },
    "pnl-chart": {
      "type": "Chart",
      "props": {
        "title": "P&L (7d)",
        "type": "line",
        "data": "${analytics.pnl}",
        "timeRange": "7d"
      }
    },
    "metrics": {
      "type": "Card",
      "props": { "variant": "stats" },
      "children": ["total-volume", "total-pnl", "win-rate"]
    }
  }
}
```

---

### 方案 3: AI Playground

**场景**: 实验性功能，让用户用自然语言创建界面

```tsx
function AIPlayground() {
  const [userPrompt, setUserPrompt] = useState("");
  const [spec, setSpec] = useState(null);

  const generateUI = async () => {
    // 调用 AI API 生成 Spec
    const response = await fetch('/api/generate-ui', {
      method: 'POST',
      body: JSON.stringify({ prompt: userPrompt })
    });
    const generatedSpec = await response.json();
    setSpec(generatedSpec);
  };

  return (
    <div>
      <textarea
        value={userPrompt}
        onChange={(e) => setUserPrompt(e.target.value)}
        placeholder="Describe the UI you want..."
      />
      <button onClick={generateUI}>Generate UI</button>
      
      {spec && <Renderer spec={spec} registry={registry} />}
    </div>
  );
}
```

---

## ⚠️ 注意事项

### json-render 的限制

1. **组件限制**
   - 只能使用预定义的组件
   - 不能随意使用自定义 HTML/CSS
   - 需要提前定义所有可能用到的组件

2. **AI 成本**
   - 每次生成 UI 都需要调用 AI API
   - 需要考虑缓存策略

3. **学习曲线**
   - 需要理解 Catalog/Registry/Spec 三层架构
   - 调试 JSON spec 需要时间

4. **版本兼容**
   - 与 shadcn/ui 版本绑定
   - 升级可能需要同步更新

---

## 📋 建议的实施路径

```
Phase 1: 调研与原型 (1-2 周)
- 搭建 json-render 开发环境
- 创建 AgentM 组件库 Catalog
- 开发一个演示功能

Phase 2: 试点功能 (2-3 周)
- 选择一个低风险功能集成
- 如：Agent 配置界面的 "智能模式"
- 收集用户反馈

Phase 3: 扩展应用 (1-2 月)
- 根据反馈优化
- 逐步扩展到更多功能
- 考虑与现有 AI 功能整合
```

---

## 🔗 相关资源

- **json-render GitHub**: https://github.com/vercel-labs/json-render
- **Documentation**: https://json-render.com
- **Playground**: 本地运行 `pnpm dev` 在 `json-render` 仓库
- **其他优秀库**:
  - agent-browser: https://github.com/vercel-labs/agent-browser
  - agent-skills: https://github.com/vercel-labs/agent-skills
  - gemini-chatbot: https://github.com/vercel-labs/gemini-chatbot

---

## 💬 下一步建议

1. **先跑通 Demo**
   ```bash
   git clone https://github.com/vercel-labs/json-render
   cd json-render
   pnpm install
   pnpm dev
   ```

2. **评估与 AgentM 的契合度**
   - 哪些功能最适合用动态 UI？
   - 现有组件能否覆盖需求？

3. **小范围试点**
   - 选择一个简单功能做 PoC
   - 验证用户体验和性能

4. **决策是否全面采用**
