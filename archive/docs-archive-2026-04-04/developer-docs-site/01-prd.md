# Developer Docs Site - Product Requirements Document

> 既服务人类开发者，也服务 AI Agent 的文档系统

---

## 🎯 Vision

创建一个双模文档系统：

1. **人类模式**: 传统开发者文档，易于阅读和学习
2. **Agent 模式**: 结构化、机器可解析的文档，让 AI Agent 能够自学如何使用平台

**核心创新**: 文档即接口 (Documentation as Interface) - Agent 可以通过阅读文档自主学习 API 使用方法。

---

## 📝 Requirements

### Functional Requirements

#### 1. 双模文档渲染

- [ ] 根据访问者类型自动切换渲染模式
- [ ] 人类模式: 美观的 UI，导航，搜索
- [ ] Agent 模式: 结构化 JSON/Markdown，机器优先

#### 2. 文档内容组织

- [ ] 按 7-Phase 开发生命周期组织
- [ ] 每个模块独立的快速开始指南
- [ ] API 参考文档
- [ ] 示例代码库
- [ ] 最佳实践指南

#### 3. Agent 学习支持

- [ ] 文档内嵌 Machine-Readable Schema
- [ ] API 调用示例的语义化标记
- [ ] 参数说明的结构化数据
- [ ] 错误代码及其解决方案

#### 4. Scale 支持

- [ ] 水平扩展的架构设计
- [ ] CDN 全球加速
- [ ] 版本化管理 (v1, v2, ...)
- [ ] 多语言支持
- [ ] A/B 测试能力

#### 5. 交互功能

- [ ] 交互式代码 Playground
- [ ] API Explorer (类似 Swagger)
- [ ] 实时预览功能
- [ ] 社区贡献入口

---

## 🏗️ Technical Architecture

### System Design

```
┌─────────────────────────────────────────────────────┐
│                  Developer Docs Site                 │
├─────────────────────────────────────────────────────┤
│  Layer 1: Presentation                               │
│  ├── Human UI (Next.js + Tailwind)                  │
│  ├── Agent API (JSON/MD endpoints)                  │
│  └── Content Delivery (CDN)                         │
├─────────────────────────────────────────────────────┤
│  Layer 2: Content Processing                         │
│  ├── Markdown Parser                                │
│  ├── Schema Extractor                               │
│  └── Multi-format Renderer                          │
├─────────────────────────────────────────────────────┤
│  Layer 3: Content Source                             │
│  ├── Git Repo (Markdown files)                      │
│  ├── API Definitions (OpenAPI/GraphQL)              │
│  └── Code Examples (Runnable snippets)              │
└─────────────────────────────────────────────────────┘
```

### Content Schema

每个文档页面包含:

```yaml
---
title: 'API Name'
description: 'Human readable description'
agent_context: 'Agent learning context'
phase: '3' # 7-Phase lifecycle
module: 'chain-hub'
tags: ['api', 'reputation', 'core']
scale_support:
    - rate_limiting
    - caching
    - batch_operations
human_content:
    quick_start: 'path/to/quickstart.md'
    detailed_guide: 'path/to/guide.md'
    examples: ['path/to/example1.md']
agent_content:
    schema: 'path/to/schema.json'
    function_signature: 'function_name(param: type): return_type'
    error_codes: ['ERROR_001', 'ERROR_002']
    related_apis: ['api1', 'api2']
---
```

---

## 🎨 UI/UX Design

### Human Mode

**Layout**:

- 左侧导航栏 (7-Phase 结构)
- 中间内容区
- 右侧 TOC + API 快速参考
- 顶部搜索栏

**Features**:

- 暗黑/亮色模式
- 字体大小调节
- 代码高亮
- 复制按钮
- 反馈按钮

### Agent Mode

**Access**:

```
GET /api/docs/agent/{module}/{endpoint}
Accept: application/json

Response:
{
  "module": "chain-hub",
  "endpoint": "reputation.get",
  "description": "...",
  "parameters": [...],
  "returns": {...},
  "examples": [...],
  "error_handling": {...},
  "learning_path": ["prereq1", "prereq2"]
}
```

---

## 📊 Success Metrics

1. **Human Metrics**:
    - 文档加载时间 < 1s
    - 用户满意度 > 4.5/5
    - 搜索成功率 > 90%

2. **Agent Metrics**:
    - Agent API 响应时间 < 100ms
    - Schema 完整性 100%
    - Agent 任务成功率提升 30%

3. **Scale Metrics**:
    - 支持 10k+ 并发访问
    - 99.9% uptime
    - 全球 CDN 延迟 < 50ms

---

## 🚀 Roadmap

### Phase 1: MVP (2 weeks)

- [ ] 基础站点框架
- [ ] 人类模式 UI
- [ ] Chain Hub 文档示例

### Phase 2: Agent Support (2 weeks)

- [ ] Agent API 端点
- [ ] Schema 定义
- [ ] 自动解析系统

### Phase 3: Scale & Polish (2 weeks)

- [ ] CDN 部署
- [ ] 版本化管理
- [ ] 多语言支持

---

## 💡 Key Differentiators

1. **Agent-First Documentation**: 首个专为 AI Agent 设计的文档系统
2. **Dual-Mode Rendering**: 一套内容，多种消费方式
3. **Self-Learning Agents**: Agent 可以自主学习如何使用平台
4. **Scale-First Design**: 从第一天就考虑大规模使用

---

_Created: 2026-04-03_  
_Status: Phase 1 Planning_
