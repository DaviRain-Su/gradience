# AutoLabHQ 整合方案

> **文档状态**: Draft  
> **创建日期**: 2026-04-02  
> **定位**: Chain Hub 外部 Skill 整合案例  
> **目标**: 将 AutoLabHQ 浏览器自动化能力接入 Gradience 生态

---

## 1. AutoLabHQ 简介

### 1.1 项目概述

**AutoLabHQ** (https://github.com/autolabhq/autolab) 是一个 **AI 驱动的浏览器自动化平台**，让 AI Agent 能够自主执行网页任务。

**核心能力**:
- **浏览器自动化**: AI Agent 自动操作浏览器完成网页任务
- **工作流自动化**: 管理和执行复杂的网页工作流
- **视觉识别**: 利用视觉理解网页内容
- **自然语言控制**: 通过自然语言指令控制 Agent

### 1.2 与 Gradience 的互补性

| AutoLabHQ 提供 | Gradience 提供 |
|---------------|---------------|
| 浏览器自动化能力 | 去中心化任务市场 |
| 工作流执行引擎 | 信誉系统和评判机制 |
| 网页操作技术 | 经济激励和结算 |

**整合价值**: 创建"去中心化的 AI 自动化服务市场"

---

## 2. 整合架构

### 2.1 整体架构

```
┌─────────────────────────────────────────┐
│           Agent.im (User Entry)          │
│  "帮我从 Amazon 抓取这 3 个产品的价格"     │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│         Chain Hub (Skill Router)        │
│  chainHub.invoke("autolab", "scrape",   │
│    {urls: [...], fields: ["price"]})    │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│      AutoLabHQ Adapter (REST API)       │
│  - API Key 管理 (Key Vault)             │
│  - 请求转换                             │
│  - 结果格式化                           │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│      AutoLabHQ (Browser Automation)     │
│  - 启动 headless browser                │
│  - 执行抓取/操作任务                     │
│  - 返回结构化数据                        │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│      Agent Arena (Settlement Layer)     │
│  - Agent 提交执行结果                    │
│  - Judge 验证数据准确性                  │
│  - 链上结算奖励                          │
└─────────────────────────────────────────┘
```

### 2.2 整合层次

```
┌─────────────────────────────────────────┐
│         Protocol Registry               │
│  ┌─────────────────────────────────┐   │
│  │  AutoLabHQ Protocol Entry       │   │
│  │  - id: "autolab"                │   │
│  │  - type: "rest-api"             │   │
│  │  - trust: "centralized-service" │   │
│  │  - endpoint: "https://api..."   │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────┐
│         Skill Registry                  │
│  ┌─────────────────────────────────┐   │
│  │  AutoLab Skills                 │   │
│  │  - web_scraping                 │   │
│  │  - form_filling                 │   │
│  │  - data_extraction              │   │
│  │  - workflow_automation          │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

---

## 3. 技术实现

### 3.1 Protocol Registry 注册

```typescript
// apps/chain-hub/src/protocols/autolab.ts

export const AUTOLAB_PROTOCOL = {
  id: "autolab",
  name: "AutoLabHQ",
  version: "1.0.0",
  type: "rest-api",
  trust: "centralized-service",
  
  // 服务端点
  endpoint: "https://api.autolabhq.com/v1",
  
  // 认证方式
  auth: {
    method: "api-key",
    keyVault: true,  // 由 Key Vault 自动注入
    headerName: "X-API-Key"
  },
  
  // 能力声明
  capabilities: [
    "browser_automation",
    "web_scraping", 
    "form_filling",
    "data_extraction",
    "workflow_automation"
  ],
  
  // 支持的链
  chains: ["solana", "ethereum"],
  
  // 费率
  pricing: {
    model: "per-request",
    currency: "USDC"
  },
  
  // 文档
  docs: "https://docs.autolabhq.com"
};
```

### 3.2 Skill 定义

```typescript
// apps/chain-hub/src/skills/autolab/index.ts

export const AUTOLAB_SKILLS = {
  // Skill 1: 网页抓取
  web_scraping: {
    id: "autolab:web_scraping",
    name: "Web Scraping",
    description: "Extract data from websites using AI-powered browser automation",
    
    input: {
      schema: {
        url: { type: "string", required: true },
        selectors: { 
          type: "object", 
          required: true,
          description: "CSS selectors or natural language descriptions"
        },
        options: {
          type: "object",
          properties: {
            headless: { type: "boolean", default: true },
            waitFor: { type: "string" },  // 等待条件
            timeout: { type: "number", default: 30000 }
          }
        }
      }
    },
    
    output: {
      schema: {
        data: { type: "object" },
        screenshot: { type: "string" },  // base64
        html: { type: "string" },
        metadata: {
          type: "object",
          properties: {
            executionTime: { type: "number" },
            pagesVisited: { type: "number" },
            errors: { type: "array" }
          }
        }
      }
    },
    
    pricing: {
      baseCost: "0.01 USDC",
      perPage: "0.005 USDC"
    }
  },
  
  // Skill 2: 表单填写
  form_filling: {
    id: "autolab:form_filling",
    name: "Form Filling",
    description: "Automatically fill forms on websites",
    
    input: {
      schema: {
        url: { type: "string", required: true },
        formData: { 
          type: "object", 
          required: true,
          description: "Form field values"
        },
        submit: { type: "boolean", default: false }
      }
    },
    
    output: {
      schema: {
        success: { type: "boolean" },
        confirmation: { type: "string" },
        screenshot: { type: "string" }
      }
    },
    
    pricing: {
      baseCost: "0.02 USDC"
    }
  },
  
  // Skill 3: 工作流自动化
  workflow_automation: {
    id: "autolab:workflow_automation",
    name: "Workflow Automation",
    description: "Execute complex multi-step web workflows",
    
    input: {
      schema: {
        workflow: {
          type: "array",
          required: true,
          items: {
            type: "object",
            properties: {
              action: { 
                type: "string", 
                enum: ["navigate", "click", "fill", "wait", "extract"]
              },
              params: { type: "object" }
            }
          }
        }
      }
    },
    
    output: {
      schema: {
        results: { type: "array" },
        executionLog: { type: "array" },
        duration: { type: "number" }
      }
    },
    
    pricing: {
      baseCost: "0.05 USDC",
      perStep: "0.01 USDC"
    }
  }
};
```

### 3.3 Adapter 实现

```typescript
// apps/chain-hub/src/adapters/autolab-adapter.ts

import { ProtocolAdapter } from "../types";
import { KeyVault } from "../key-vault";

export class AutoLabAdapter implements ProtocolAdapter {
  private apiKey: string;
  private baseUrl = "https://api.autolabhq.com/v1";
  
  constructor(private keyVault: KeyVault) {}
  
  async initialize(): Promise<void> {
    // 从 Key Vault 获取 API Key
    this.apiKey = await this.keyVault.get("autolab-api-key");
  }
  
  async invoke(skill: string, params: any): Promise<any> {
    const endpoint = this.getEndpoint(skill);
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      throw new Error(`AutoLabHQ API error: ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  private getEndpoint(skill: string): string {
    const endpoints: Record<string, string> = {
      "web_scraping": "/scrape",
      "form_filling": "/forms/fill",
      "workflow_automation": "/workflows/execute"
    };
    return endpoints[skill] || "/execute";
  }
  
  // 估算成本
  async estimateCost(skill: string, params: any): Promise<string> {
    const response = await fetch(`${this.baseUrl}/estimate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey
      },
      body: JSON.stringify({ skill, params })
    });
    
    const { cost } = await response.json();
    return cost;
  }
}
```

---

## 4. Agent Arena 集成

### 4.1 浏览器自动化任务类型

AutoLabHQ 的能力可以作为 Agent Arena 的任务类型：

| 任务类型 | 描述 | 评判方式 |
|---------|------|---------|
| **网页数据抓取** | 从指定网站抓取特定数据 | TestCasesEvaluator（验证数据准确性） |
| **表单自动化** | 自动填写并提交表单 | OracleEvaluator（验证提交结果） |
| **工作流执行** | 执行多步骤网页操作 | LLMScoreEvaluator（评估流程效率） |
| **跨网站任务** | 在多个网站间协调操作 | 白盒评测（trace 回放验证） |

### 4.2 任务发布示例

```typescript
// 在 Agent Arena 发布 AutoLab 任务
const task = await gradience.task.post({
  description: "从 Amazon 抓取 iPhone 15 的价格和评分",
  
  // 使用 AutoLab 执行
  execution: {
    type: "external-skill",
    skillId: "autolab:web_scraping",
    params: {
      url: "https://amazon.com/s?k=iPhone+15",
      selectors: {
        price: ".a-price-whole",
        rating: ".a-icon-alt",
        reviews: ".a-size-base"
      }
    }
  },
  
  // 评判标准
  evaluation: {
    type: "test_cases",
    testCases: [
      { field: "price", type: "exists" },
      { field: "rating", pattern: "^\d+\.\d+ out of 5 stars$" },
      { field: "reviews", type: "numeric" }
    ],
    minScore: 80
  },
  
  // 经济参数
  reward: {
    amount: "50",
    token: "USDC"
  },
  minStake: "5",
  deadline: Date.now() + 86400000  // 1天
});
```

### 4.3 评判流程

```
1. Agent 接受任务
   ↓
2. Agent 调用 Chain Hub
   chainHub.invoke("autolab", "web_scraping", {...})
   ↓
3. AutoLab 执行浏览器自动化
   - 启动 headless browser
   - 访问目标网站
   - 抓取数据
   - 返回结构化结果
   ↓
4. Agent 提交结果到 Agent Arena
   submitResult(taskId, resultCID)
   ↓
5. Judge 评判
   - 验证数据格式
   - 抽查数据准确性
   - 评分 (0-100)
   ↓
6. 链上结算
   - 95% → Agent
   - 3% → Judge
   - 2% → Protocol
```

---

## 5. 经济模型

### 5.1 收入分配

```
AutoLabHQ 任务收入:
┌─────────────────────────────────────────┐
│  任务奖励 (100%)                        │
│  ├─ 85% → 执行 Agent                    │
│  ├─ 10% → AutoLabHQ (服务费用)          │
│  └─ 5%  → Protocol Treasury             │
└─────────────────────────────────────────┘

Gradience 结算 (85% 中的分配):
┌─────────────────────────────────────────┐
│  Agent 收入 (100%)                      │
│  ├─ 95% → Agent 钱包                    │
│  ├─ 3%  → Judge                         │
│  └─ 2%  → Protocol                      │
└─────────────────────────────────────────┘
```

### 5.2 成本结构

| 成本项 | 说明 | 支付方 |
|--------|------|--------|
| AutoLab API | 浏览器自动化服务费用 | 任务奖励中扣除 |
| Gas Fee | Solana 链上交易费用 | Protocol Treasury |
| Judge Fee | 任务评判费用 | 任务奖励中分配 |

---

## 6. 安全与隐私

### 6.1 API Key 管理

- API Key 存储在 Chain Hub Key Vault
- Agent 调用时自动注入，无需暴露
- 支持 API Key 轮换

### 6.2 执行隔离

- 每个任务在独立的 browser context 中执行
- 支持代理 IP 轮换
- 执行日志可审计

### 6.3 数据隐私

- 抓取的数据仅用于任务执行
- 敏感数据加密存储
- 符合 GDPR/CCPA 要求

---

## 7. 实施路线图

| 阶段 | 时间 | 任务 | 产出 |
|------|------|------|------|
| **Phase 1** | W3 | Protocol Registry 注册 | `autolab` protocol entry |
| **Phase 2** | W3 | Adapter 实现 | `AutoLabAdapter` class |
| **Phase 3** | W3 | Skill 定义 | 3 个核心 Skill |
| **Phase 4** | W4 | Agent Arena 集成 | 浏览器自动化任务类型 |
| **Phase 5** | W4 | Demo 场景 | "Amazon 价格抓取" 完整流程 |

---

## 8. 参考资源

- **AutoLabHQ GitHub**: https://github.com/autolabhq/autolab
- **Chain Hub Skill Protocol**: `../skill-protocol.md`
- **Agent Arena 文档**: `../../../docs/02-architecture.md`

---

*AutoLabHQ 整合方案 v1.0 · 2026-04-02*  
*维护者: Gradience Chain Hub Team*
