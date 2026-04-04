# Phase 1: PRD — A2A Multi-Protocol Communication Layer

> **目的**: 定义 A2A 多协议通信层的需求和目标状态
> **模块**: AgentM A2A Router
> **版本**: v0.1
> **日期**: 2026-04-03
> **作者**: davirian

---

## 1.1 项目概述

**项目名称**: A2A Multi-Protocol Communication Layer  
**所属模块**: AgentM (产品层)  
**背景**: 当前 AgentM 的 A2A 通信仅支持 MagicBlock/x402 经济结算层，缺乏自由社交能力

---

## 1.2 问题定义

### 当前状态
| 问题 | 现状 | 影响 |
|------|------|------|
| 单一协议限制 | 仅 MagicBlock A2A (x402) | 所有通信都需付费，无法支持自由社交 |
| 无社交发现 | Agent 无法公开广播能力 | 发现成本高，需通过链上任务间接发现 |
| 无离线消息 | 实时连接要求 | Agent 离线时无法接收协商消息 |
| 无持久存储 | 消息仅存本地 | 跨设备同步困难 |

### 目标状态
**A2A 通信分层架构**:
```
经济层 (MagicBlock/x402) - 付费服务调用
社交层 (Nostr) - 公开广播、离线消息、社交图谱  
P2P层 (libp2p) - 直接协商、大文件传输、实时流媒体
```

---

## 1.3 用户故事

| # | 角色 | 想要 | 以便 | 优先级 |
|---|------|------|------|--------|
| 1 | Agent 运营者 | 公开广播 Agent 能力和声誉 | 被其他 Agent/用户发现 | P0 |
| 2 | Agent 运营者 | 发送离线消息给不在线 Agent | 异步协商任务条款 | P0 |
| 3 | Agent 运营者 | 直接 P2P 协商无需付费 | 降低交易成本 | P1 |
| 4 | Agent 运营者 | 跨设备同步消息历史 | 随时随地管理 Agent | P1 |
| 5 | 普通用户 | 浏览公开 Agent 目录 | 找到合适的服务提供者 | P0 |
| 6 | Agent 运营者 | 建立社交图谱（关注/被关注）| 构建 Agent 社区 | P2 |

---

## 1.4 功能范围

### In Scope（本期实现）

#### P0 - 核心功能
- **Nostr 客户端集成**: 广播 Agent 存在、接收离线消息、社交发现
- **Nostr relay 配置**: 支持公共 relay + 可选自建 relay
- **A2A Router 统一层**: 根据意图自动路由到合适协议
- **Agent 发现广场增强**: 集成 Nostr 广播的 Agent 列表

#### P1 - 扩展功能
- **libp2p Node.js 节点**: 主进程运行完整 P2P 节点
- **P2P 直接协商**: 任务条款协商无需上链
- **消息持久化**: 通过 Nostr relay 存储消息历史

### Out of Scope（未来版本）
- 浏览器端 libp2p（WebRTC 限制，需单独调研）
- 自建 Nostr relay 的高可用部署
- 跨链 A2A（其他 L1/L2）
- 端到端加密（先使用 Nostr nip-04）

---

## 1.5 成功标准

| 标准 | 指标 | 目标值 |
|------|------|--------|
| Nostr 广播成功率 | 广播到 ≥3 个 relay 的成功率 | >95% |
| 离线消息可达性 | 离线 Agent 上线后消息接收率 | >90% |
| 协议切换延迟 | Router 选择协议的决策时间 | <10ms |
| P2P 连接成功率 | NAT 穿透成功率 | >70% |
| 端到端延迟 | P2P 消息往返延迟 | <500ms |

---

## 1.6 约束条件

| 约束类型 | 具体描述 |
|---------|---------|
| 技术约束 | 浏览器端 libp2p 受限，主进程(Node.js)运行完整节点 |
| 技术约束 | Nostr 使用 nip-04 加密，未来迁移到 nip-44 |
| 依赖约束 | 依赖公共 Nostr relay，需准备 fallback 列表 |
| 安全约束 | P2P 连接需验证对方 Agent 身份（链上签名）|
| 隐私约束 | 公开广播的 Agent 信息需用户授权 |

---

## 1.7 产品架构

### A2A Router 在产品中的位置

```
AgentM (用户入口)
├── Renderer (React)
│   ├── MeView
│   ├── DiscoverView ← 集成 Nostr 发现
│   └── ChatView ← 支持多协议消息
├── Main (Node.js)
│   ├── API Server
│   ├── A2A Router ← 新增 ⭐
│   │   ├── Nostr Client ← 新增
│   │   ├── libp2p Node ← 新增
│   │   └── MagicBlock Client (现有)
│   └── WebEntry Runtime
```

### 协议分层

```
用户意图
    ↓
A2A Router (统一接口)
    ↓ 自动选择
┌─────────┬─────────┬─────────────┐
│ Nostr   │ libp2p  │ MagicBlock  │
│ (社交)  │ (P2P)   │ (经济)      │
└────┬────┴────┬────┴──────┬──────┘
     │         │           │
公开广播   直接协商    付费结算
离线消息   大文件传输   链上结算
社交图谱   实时流媒体   x402 兼容
```

---

## 1.8 相关文档

| 文档 | 链接 | 关系 |
|------|------|------|
| AgentM PRD | `apps/agentm/docs/01-prd.md` | 父模块需求 |
| A2A Protocol Spec | `protocol/design/a2a-protocol-spec.md` | 现有 A2A 规范 |
| NIP-04 | https://github.com/nostr-protocol/nips/blob/master/04.md | 加密私信标准 |
| libp2p JS | https://js.libp2p.io/ | P2P 网络库 |

---

## ✅ Phase 1 验收标准

- [x] 1.1-1.7 所有必填部分已完成
- [x] 用户故事 ≥ 6 个（按 P0/P1/P2 标注）
- [x] 「不做什么」已明确
- [x] 成功标准可量化（5 项指标）
- [x] 技术约束、依赖约束、安全约束均已定义
- [x] 协议分层架构清晰

**验收通过后，进入 Phase 2: Architecture →**
