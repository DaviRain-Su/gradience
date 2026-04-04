# json-render 集成方案

> 将 Vercel Labs 的 json-render 框架集成到 AgentM Web 项目中

---

## 📋 项目概述

**目标**: 在 AgentM Web 中集成 json-render，实现 AI 驱动的动态 UI 生成能力

**范围**: 
- Phase 1: Agent 配置界面的智能模式
- Phase 2: 数据仪表盘动态生成
- Phase 3: AI Playground 实验功能

**技术栈**:
- Next.js 15 + React 19
- TypeScript
- shadcn/ui
- json-render (@json-render/react, @json-render/shadcn)

---

## 🎯 7-Phase 开发计划

### Phase 1: PRD (需求文档) ✅

**目标**: 明确集成范围和功能需求

**已完成**:
- ✅ 技术调研 (`docs/VERCEL_LABS_INTEGRATION.md`)
- ✅ 可行性分析
- ✅ 功能优先级排序

**需求清单**:
| 优先级 | 功能 | 描述 |
|--------|------|------|
| P0 | Agent 智能配置 | 用自然语言描述 Agent 需求，AI 生成配置界面 |
| P1 | 动态仪表盘 | 用户查询数据时，AI 自动选择最佳图表类型 |
| P2 | AI Playground | 实验性功能，让用户自由创建界面 |

---

### Phase 2: Architecture (架构设计)

**目标**: 设计系统架构和组件集成方案

**2.1 架构图**:

```
┌─────────────────────────────────────────────────────────────┐
│                      AgentM Web App                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   User UI    │◄──►│  AI Service  │◄──►│  LLM API    │  │
│  │  (Prompt)    │    │  (Orchestrate)│    │ (Generate)   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                              │
│         ▼                   ▼                              │
│  ┌────────────────────────────────────┐                   │
│  │         json-render Layer          │                   │
│  │  ┌──────────┐    ┌──────────┐     │                   │
│  │  │ Catalog  │───►│ Registry │     │                   │
│  │  │(Schema)  │    │(Components)     │                   │
│  │  └──────────┘    └─────┬────┘     │                   │
│  │                        │          │                   │
│  │  ┌─────────────────────▼────┐     │                   │
│  │  │       Renderer           │     │                   │
│  │  │  (Spec → React Tree)     │     │                   │
│  │  └──────────────────────────┘     │                   │
│  └────────────────────────────────────┘                   │
│                        │                                   │
│                        ▼                                   │
│  ┌────────────────────────────────────┐                   │
│  │     AgentM Component Library       │                   │
│  │  (shadcn/ui + Custom Components)   │                   │
│  └────────────────────────────────────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**2.2 模块划分**:

```
app/
├── ai-playground/              # Phase 3
│   ├── page.tsx
│   └── components/
├── agents/
│   ├── create/
│   │   ├── page.tsx
│   │   └── components/
│   │       ├── TraditionalForm.tsx
│   │       └── SmartConfig.tsx    # Phase 1
├── dashboard/
│   ├── page.tsx
│   └── components/
│       └── DynamicDashboard.tsx   # Phase 2

components/
├── json-render/
│   ├── catalog.ts              # 组件库定义
│   ├── registry.tsx            # 注册表配置
│   ├── types.ts                # 类型定义
│   └── utils.ts                # 工具函数
├── ui/                         # shadcn/ui 组件
└── agentm/                     # AgentM 自定义组件

lib/
├── ai/
│   ├── prompts.ts              # AI 提示词
│   ├── spec-generator.ts       # Spec 生成器
│   └── streaming.ts            # 流式处理
└── json-render/
    ├── adapter.ts              # json-render 适配器
    └── cache.ts                # 缓存策略
```

**2.3 数据流**:

```
User Input → Intent Analysis → Spec Generation → Validation → Rendering
                │                      │              │            │
                ▼                      ▼              ▼            ▼
           [NLP Parser]          [LLM API]      [Zod Schema]   [React]
```

---

### Phase 3: Technical Spec (技术规范)

**3.1 依赖清单**:

```json
{
  "dependencies": {
    "@json-render/core": "^0.1.0",
    "@json-render/react": "^0.1.0",
    "@json-render/shadcn": "^0.1.0",
    "@json-render/next": "^0.1.0",
    "zod": "^3.22.0",
    "openai": "^4.0.0"
  }
}
```

**3.2 Catalog Schema** (组件库定义):

```typescript
// components/json-render/catalog.ts
import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";

export const agentmCatalog = defineCatalog(schema, {
  components: {
    // shadcn/ui 基础组件
    Card: {
      props: z.object({
        title: z.string(),
        description: z.string().optional(),
        variant: z.enum(["default", "metric", "alert"]).default("default"),
      }),
      description: "容器卡片组件",
    },
    Button: {
      props: z.object({
        label: z.string(),
        variant: z.enum(["default", "primary", "secondary", "danger"]),
        action: z.string(), // 绑定的 action ID
      }),
      description: "按钮组件",
    },
    Input: {
      props: z.object({
        label: z.string(),
        type: z.enum(["text", "number", "address", "token"]),
        placeholder: z.string().optional(),
        value: z.string().optional(),
      }),
      description: "输入框组件",
    },
    Select: {
      props: z.object({
        label: z.string(),
        options: z.array(z.object({ label: z.string(), value: z.string() })),
        value: z.string().optional(),
      }),
      description: "下拉选择组件",
    },
    Slider: {
      props: z.object({
        label: z.string(),
        min: z.number(),
        max: z.number(),
        step: z.number().default(1),
        value: z.number().optional(),
      }),
      description: "滑块组件",
    },
    TokenSelector: {
      props: z.object({
        label: z.string(),
        chainId: z.number().optional(),
        value: z.string().optional(),
      }),
      description: "代币选择器（AgentM 自定义）",
    },
    PriceChart: {
      props: z.object({
        token: z.string(),
        timeframe: z.enum(["1h", "24h", "7d", "30d"]),
        type: z.enum(["line", "candle"]),
      }),
      description: "价格图表（AgentM 自定义）",
    },
    MetricCard: {
      props: z.object({
        label: z.string(),
        value: z.string(),
        change: z.number().optional(), // 百分比变化
        trend: z.enum(["up", "down", "neutral"]).optional(),
      }),
      description: "指标卡片（AgentM 自定义）",
    },
  },
  actions: {
    submitConfig: {
      description: "提交 Agent 配置",
      params: z.object({ config: z.object({}) }),
    },
    updateField: {
      description: "更新字段值",
      params: z.object({ field: z.string(), value: z.any() }),
    },
    refreshData: {
      description: "刷新数据",
      params: z.object({}),
    },
  },
});
```

**3.3 AI Prompt 模板**:

```typescript
// lib/ai/prompts.ts
export const AGENT_CONFIG_PROMPT = `You are an expert UI designer for Web3 applications.

Given a user's description of an Agent they want to create, generate a JSON Spec for rendering a configuration form.

## User Description
"""{{userDescription}}"""

## Available Components
{{componentCatalog}}

## Rules
1. Only use components from the catalog above
2. Generate a form that collects all necessary information
3. Use appropriate input types (Select for enums, Slider for ranges, etc.)
4. Include validation hints where applicable
5. Group related fields together using Card components

## Output Format
Generate a valid JSON Spec following this structure:
{
  "root": "form-id",
  "elements": {
    "form-id": { "type": "Card", "props": {...}, "children": [...] },
    ...
  }
}`;

export const DASHBOARD_QUERY_PROMPT = `Given a user's data query, generate a dashboard layout.

## User Query
"""{{userQuery}}"""

## Available Data Sources
{{dataSources}}

## Rules
1. Choose appropriate visualization for the data type
2. Use MetricCard for KPIs
3. Use PriceChart for time-series data
4. Use Table for lists/transactions
5. Layout should be responsive and visually balanced

## Output Format
Generate a valid JSON Spec for the dashboard.`;
```

**3.4 API 接口**:

```typescript
// app/api/ai/generate-spec/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateSpec } from "@/lib/ai/spec-generator";

export async function POST(req: NextRequest) {
  const { prompt, context } = await req.json();
  
  try {
    const spec = await generateSpec({
      prompt,
      context,
      type: context.type, // "agent-config" | "dashboard" | "playground"
    });
    
    return NextResponse.json({ spec });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate spec" },
      { status: 500 }
    );
  }
}
```

---

### Phase 4: Task Breakdown (任务拆分)

**4.1 核心任务**:

#### 任务 GRA-200: 基础架构搭建
- **描述**: 安装依赖，配置 json-render 基础架构
- **工作量**: 2 天
- **依赖**: 无
- **子任务**:
  - [ ] 安装 @json-render/core, @json-render/react, @json-render/shadcn
  - [ ] 创建 catalog.ts 定义 AgentM 组件库
  - [ ] 创建 registry.tsx 注册实际组件
  - [ ] 创建类型定义文件

#### 任务 GRA-201: AI Spec 生成服务
- **描述**: 实现后端 AI Spec 生成 API
- **工作量**: 3 天
- **依赖**: GRA-200
- **子任务**:
  - [ ] 实现 /api/ai/generate-spec 接口
  - [ ] 编写 AI prompts (agent-config, dashboard)
  - [ ] 实现流式响应 (streaming)
  - [ ] 添加 Spec 验证和错误处理
  - [ ] 实现缓存策略

#### 任务 GRA-202: Agent 智能配置界面 (P0)
- **描述**: 在 Agent 创建页面添加智能配置模式
- **工作量**: 4 天
- **依赖**: GRA-200, GRA-201
- **子任务**:
  - [ ] 创建 SmartConfig 组件
  - [ ] 实现自然语言输入界面
  - [ ] 集成 Spec 生成和渲染
  - [ ] 实现配置预览和编辑
  - [ ] 添加传统/智能模式切换
  - [ ] 样式优化和响应式适配

#### 任务 GRA-203: 动态仪表盘 (P1)
- **描述**: 实现用户查询驱动的动态数据展示
- **工作量**: 5 天
- **依赖**: GRA-200, GRA-201
- **子任务**:
  - [ ] 创建 DynamicDashboard 组件
  - [ ] 实现自然语言查询输入
  - [ ] 集成数据获取和 Spec 生成
  - [ ] 实现图表组件 (PriceChart, MetricCard)
  - [ ] 支持历史查询和保存
  - [ ] 实现仪表盘分享功能

#### 任务 GRA-204: AI Playground (P2)
- **描述**: 实验性功能，让用户自由创建界面
- **工作量**: 3 天
- **依赖**: GRA-200, GRA-201
- **子任务**:
  - [ ] 创建 AI Playground 页面
  - [ ] 实现自由输入界面
  - [ ] 添加示例模板
  - [ ] 实现 Spec 编辑器（可手动修改）
  - [ ] 支持导出代码

#### 任务 GRA-205: 性能优化和测试
- **描述**: 优化性能和编写测试
- **工作量**: 3 天
- **依赖**: GRA-202, GRA-203
- **子任务**:
  - [ ] 实现 Spec 缓存
  - [ ] 添加组件懒加载
  - [ ] 编写单元测试
  - [ ] 编写集成测试
  - [ ] 性能测试和优化

#### 任务 GRA-206: 文档和示例
- **描述**: 编写文档和创建示例
- **工作量**: 2 天
- **依赖**: GRA-202
- **子任务**:
  - [ ] 编写使用文档
  - [ ] 创建示例集合
  - [ ] 编写最佳实践指南

**4.2 依赖图**:

```
GRA-200 (基础架构)
    │
    ├──► GRA-201 (AI 服务)
    │       │
    │       ├──► GRA-202 (智能配置) ──► GRA-205 (优化)
    │       │       │
    │       │       └──► GRA-206 (文档)
    │       │
    │       ├──► GRA-203 (仪表盘) ────► GRA-205
    │       │
    │       └──► GRA-204 (Playground) ──► GRA-205
```

---

### Phase 5: Test Spec (测试规范)

**5.1 测试策略**:

| 测试类型 | 范围 | 工具 |
|----------|------|------|
| 单元测试 | 工具函数、类型验证 | Vitest |
| 组件测试 | React 组件渲染 | React Testing Library |
| 集成测试 | API 接口、数据流 | Playwright |
| E2E 测试 | 完整用户流程 | Playwright |

**5.2 测试用例**:

```typescript
// __tests__/json-render/catalog.test.ts
describe("AgentM Catalog", () => {
  it("should validate valid component specs", () => {
    const validSpec = {
      type: "Card",
      props: { title: "Test" },
    };
    expect(() => validateSpec(validSpec)).not.toThrow();
  });

  it("should reject invalid component types", () => {
    const invalidSpec = {
      type: "UnknownComponent",
      props: {},
    };
    expect(() => validateSpec(invalidSpec)).toThrow();
  });
});

// __tests__/ai/spec-generator.test.ts
describe("Spec Generator", () => {
  it("should generate agent config spec from description", async () => {
    const description = "Monitor ETH price and alert when below 2000";
    const spec = await generateSpec({
      prompt: description,
      type: "agent-config",
    });
    
    expect(spec.root).toBeDefined();
    expect(spec.elements).toHaveProperty("token-selector");
    expect(spec.elements).toHaveProperty("price-threshold");
  });
});
```

---

### Phase 6: Implementation (实现)

**6.1 开发环境**:

```bash
# 1. 创建分支
git checkout -b feature/json-render-integration

# 2. 安装依赖
cd apps/agentm-web
npm install @json-render/core @json-render/react @json-render/shadcn

# 3. 启动开发
npm run dev
```

**6.2 实现顺序**:

```
Week 1:
  Day 1-2: GRA-200 (基础架构)
  Day 3-5: GRA-201 (AI 服务)

Week 2:
  Day 1-4: GRA-202 (智能配置 - P0)
  Day 5:  Code Review

Week 3:
  Day 1-3: GRA-203 (仪表盘 - P1)
  Day 4-5: GRA-204 (Playground - P2)

Week 4:
  Day 1-3: GRA-205 (优化和测试)
  Day 4-5: GRA-206 (文档) + 验收
```

---

### Phase 7: Review & Deploy (验收和部署)

**7.1 验收标准**:

- [ ] P0 功能（智能配置）正常运行
- [ ] 所有单元测试通过
- [ ] 性能指标达标（首屏渲染 < 2s）
- [ ] 文档完整
- [ ] Code Review 通过

**7.2 部署步骤**:

```bash
# 1. 合并到 main
git checkout main
git merge feature/json-render-integration

# 2. 推送到所有仓库
git push all main

# 3. Vercel 自动部署
```

---

## 📊 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| json-render 版本不稳定 | 中 | 高 | 锁定版本号，测试升级 |
| AI API 成本高 | 中 | 中 | 实现缓存，限制请求频率 |
| 生成 Spec 质量不稳定 | 高 | 中 | 添加验证和 fallback |
| 与现有 UI 冲突 | 低 | 高 | 渐进式集成，保留传统模式 |

---

## 💰 成本估算

| 项目 | 成本 |
|------|------|
| AI API (OpenAI/Anthropic) | ~$50-100/月 (按使用量) |
| 开发时间 | 4 周 x 1 人 |
| 测试环境 | 免费 (Vercel) |

---

## 🎯 成功指标

- **用户满意度**: 智能配置使用率达到 30%
- **效率提升**: Agent 配置时间减少 50%
- **错误率**: 配置错误率降低 30%
- **性能**: 界面生成时间 < 3s

---

## 📚 参考资源

- [VERCEL_LABS_INTEGRATION.md](../docs/VERCEL_LABS_INTEGRATION.md)
- [json-render GitHub](https://github.com/vercel-labs/json-render)
- [AgentM Web 现有架构](./ARCHITECTURE.md)
