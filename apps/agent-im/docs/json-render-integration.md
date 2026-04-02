# json-render 集成方案

> **文档状态**: Draft  
> **创建日期**: 2026-04-02  
> **定位**: Agent.im Generative UI 层  
> **优先级**: P1 (W2 集成)

---

## 1. 概述

### 1.1 什么是 json-render

**json-render** 是 Vercel Labs 推出的 Generative UI Framework，让 AI 能够安全地生成动态用户界面。

```
AI Prompt → JSON Schema → React Components
```

### 1.2 与 Agent.im 的关系

```
┌─────────────────────────────────────────┐
│           Agent.im (Electron)            │
│  ┌─────────────────────────────────┐   │
│  │  UI Layer                       │   │
│  │  ┌─────────┐ ┌───────────────┐ │   │
│  │  │ Chat    │ │ json-render   │ │   │
│  │  │ (Text)  │ │ (Dynamic UI)  │ │   │
│  │  └─────────┘ └───────────────┘ │   │
│  └─────────────────────────────────┘   │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      Agent Core (TypeScript)            │
│  ┌─────────────────────────────────┐   │
│  │  • Intent Recognition           │   │
│  │  • Chain Hub Router             │   │
│  │  • UI Generator (json-render)   │   │
│  └─────────────────────────────────┘   │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      Chain Hub (Skill Market)           │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ │
│  │ DeFi    │ │ AutoLab │ │ Custom   │ │
│  │ Skills  │ │ HQ      │ │ Skills   │ │
│  └─────────┘ └─────────┘ └──────────┘ │
└─────────────────────────────────────────┘
```

### 1.3 核心价值

| 能力 | 说明 | 示例 |
|------|------|------|
| **动态仪表盘** | Agent 生成数据可视化 | DeFi 投资组合分析 |
| **交互式表单** | 用户通过 UI 与 Agent 协作 | 任务参数配置 |
| **富媒体展示** | 图表、卡片、时间轴 | NFT 展示、交易历史 |
| **安全沙箱** | 预定义组件，防止 XSS | 无需担心 Agent 注入 |

---

## 2. 架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────┐
│  Layer 3: Agent.im UI (Renderer)        │
│  ┌─────────────────────────────────┐   │
│  │  <JsonRender />                 │   │
│  │  • 组件渲染                      │   │
│  │  • 事件处理                      │   │
│  │  • 状态管理                      │   │
│  └─────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  Layer 2: UI Generator (Agent Core)     │
│  ┌─────────────────────────────────┐   │
│  │  UIGenerator                    │   │
│  │  • Intent → UI JSON             │   │
│  │  • Component Selection          │   │
│  │  • Data Binding                 │   │
│  └─────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  Layer 1: Component Catalog (Shared)    │
│  ┌─────────────────────────────────┐   │
│  │  AgentComponentCatalog          │   │
│  │  • Predefined Components        │   │
│  │  • Schema Definitions           │   │
│  │  • Action Handlers              │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 2.2 数据流

```
User Input
    ↓
Agent Core (Intent Recognition)
    ↓
Chain Hub (Skill Execution)
    ↓
Skill Response (Data + UI Hints)
    ↓
UI Generator (json-render)
    ↓
JSON Schema
    ↓
Renderer (React Components)
    ↓
User Interaction → Action → Agent Core
```

---

## 3. 技术实现

### 3.1 安装依赖

```bash
# Agent.im renderer - 核心包
npm install @json-renderer/render-json

# React 渲染器
npm install @json-render/react

# 类型定义
npm install -D @json-render/core

# 可选：PDF 渲染器
npm install @json-render/react-pdf
```

### 3.2 组件目录结构

```
apps/agent-im/src/renderer/components/ui/
├── json-render/
│   ├── index.tsx              # 主入口
│   ├── catalog.ts             # 组件库定义
│   ├── schemas/               # JSON Schema 定义
│   │   ├── data.ts           # 数据展示组件
│   │   ├── chart.ts          # 图表组件
│   │   ├── action.ts         # 交互组件
│   │   └── layout.ts         # 布局组件
│   ├── components/            # 实际 React 组件
│   │   ├── DataTable.tsx
│   │   ├── RiskBadge.tsx
│   │   ├── ActionButton.tsx
│   │   └── Chart.tsx
│   └── handlers/              # 事件处理器
│       ├── chainHub.ts       # Chain Hub 调用
│       ├── wallet.ts         # 钱包操作
│       └── navigation.ts     # 页面导航
```

### 3.3 核心实现

#### 3.3.1 组件库定义

```typescript
// apps/agent-im/src/renderer/components/ui/json-render/catalog.ts

import { defineCatalog } from '@json-renderer/render-json';
import { DataTable } from './components/DataTable';
import { RiskBadge } from './components/RiskBadge';
import { ActionButton } from './components/ActionButton';
import { Chart } from './components/Chart';
import { handleChainHubAction } from './handlers/chainHub';
import { handleWalletAction } from './handlers/wallet';

export const AGENT_UI_CATALOG = defineCatalog({
  // 数据展示组件
  DataTable: {
    component: DataTable,
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        columns: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              label: { type: 'string' },
              type: { 
                type: 'string', 
                enum: ['text', 'number', 'currency', 'percentage', 'badge'] 
              }
            },
            required: ['key', 'label']
          }
        },
        data: { type: 'array', items: { type: 'object' } },
        onRowClick: { type: 'action' }
      },
      required: ['columns', 'data']
    }
  },

  // 风险徽章
  RiskBadge: {
    component: RiskBadge,
    schema: {
      type: 'object',
      properties: {
        level: { 
          type: 'string', 
          enum: ['low', 'medium', 'high', 'critical'] 
        },
        score: { type: 'number', minimum: 0, maximum: 100 },
        label: { type: 'string' }
      },
      required: ['level', 'score']
    }
  },

  // 操作按钮
  ActionButton: {
    component: ActionButton,
    schema: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        variant: { 
          type: 'string', 
          enum: ['primary', 'secondary', 'danger', 'ghost'] 
        },
        action: {
          type: 'object',
          properties: {
            type: { 
              type: 'string', 
              enum: ['chainHub', 'wallet', 'navigate', 'copy'] 
            },
            params: { type: 'object' }
          },
          required: ['type', 'params']
        }
      },
      required: ['label', 'action']
    },
    handlers: {
      chainHub: handleChainHubAction,
      wallet: handleWalletAction
    }
  },

  // 图表组件
  Chart: {
    component: Chart,
    schema: {
      type: 'object',
      properties: {
        type: { 
          type: 'string', 
          enum: ['line', 'bar', 'pie', 'area'] 
        },
        title: { type: 'string' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              value: { type: 'number' },
              color: { type: 'string' }
            }
          }
        },
        xAxis: { type: 'string' },
        yAxis: { type: 'string' }
      },
      required: ['type', 'data']
    }
  },

  // 布局组件
  Card: {
    component: Card,
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        children: { type: 'array' },
        footer: { type: 'object' }
      }
    }
  },

  Grid: {
    component: Grid,
    schema: {
      type: 'object',
      properties: {
        columns: { type: 'number', minimum: 1, maximum: 4 },
        gap: { type: 'number' },
        children: { type: 'array' }
      },
      required: ['children']
    }
  }
});
```

#### 3.3.2 渲染器组件

```typescript
// apps/agent-im/src/renderer/components/ui/json-render/index.tsx

import React, { useCallback } from 'react';
import { JsonRender as VercelJsonRender } from '@vercel-labs/json-render';
import { AGENT_UI_CATALOG } from './catalog';
import { useChainHub } from '@/renderer/hooks/useChainHub';
import { useWallet } from '@/renderer/hooks/useWallet';

interface AgentUIProps {
  json: any;  // UI JSON from Agent
  context?: {
    taskId?: string;
    agentId?: string;
    walletAddress?: string;
  };
}

export const AgentUI: React.FC<AgentUIProps> = ({ json, context }) => {
  const chainHub = useChainHub();
  const wallet = useWallet();

  // 动作处理器
  const handleAction = useCallback(async (action: any) => {
    switch (action.type) {
      case 'chainHub':
        return chainHub.invoke(action.params.skillId, action.params.params);
      
      case 'wallet':
        return wallet.execute(action.params.method, action.params.args);
      
      case 'navigate':
        // 导航到 Agent.im 其他页面
        window.electron.navigate(action.params.route);
        return;
      
      case 'copy':
        await navigator.clipboard.writeText(action.params.text);
        return { success: true };
      
      default:
        console.warn('Unknown action type:', action.type);
    }
  }, [chainHub, wallet]);

  if (!json) return null;

  return (
    <div className="agent-ui-container">
      <VercelJsonRender
        catalog={AGENT_UI_CATALOG}
        json={json}
        onAction={handleAction}
        context={context}
      />
    </div>
  );
};
```

#### 3.3.3 UI Generator (Agent Core)

```typescript
// apps/agent-im/src/main/agent/ui-generator.ts

import { z } from 'zod';

// UI JSON Schema
const UIJsonSchema = z.object({
  type: z.string(),
  props: z.record(z.any()).optional(),
  children: z.array(z.any()).optional()
});

export class UIGenerator {
  private catalog: string[];

  constructor() {
    // 获取所有可用组件
    this.catalog = Object.keys(AGENT_UI_CATALOG);
  }

  /**
   * 根据 Skill 响应生成 UI JSON
   */
  async generate(skillResponse: SkillResponse, userIntent: string): Promise<any> {
    // 1. 分析数据类型
    const dataType = this.analyzeDataType(skillResponse.data);
    
    // 2. 选择合适的组件
    const component = this.selectComponent(dataType, userIntent);
    
    // 3. 生成 UI JSON
    const uiJson = this.buildUIJson(component, skillResponse);
    
    // 4. 验证
    return this.validate(uiJson);
  }

  private analyzeDataType(data: any): DataType {
    if (Array.isArray(data)) return 'list';
    if (data.riskScore !== undefined) return 'risk';
    if (data.chartData) return 'chart';
    if (data.action) return 'action';
    return 'object';
  }

  private selectComponent(dataType: DataType, intent: string): string {
    const mapping: Record<string, string> = {
      'list': 'DataTable',
      'risk': 'RiskDashboard',
      'chart': 'Chart',
      'action': 'ActionPanel',
      'object': 'PropertyList'
    };
    return mapping[dataType] || 'Card';
  }

  private buildUIJson(component: string, response: SkillResponse): any {
    switch (component) {
      case 'DataTable':
        return {
          type: 'Card',
          props: { title: response.title },
          children: [{
            type: 'DataTable',
            props: {
              columns: this.inferColumns(response.data),
              data: response.data,
              onRowClick: {
                type: 'action',
                action: {
                  type: 'navigate',
                  params: { route: '/detail/${row.id}' }
                }
              }
            }
          }]
        };

      case 'RiskDashboard':
        return {
          type: 'Grid',
          props: { columns: 2 },
          children: [
            {
              type: 'Card',
              props: { title: 'Risk Score' },
              children: [{
                type: 'RiskBadge',
                props: {
                  level: this.scoreToLevel(response.data.riskScore),
                  score: response.data.riskScore
                }
              }]
            },
            {
              type: 'Card',
              props: { title: 'Actions' },
              children: response.data.actions.map((action: any) => ({
                type: 'ActionButton',
                props: {
                  label: action.label,
                  variant: action.variant,
                  action: {
                    type: 'chainHub',
                    params: action.params
                  }
                }
              }))
            }
          ]
        };

      default:
        return { type: 'Card', props: { children: response.data } };
    }
  }

  private validate(uiJson: any): any {
    // 使用 zod 验证
    return UIJsonSchema.parse(uiJson);
  }
}
```

---

## 4. 与 Chain Hub 的集成

### 4.1 Skill UI 声明

```typescript
// apps/chain-hub/src/skills/defi/portfolio.ts

export const DeFiPortfolioSkill = {
  id: 'defi:portfolio',
  name: 'DeFi Portfolio Analysis',
  
  // 声明该 Skill 需要的 UI 组件
  uiComponents: ['DataTable', 'RiskBadge', 'Chart', 'ActionButton'],
  
  // Skill 执行
  execute: async (params: { walletAddress: string }) => {
    const portfolio = await fetchPortfolio(params.walletAddress);
    
    return {
      // 数据
      data: portfolio,
      
      // UI 提示
      ui: {
        preferredComponent: 'RiskDashboard',
        title: 'Your DeFi Portfolio',
        actions: [
          { label: 'Rebalance', skillId: 'defi:rebalance' },
          { label: 'Withdraw', skillId: 'defi:withdraw' }
        ]
      }
    };
  }
};
```

### 4.2 UI 组件注册

```typescript
// apps/chain-hub/src/ui/registry.ts

import { AGENT_UI_CATALOG } from '@gradience/agent-ui';

export const ChainHubUIRegistry = {
  // 注册 Skill 的 UI 组件需求
  registerSkillComponents(skillId: string, components: string[]) {
    for (const component of components) {
      if (!AGENT_UI_CATALOG[component]) {
        throw new Error(`Unknown UI component: ${component}`);
      }
    }
    // 记录 Skill 的 UI 依赖
    this.skillComponents[skillId] = components;
  },

  // 获取 Skill 的 UI 能力
  getSkillUICapabilities(skillId: string): string[] {
    return this.skillComponents[skillId] || [];
  }
};
```

---

## 5. 使用示例

### 5.1 简单数据展示

```typescript
// Agent 响应
const agentResponse = {
  type: 'text',
  content: 'Here is your portfolio:'
};

const uiJson = {
  type: 'DataTable',
  props: {
    title: 'Token Holdings',
    columns: [
      { key: 'token', label: 'Token', type: 'text' },
      { key: 'balance', label: 'Balance', type: 'number' },
      { key: 'value', label: 'Value (USD)', type: 'currency' },
      { key: 'change', label: '24h Change', type: 'percentage' }
    ],
    data: [
      { token: 'SOL', balance: 100, value: 12000, change: 5.2 },
      { token: 'USDC', balance: 5000, value: 5000, change: 0 }
    ]
  }
};
```

### 5.2 复杂仪表盘

```typescript
const dashboardJson = {
  type: 'Grid',
  props: { columns: 2, gap: 16 },
  children: [
    {
      type: 'Card',
      props: { title: 'Portfolio Value' },
      children: [{
        type: 'Chart',
        props: {
          type: 'area',
          data: [
            { label: 'Mon', value: 10000 },
            { label: 'Tue', value: 11500 },
            { label: 'Wed', value: 11200 }
          ]
        }
      }]
    },
    {
      type: 'Card',
      props: { title: 'Risk Analysis' },
      children: [{
        type: 'RiskBadge',
        props: { level: 'medium', score: 65, label: 'Moderate Risk' }
      }]
    },
    {
      type: 'Card',
      props: { title: 'Quick Actions' },
      children: [
        {
          type: 'ActionButton',
          props: {
            label: 'Stake SOL',
            variant: 'primary',
            action: {
              type: 'chainHub',
              params: { skillId: 'defi:stake', token: 'SOL' }
            }
          }
        },
        {
          type: 'ActionButton',
          props: {
            label: 'Swap',
            variant: 'secondary',
            action: {
              type: 'navigate',
              params: { route: '/swap' }
            }
          }
        }
      ]
    }
  ]
};
```

---

## 6. 安全考虑

### 6.1 组件白名单

```typescript
// 严格限制 Agent 可使用的组件
const ALLOWED_COMPONENTS = [
  'DataTable', 'Card', 'Grid',
  'RiskBadge', 'Chart',
  'ActionButton', 'Text', 'Link'
];

// 禁止的组件
const BLOCKED_COMPONENTS = [
  'Script', 'Iframe', 'Object',
  'Embed', 'Form'  // 防止表单劫持
];
```

### 6.2 动作验证

```typescript
// 所有动作必须经过验证
const validateAction = (action: any) => {
  // 1. 验证动作类型
  if (!['chainHub', 'wallet', 'navigate', 'copy'].includes(action.type)) {
    throw new Error('Invalid action type');
  }

  // 2. 验证 Chain Hub Skill
  if (action.type === 'chainHub') {
    const isValidSkill = chainHubRegistry.has(action.params.skillId);
    if (!isValidSkill) throw new Error('Invalid skill');
  }

  // 3. 验证钱包操作
  if (action.type === 'wallet') {
    const requiresConfirm = WALLET_ACTIONS_REQUIRING_CONFIRM
      .includes(action.params.method);
    if (requiresConfirm) {
      return { requiresUserConfirm: true };
    }
  }

  return { valid: true };
};
```

---

## 7. 实施路线图

| 阶段 | 时间 | 任务 | 产出 |
|------|------|------|------|
| **Phase 1** | W2 | 基础集成 | `AgentUI` 组件 |
| **Phase 2** | W2 | 核心组件 | DataTable, RiskBadge, ActionButton |
| **Phase 3** | W3 | Chain Hub 集成 | Skill UI 声明规范 |
| **Phase 4** | W3 | 高级组件 | Chart, Grid, Card |
| **Phase 5** | W4 | 自定义生态 | 社区组件注册 |

---

## 8. 参考资源

- **json-render GitHub**: https://github.com/vercel-labs/json-render
- **官方文档**: https://json-render.dev/
- **NPM 包**: 
  - `@json-renderer/render-json` - 核心框架
  - `@json-render/react` - React 渲染器
  - `@json-render/react-pdf` - PDF 渲染器
- **Agent.im 架构**: `../02-architecture.md`
- **Chain Hub Skill 协议**: `../../../apps/chain-hub/skill-protocol.md`

---

*json-render 集成方案 v1.0 · 2026-04-02*  
*维护者: Gradience Agent.im Team*
