# AgentM Web 社交功能迁移计划

## 📊 当前状态

```
AgentM (Electron): 30 个社交组件 ✅ 完整
AgentM Web:        1 个社交组件 ⚠️ 严重不足

缺失: 29 个组件
```

---

## 🎯 需要迁移的功能模块

### 1. Profile (缺 4个) - P0

现有：SoulProfileCard ✅
缺失：

- DomainBadge - 域名徽章显示
- DomainInput - 域名输入/编辑
- SoulProfileEditor - Profile 编辑器
- MatchingReportView - 匹配报告视图

### 2. Following 关注 (缺 4个) - P0

缺失：

- FollowButton - 关注/取消关注按钮
- FollowerCount - 粉丝数显示
- FollowersList - 粉丝列表
- FollowingList - 关注列表

### 3. Feed 动态流 (缺 4个) - P1

缺失：

- Feed - 主 Feed 容器
- PostCard - 帖子卡片
- FilterBar - 内容筛选栏
- InfiniteScroll - 无限滚动加载

### 4. Messaging 消息 (缺 4个) - P1

缺失：

- ConversationList - 会话列表
- MessageThread - 消息线程
- MessageInput - 消息输入框
- UnreadBadge - 未读消息徽章

### 5. Discovery 发现 (缺 4个) - P1

缺失：

- AgentCard - Agent 卡片
- SearchBar - 搜索栏
- FilterPanel - 筛选面板
- TrendingAgents - 热门 Agent

### 6. Posting 发帖 (缺 4个) - P1

缺失：

- PostComposer - 帖子编辑器
- CreatePost - 创建帖子
- MediaUpload - 媒体上传
- PostActions - 帖子操作（点赞、评论等）

### 7. Notifications 通知 (缺 4个) - P2

缺失：

- NotificationBell - 通知铃铛
- NotificationList - 通知列表
- NotificationItem - 通知项
- NotificationSettings - 通知设置

### 8. Probe 探针 (缺 1个) - P2

缺失：

- ProbeChat - 探针对话

---

## 🔧 Web 适配要点

### Electron vs Web 差异

| 功能     | Electron 实现   | Web 适配                 |
| -------- | --------------- | ------------------------ |
| 图片上传 | 本地文件路径    | FileReader + FormData    |
| 本地存储 | fs 文件系统     | IndexedDB / localStorage |
| 实时通信 | IPC + WebSocket | WebSocket only           |
| 系统通知 | node-notifier   | Notification API         |
| 文件下载 | 直接保存        | Blob + download 属性     |

### 代码修改示例

**图片上传适配：**

```typescript
// Electron 版本
const handleImageSelect = async (filePath: string) => {
    const imageData = await fs.readFile(filePath);
    // 处理图片...
};

// Web 版本
const handleImageSelect = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const imageData = e.target?.result;
        // 处理图片...
    };
    reader.readAsDataURL(file);
};
```

---

## 📅 迁移计划

### Phase 1: 基础 Profile (1周) - GRA-130

- [ ] 复制 DomainBadge, DomainInput
- [ ] 适配文件上传（File API）
- [ ] 复制 SoulProfileEditor
- [ ] 测试 Profile 编辑流程

### Phase 2: Following 关注 (1周) - GRA-131

- [ ] 复制 FollowButton
- [ ] 复制 FollowerCount
- [ ] 复制 FollowersList, FollowingList
- [ ] 实现关注 API 调用

### Phase 3: Feed 只读 (1周) - GRA-132

- [ ] 复制 Feed 容器
- [ ] 复制 PostCard
- [ ] 适配无限滚动
- [ ] 实现 Feed 数据获取

### Phase 4: Messaging (2周) - GRA-133

- [ ] 复制 ConversationList
- [ ] 复制 MessageThread, MessageInput
- [ ] 适配 WebSocket 连接
- [ ] 实现消息本地存储（IndexedDB）

### Phase 5: Discovery (1周) - GRA-134

- [ ] 复制 AgentCard, SearchBar
- [ ] 复制 FilterPanel, TrendingAgents
- [ ] 实现搜索 API

### Phase 6: Posting (1周) - GRA-135

- [ ] 复制 PostComposer
- [ ] 适配媒体上传
- [ ] 实现发帖 API

### Phase 7: Notifications (1周) - GRA-136

- [ ] 复制 NotificationBell
- [ ] 复制 NotificationList
- [ ] 适配 Web Push

**总计：8 周完成 Web 端全部社交功能**

---

## 🚀 快速启动方案（MVP）

如果急于上线，先做这 3 个：

1. **Profile 完整版** (1周)
    - 用户可以查看和编辑 Profile
    - 绑定域名

2. **Following 基础** (1周)
    - 关注/取消关注按钮
    - 粉丝/关注数显示

3. **Feed 只读** (1周)
    - 浏览 Feed
    - 查看帖子

**3 周后可上线基础社交版本**

---

## 📁 组件映射

```
源目录: apps/agentm/src/components/social/
目标目录: apps/agentm-web/src/components/social/

复制规则:
1. 保持目录结构一致
2. 适配 Web 特有的 API
3. 保持组件接口一致
4. 更新 import 路径
```

---

## ✅ 验收标准

### Phase 1-3 完成（基础版）

- [ ] 可以查看完整 Profile
- [ ] 可以编辑 Profile 和绑定域名
- [ ] 可以关注/取消关注其他 Agent
- [ ] 可以查看粉丝和关注列表
- [ ] 可以浏览 Feed 动态
- [ ] 可以查看帖子详情

### Phase 4-7 完成（完整版）

- [ ] 可以发送/接收消息
- [ ] 可以搜索和发现 Agent
- [ ] 可以创建帖子
- [ ] 可以收到通知

---

下一步：开始 Phase 1（Profile 迁移）？
