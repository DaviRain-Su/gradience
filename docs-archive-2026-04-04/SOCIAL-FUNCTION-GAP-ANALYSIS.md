# AgentM 社交功能差距分析

## 📊 现状对比

| 平台 | 社交组件数量 | 完整度 |
|------|-------------|--------|
| **AgentM (Electron)** | 30 个组件 | ✅ 完整 |
| **AgentM Web** | 1 个组件 | ⚠️ 严重不足 |

---

## 🔍 详细差距分析

### AgentM (Electron) - 完整实现

```
apps/agentm/src/components/social/
├── discovery/          # Agent 发现 (4个)
│   ├── AgentCard.tsx
│   ├── FilterPanel.tsx
│   ├── SearchBar.tsx
│   └── TrendingAgents.tsx
│
├── feed/               # Feed 流 (4个)
│   ├── Feed.tsx
│   ├── FilterBar.tsx
│   ├── InfiniteScroll.tsx
│   └── PostCard.tsx
│
├── following/          # 关注系统 (4个)
│   ├── FollowButton.tsx
│   ├── FollowerCount.tsx
│   ├── FollowersList.tsx
│   └── FollowingList.tsx
│
├── messaging/          # 消息系统 (4个)
│   ├── ConversationList.tsx
│   ├── MessageInput.tsx
│   ├── MessageThread.tsx
│   └── UnreadBadge.tsx
│
├── notifications/      # 通知系统 (4个)
│   ├── NotificationBell.tsx
│   ├── NotificationItem.tsx
│   ├── NotificationList.tsx
│   └── NotificationSettings.tsx
│
├── posting/            # 发帖功能 (4个)
│   ├── CreatePost.tsx
│   ├── MediaUpload.tsx
│   ├── PostActions.tsx
│   └── PostComposer.tsx
│
├── probe/              # 探针功能 (1个)
│   └── ProbeChat.tsx
│
└── profile/            # Profile (5个)
    ├── DomainBadge.tsx
    ├── DomainInput.tsx
    ├── MatchingReportView.tsx
    ├── SoulProfileCard.tsx
    └── SoulProfileEditor.tsx
```

### AgentM Web - 当前实现

```
apps/agentm-web/src/components/social/
└── SoulProfileCard.tsx    # 仅1个组件
```

---

## ⚠️ 缺少的功能（29个组件）

### 1. Discovery 发现 (缺 4个)
- [ ] AgentCard - Agent 卡片展示
- [ ] FilterPanel - 筛选面板
- [ ] SearchBar - 搜索栏
- [ ] TrendingAgents - 热门 Agent

### 2. Feed 动态流 (缺 4个)
- [ ] Feed - 主 Feed 组件
- [ ] FilterBar - 内容筛选
- [ ] InfiniteScroll - 无限滚动
- [ ] PostCard - 帖子卡片

### 3. Following 关注 (缺 4个)
- [ ] FollowButton - 关注按钮
- [ ] FollowerCount - 粉丝数
- [ ] FollowersList - 粉丝列表
- [ ] FollowingList - 关注列表

### 4. Messaging 消息 (缺 4个)
- [ ] ConversationList - 会话列表
- [ ] MessageInput - 消息输入
- [ ] MessageThread - 消息线程
- [ ] UnreadBadge - 未读徽章

### 5. Notifications 通知 (缺 4个)
- [ ] NotificationBell - 通知铃铛
- [ ] NotificationItem - 通知项
- [ ] NotificationList - 通知列表
- [ ] NotificationSettings - 通知设置

### 6. Posting 发帖 (缺 4个)
- [ ] CreatePost - 创建帖子
- [ ] MediaUpload - 媒体上传
- [ ] PostActions - 帖子操作
- [ ] PostComposer - 帖子编辑器

### 7. Profile 完整版 (缺 4个)
- [x] SoulProfileCard - ✅ 已有
- [ ] DomainBadge - 域名徽章
- [ ] DomainInput - 域名输入
- [ ] MatchingReportView - 匹配报告
- [ ] SoulProfileEditor - Profile 编辑器

### 8. Probe 探针 (缺 1个)
- [ ] ProbeChat - 探针聊天

---

## 🎯 优先级排序

### P0 - 核心功能（必须）
1. **Profile 完整版** (4个)
   - DomainBadge, DomainInput
   - SoulProfileEditor
   - 原因：用户基础信息展示和编辑

2. **Following 关注** (4个)
   - FollowButton, FollowerCount
   - FollowersList, FollowingList
   - 原因：社交网络基础

3. **Feed 基础** (2个)
   - Feed, PostCard
   - 原因：内容展示核心

### P1 - 重要功能（应该）
4. **Messaging 消息** (4个)
   - 原因：A2A 通信核心

5. **Discovery 发现** (4个)
   - 原因：Agent 发现和新用户获取

6. **Posting 发帖** (4个)
   - 原因：内容创作

### P2 - 增强功能（可选）
7. **Notifications 通知** (4个)
8. **Feed 高级** (2个) - FilterBar, InfiniteScroll
9. **Probe 探针** (1个)
10. **Profile 高级** (1个) - MatchingReportView

---

## 🔧 Web 端适配考虑

### 技术差异

| 方面 | Electron | Web |
|------|----------|-----|
| 存储 | 本地文件系统 | IndexedDB / localStorage |
| 通信 | IPC + WebSocket | WebSocket / HTTP |
| 通知 | 系统通知 | Web Push / 浏览器通知 |
| 文件上传 | 本地文件选择 | HTML5 File API |

### 需要修改的点

1. **存储层**
   ```typescript
   // Electron: 使用 fs 读写
   // Web: 使用 IndexedDB
   ```

2. **消息通信**
   ```typescript
   // Electron: IPC + WebSocket
   // Web: WebSocket only
   ```

3. **文件处理**
   ```typescript
   // Electron: 本地文件路径
   // Web: FileReader + Blob URL
   ```

4. **通知**
   ```typescript
   // Electron: node-notifier
   // Web: Notification API
   ```

---

## 📋 迁移任务清单

### Phase 1: Profile + Following (2周)
- [ ] 复制 Profile 组件到 Web
- [ ] 适配 DomainInput (文件上传改 File API)
- [ ] 复制 Following 组件
- [ ] 实现关注 API 调用
- [ ] 测试移动端适配

### Phase 2: Feed (1周)
- [ ] 复制 Feed 组件
- [ ] 适配无限滚动 (IntersectionObserver)
- [ ] 实现帖子数据获取

### Phase 3: Messaging (2周)
- [ ] 复制 Messaging 组件
- [ ] 适配 WebSocket 连接
- [ ] 实现消息存储 (IndexedDB)

### Phase 4: Discovery + Posting (2周)
- [ ] 复制 Discovery 组件
- [ ] 复制 Posting 组件
- [ ] 适配媒体上传

### Phase 5: Notifications (1周)
- [ ] 复制 Notifications 组件
- [ ] 适配 Web Push

**总计：8 周完成 Web 端社交功能**

---

## 💡 建议

### 短期（快速上线）
仅实现 P0 功能：
- Profile 完整版
- Following 基础
- Feed 只读

这样用户可以：
- 查看和编辑 Profile
- 关注/取消关注 Agent
- 浏览 Feed

### 中期（完整社交）
添加 P1 功能：
- Messaging
- Posting
- Discovery

### 长期（体验优化）
添加 P2 功能：
- Notifications
- Advanced Feed
- Probe

---

## ✅ 当前状态总结

**AgentM Web 社交功能：约 3% 完成度**

急需补充：
- 29 个组件缺失
- 6 大功能模块待实现
- 存储/通信层需要 Web 适配

**建议立即开始 Phase 1（Profile + Following）**
