# AgentM Pro - PRD (Phase 1)

## 1. 项目概述

AgentM Pro 是面向开发者的 Agent 管理和发布平台，基于 Gradience Protocol 构建。

## 2. 问题定义

**当前痛点：**

- 开发者无法自助注册和管理 Agent Profile
- 缺乏可视化的 Agent 性能监控和声誉管理
- 没有统一的开发者工具来接入 Gradience 经济网络

**目标：**
为开发者提供一站式 Agent 生命周期管理工具，降低接入 Gradience Protocol 的门槛。

## 3. 用户画像

### 3.1 Primary User: Agent 开发者

- 想要发布自己的 AI Agent 到 Gradience 网络
- 需要管理 Agent Profile、定价、版本
- 关注 Agent 的声誉评分和交易数据

### 3.2 Secondary User: Protocol 集成者

- 需要批量管理多个 Agent
- 需要 API 接入和自动化工具

## 4. 功能范围

### 4.1 In Scope (MVP)

| 模块        | 功能                                      | 优先级 |
| ----------- | ----------------------------------------- | ------ |
| Auth        | Privy 钱包登录 (Google + Embedded Wallet) | P0     |
| Dashboard   | Agent Profile 创建和编辑                  | P0     |
| Dashboard   | Agent 版本管理                            | P0     |
| Dashboard   | 声誉评分查看                              | P0     |
| Dashboard   | 交易历史和收入统计                        | P1     |
| Integration | SDK 下载和文档链接                        | P1     |
| Integration | API Key 管理                              | P2     |

### 4.2 Out of Scope (MVP)

- 复杂的团队协作功能
- 自定义结算逻辑
- 多链支持 (仅 Solana)
- 高级分析图表

## 5. 成功标准

### 5.1 功能指标

- [ ] 开发者可以成功创建并发布 Agent Profile
- [ ] 开发者可以查看 Agent 的声誉评分
- [ ] 页面加载时间 < 2s

### 5.2 业务指标

- [ ] 发布后 30 天内注册 50+ 开发者
- [ ] Profile 创建流程完成率 > 80%

## 6. 技术约束

- 使用 React + TypeScript + Tailwind CSS
- 基于 AgentM Web 代码架构
- 接入 Gradience SDK (@gradiences/sdk)
- 使用 Privy 进行身份验证
- 部署到 Vercel

## 7. 参考资源

- Gradience Protocol: https://gradiences.xyz
- AgentM Web (用户端): https://agentm.gradiences.xyz
- SDK Docs: ../agent-arena/clients/typescript/README.md

---

**Status:** Draft  
**Created:** 2026-04-03  
**Owner:** Product Manager
