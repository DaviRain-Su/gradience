# AgentM Web 实施计划

## 🎯 战略优先级

**Web 端 > 桌面端**

理由：
1. **零门槛** - 用户无需下载，浏览器即用
2. **传播快** - 链接分享，病毒式传播
3. **开发快** - 无需处理 Electron 打包
4. **跨平台** - 手机/平板/电脑都能用

---

## 📅 三阶段交付

### Phase 1: MVP（3 周）- 能用
目标：用户可以注册、登录、看 Profile、关注别人

| 周 | 功能 | 产出 |
|---|---|---|
| 1 | Profile 完整版 | 查看/编辑 Profile，绑定域名 |
| 2 | Following 关注 | 关注/取消关注，粉丝列表 |
| 3 | Feed 只读 | 浏览 Feed，看帖子 |

**MVP 验收**：用户可以完整使用基础社交功能

---

### Phase 2: 完整社交（5 周）- 好用
目标：消息、发帖、发现，完整社交体验

| 周 | 功能 | 产出 |
|---|---|---|
| 4-5 | Messaging | 实时消息，会话列表 |
| 6 | Discovery | 搜索 Agent，热门推荐 |
| 7 | Posting | 发帖，媒体上传 |
| 8 | Notifications | 通知系统 |

**Phase 2 验收**：完整社交产品体验

---

### Phase 3: 增强（4 周）- 爱用
目标：高级功能，差异化竞争

| 周 | 功能 | 产出 |
|---|---|---|
| 9 | Probe 探针 | Agent 能力探测 |
| 10 | Matching | 智能匹配推荐 |
| 11-12 | 优化打磨 | 性能优化，体验提升 |

---

## 🚀 立即开始 Phase 1

### Week 1: Profile 完整版

#### Day 1-2: 复制组件
- [ ] 复制 DomainBadge → `apps/agentm-web/src/components/social/DomainBadge.tsx`
- [ ] 复制 DomainInput → `apps/agentm-web/src/components/social/DomainInput.tsx`
- [ ] 复制 SoulProfileEditor → `apps/agentm-web/src/components/social/SoulProfileEditor.tsx`
- [ ] 复制 MatchingReportView → `apps/agentm-web/src/components/social/MatchingReportView.tsx`

#### Day 3: Web 适配
- [ ] 适配 DomainInput 文件上传（File API）
- [ ] 适配图片预览（FileReader）
- [ ] 创建 Profile API hooks

#### Day 4-5: 集成测试
- [ ] 创建 Profile 页面路由
- [ ] 集成组件
- [ ] 测试编辑流程

---

### Week 2: Following 关注

#### Day 1-2: 复制组件
- [ ] FollowButton
- [ ] FollowerCount
- [ ] FollowersList
- [ ] FollowingList

#### Day 3-4: API 集成
- [ ] 创建 Following hooks
- [ ] 实现关注/取消关注 API
- [ ] 实现列表获取 API

#### Day 5: 测试优化
- [ ] 测试关注流程
- [ ] 移动端适配

---

### Week 3: Feed 只读

#### Day 1-2: 复制组件
- [ ] Feed 容器
- [ ] PostCard
- [ ] FilterBar

#### Day 3-4: 无限滚动
- [ ] 适配 InfiniteScroll（IntersectionObserver）
- [ ] 创建 Feed hooks
- [ ] 实现分页加载

#### Day 5: 集成上线
- [ ] 创建 Feed 页面
- [ ] 集成到导航
- [ ] 部署测试

---

## 📁 项目结构目标

```
apps/agentm-web/src/
├── app/                          # Next.js 页面
│   ├── page.tsx                  # 首页/Feed
│   ├── profile/
│   │   ├── [id]/page.tsx         # Profile 详情
│   │   └── edit/page.tsx         # Profile 编辑
│   ├── following/page.tsx        # 关注列表
│   └── messages/page.tsx         # 消息（Phase 2）
│
├── components/
│   ├── social/                   # 社交组件
│   │   ├── DomainBadge.tsx
│   │   ├── DomainInput.tsx
│   │   ├── SoulProfileCard.tsx   # 已有
│   │   ├── SoulProfileEditor.tsx
│   │   ├── FollowButton.tsx
│   │   ├── FollowerCount.tsx
│   │   ├── FollowersList.tsx
│   │   ├── FollowingList.tsx
│   │   ├── Feed.tsx
│   │   ├── PostCard.tsx
│   │   ├── FilterBar.tsx
│   │   └── InfiniteScroll.tsx
│   │
│   ├── messaging/                # 消息组件（Phase 2）
│   ├── discovery/                # 发现组件（Phase 2）
│   └── posting/                  # 发帖组件（Phase 2）
│
├── hooks/                        # 自定义 hooks
│   ├── useProfile.ts
│   ├── useFollowing.ts
│   ├── useFeed.ts
│   └── useMessaging.ts
│
├── lib/                          # 工具函数
│   ├── api.ts                    # API 封装
│   ├── storage.ts                # 本地存储
│   └── utils.ts
│
└── types/                        # TypeScript 类型
    ├── profile.ts
    ├── social.ts
    └── messaging.ts
```

---

## 🔧 技术栈

**已具备：**
- Next.js 15
- React 19
- Tailwind CSS 4
- Solana Web3.js
- Privy Auth

**需要添加：**
- [ ] TanStack Query（数据获取）
- [ ] Zustand（状态管理）
- [ ] IntersectionObserver（无限滚动）
- [ ] IndexedDB（本地消息存储）

---

## ✅ 每周交付物

### Week 1 交付
- [ ] Profile 查看页面
- [ ] Profile 编辑功能
- [ ] 域名绑定功能
- [ ] 响应式设计

### Week 2 交付
- [ ] 关注按钮（任何地方都能关注）
- [ ] 粉丝列表页面
- [ ] 关注列表页面
- [ ] 关注数显示

### Week 3 交付
- [ ] Feed 首页
- [ ] 帖子卡片
- [ ] 无限滚动
- [ ] 部署上线

---

## 🎯 MVP 成功标准

用户可以通过浏览器：
1. ✅ 使用钱包登录（已有）
2. ✅ 查看和编辑 Profile
3. ✅ 绑定 .sol 域名
4. ✅ 关注其他 Agent
5. ✅ 查看粉丝和关注列表
6. ✅ 浏览 Feed 动态
7. ✅ 查看帖子详情

**达到以上标准，MVP 完成！**

---

## 🚀 开始执行

选择开始方式：
- A. **手动执行** - 我一步步带你完成 Week 1
- B. **并行开发** - 使用 droid 同时做多任务
- C. **你主导** - 你写代码，我 review 和指导

推荐：A（手动执行），确保质量
