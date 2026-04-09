# Agent Me 核心定位：你的 OpenClaw 的专属连接

> **一句话价值主张：Agent Me 是连接你本地 OpenClaw 的移动端专线，让私人 AI 随时在线**
>
> 分析日期：2026-03-29

---

## 一、Typeless 模式启示

### 1.1 订阅制 AI 助手的可行性

```
Typeless 证明的商业模式：
├── 产品形态：AI 助手 App
├── 收费模式：订阅制 ($X/月)
├── 核心价值：个性化 AI 体验
└── 用户付费意愿：存在且可观

关键启示：
- 用户愿意为"好用的 AI 助手"付费
- 订阅制比一次性购买更可持续
- 关键是提供持续的价值
```

### 1.2 Agent Me 的差异化价值

```
Typeless (假设是云端 AI 助手):
├── AI 在云端运行
├── 数据存储在服务商
├── 通用能力
└── 订阅费给服务商

Agent Me (本地 AI 助手):
├── AI 在本地 OpenClaw 运行
├── 数据存在用户设备
├── 个性化能力 (用户配置)
└── 订阅费给连接服务

差异化：
✅ 隐私更好 (数据不出本地)
✅ 更个性化 (基于用户知识库)
✅ 可扩展 (用户添加 Skills)
✅ 长期成本低 (无 API 调用费)
```

---

## 二、核心痛点：长期连接

### 2.1 为什么是痛点？

```
现状问题：
用户运行了 OpenClaw (本地 AI)
    │
    ├── 在电脑上可以使用
    ├── 功能强大但只能在桌面端
    └── 移动端没有好的入口

结果：
- 70% 的时间在手机上，无法使用
- 想用手机时，只能远程连接电脑 (麻烦)
- 没有"随时在线"的感觉

痛点本质：
"我有了一个强大的本地 AI，但我无法在移动中方便地使用它"
```

### 2.2 Agent Me 的解决方案

```
Agent Me = 移动端的 OpenClaw 专线

连接方式：
用户手机 (Agent Me App)
    │ WebSocket 常连接
    ▼
用户电脑/服务器 (OpenClaw)
    │ 本地运行
    ▼
用户的数据和 AI 能力

特点：
- 保持长期连接 (WebSocket 心跳)
- 随时随地语音对话
- 状态同步 (对话历史、任务状态)
- 后台保活 (不错过消息)

体验：
早上上班路上："今天有什么安排？" → OpenClaw 查日历 → 语音回复
中午吃饭时："帮我记录个想法..." → OpenClaw 存到笔记
晚上睡前："总结今天的任务" → OpenClaw 汇总 → 语音汇报

全程用手机，但用的是自己的 OpenClaw
```

---

## 三、商业价值分析

### 3.1 为什么用户愿意付费？

```
付费理由 1：隐私价值
"我的数据完全属于自己，不担心被大公司训练模型"
→ 对隐私敏感用户有价值

付费理由 2：个性化价值
"这个 AI 懂我，因为我训练了它"
→ 长期使用后越来越准

付费理由 3：体验价值
"随时随地可以用语音和 AI 对话"
→ 比打字方便10倍

付费理由 4：效率价值
"Agent 可以帮我处理很多事情"
→ 节省时间 = 省钱
```

### 3.2 订阅模式设计

```yaml
Free 版 (基础连接):
  - WebSocket 连接
  - 文字对话
  - 基础语音 (系统 TTS)
  - 单设备
  目的: 让用户体验价值

Pro 版 ($9.99/月):
  - 高质量语音 (VibeVoice Realtime)
  - 多设备同时在线
  - 后台保活
  - 对话历史同步
  - 优先客服
  目的: 核心收入来源

Team 版 ($29.99/月):
  - 多用户共享 OpenClaw
  - 团队协作功能
  - 管理员面板
  - API 访问
  目的: 企业客户
```

### 3.3 与 OpenClaw 的关系

```
商业模式澄清：

Agent Me 收费 ≠ OpenClaw 收费
├── Agent Me: 连接服务 (收费)
├── OpenClaw: 本地运行时 (开源免费)
└── 用户可以自由选择是否用 Agent Me

类比：
- OpenClaw = 电脑 (你自己买的硬件)
- Agent Me = 远程桌面软件 (方便你在手机控制电脑)
- 你可以不用远程软件，但用了更方便

好处：
- OpenClaw 保持开源中立
- Agent Me 作为商业产品独立运营
- 用户无 vendor lock-in
```

---

## 四、技术实现要点

### 4.1 长期连接的关键技术

```yaml
WebSocket 常连接:
    - 心跳机制 (每 30 秒 ping/pong)
    - 自动重连 (断线后指数退避重试)
    - 连接状态管理 (在线/离线/连接中)

后台保活:
    Android:
        - 前台服务 (Foreground Service)
        - 通知栏常驻
        - Doze 模式处理
    iOS:
        - Background Mode (Audio/Voice)
        - PushKit (VoIP 推送)
        - 后台任务有限

状态同步:
    - 对话历史本地缓存 + 云端备份 (可选)
    - 任务状态实时同步
    - 配置双向同步

省电优化:
    - 连接空闲时降低心跳频率
    - 语音检测 (只在说话时激活)
    - 屏幕关闭时降低资源占用
```

### 4.2 与 OpenClaw 的协议

```typescript
// WebSocket 协议设计
interface AgentMeProtocol {
    // 连接握手
    handshake: {
        clientVersion: string;
        deviceId: string;
        authToken: string; // 可选的 Pro 版认证
    };

    // 上行：手机 → OpenClaw
    request: {
        type: 'voice' | 'text' | 'command';
        payload: string | AudioBuffer;
        timestamp: number;
        context?: string; // 上下文ID
    };

    // 下行：OpenClaw → 手机
    response: {
        type: 'text' | 'voice' | 'action' | 'status';
        payload: string | AudioBuffer | ActionPayload;
        timestamp: number;
        latency: number; // 处理耗时
    };

    // 状态推送
    status: {
        type: 'task_started' | 'task_completed' | 'notification';
        data: any;
    };
}

// 连接管理
class ConnectionManager {
    private ws: WebSocket;
    private reconnectAttempts = 0;
    private maxReconnectDelay = 30000; // 30s

    connect() {
        this.ws = new WebSocket('wss://user-openclaw.local:18789/ws');

        this.ws.onopen = () => {
            this.reconnectAttempts = 0;
            this.startHeartbeat();
        };

        this.ws.onclose = () => {
            this.scheduleReconnect();
        };

        this.ws.onmessage = (event) => {
            this.handleMessage(JSON.parse(event.data));
        };
    }

    private scheduleReconnect() {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
        setTimeout(() => this.connect(), delay);
        this.reconnectAttempts++;
    }
}
```

---

## 五、竞品对比

### 5.1 与现有方案对比

| 方案                             | 连接方式       | 体验        | 隐私   | 成本      |
| -------------------------------- | -------------- | ----------- | ------ | --------- |
| **远程桌面** (Parsec/TeamViewer) | 视频流         | 差 (延迟高) | 中     | 免费/付费 |
| **SSH + CLI**                    | 命令行         | 差 (不友好) | 好     | 免费      |
| **自建 Web 界面**                | HTTP           | 中          | 好     | 免费      |
| **Agent Me**                     | WebSocket 专线 | **好**      | **好** | 订阅费    |

### 5.2 差异化优势

```
Agent Me vs 远程桌面:
- 专为语音优化 (低延迟音频通道)
- 移动端原生体验 (不是桌面缩放)
- 后台保活 (不用一直开着屏幕)

Agent Me vs Web 界面:
- 系统级集成 (唤醒、通知)
- 离线缓存 (网络不好也能用)
- 硬件优化 (麦克风、蓝牙)
```

---

## 六、用户价值主张

### 6.1 一句话销售文案

```
"Agent Me 让你随时随地用语音与自己的 AI 对话。
你的 OpenClaw 不再被困在电脑里。"

或者：

"你的私人 AI，现在随时在线。
无论你在哪里，只需要说话。"
```

### 6.2 典型用户场景

```yaml
场景 1：通勤族
用户: 上班族，每天地铁通勤 1 小时
痛点: 无法使用电脑，想利用时间
使用: 戴耳机，语音和 OpenClaw 对话
价值: 通勤时间变成 productive time

场景 2：户外工作者
用户: 销售、工程师等经常在外
痛点: 不方便带电脑，需要查资料
使用: 手机语音查询知识库
价值: 随时随地获取信息

场景 3：家长
用户: 在家带孩子的家长
痛点: 手被占用，无法打字
使用: 语音让 Agent 记录、查询
价值: 解放双手，提高效率

场景 4：懒人
用户: 躺在床上不想动
痛点: 懒得开电脑，但想问问题
使用: 手机语音对话
价值: 舒适获取 AI 帮助
```

---

## 七、实施建议

### 7.1 MVP 验证

```yaml
Phase 1: 基础连接验证 (2 周)
  目标: 证明"长期连接"有价值

  功能:
    - WebSocket 连接 OpenClaw
    - 文字对话
    - 基础语音
    - 10 个种子用户测试

  指标:
    - 日活跃用户 > 5
    - 平均对话次数 > 3 次/天
    - 用户反馈积极

Phase 2: 体验优化 (2 周)
  目标: 打磨核心体验

  功能:
    - 集成 VibeVoice (高质量语音)
    - 后台保活
    - 通知推送

  指标:
    - 7 日留存 > 50%
    - 语音使用率 > 70%

Phase 3: 商业化验证 (2 周)
  目标: 证明付费意愿

  功能:
    - Pro 版功能
    - 支付集成
    - 定价测试

  指标:
    - 付费转化率 > 5%
```

### 7.2 关键成功因素

```
1. 连接稳定性
   - 99%+ 在线率
   - < 1s 重连时间

2. 语音质量
   - VibeVoice 集成到位
   - 延迟 < 500ms

3. 省电优化
   - 不显著影响电池
   - 用户可以长时间开启

4. 易用性
   - 安装配置简单
   - 一键连接
```

---

## 八、总结

### 8.1 一句话定位

> **Agent Me 是 OpenClaw 的移动专线，让用户随时随地与自己的本地 AI 保持语音对话。**

### 8.2 核心价值

```
对用户：
- 随时随地使用自己的 AI
- 隐私安全 (数据本地)
- 个性化体验

对商业模式：
- 订阅制可行 (Typeless 已验证)
- 技术壁垒 (连接优化)
- 可扩展 (多设备、团队版)
```

### 8.3 下一步行动

```
1. 开发 MVP (基础连接 + 语音)
2. 找 10 个种子用户验证
3. 迭代优化体验
4. 上线付费版本
```

---

## 参考

- [Typeless](https://typeless.ai/) - 订阅制 AI 助手参考
- [Agent Me 产品形态决策](./app-vs-obsidian-decision.md)
- [VibeVoice 技术文档](https://github.com/microsoft/VibeVoice)

---

_"连接的价值在于让强大的东西变得触手可及。"_
