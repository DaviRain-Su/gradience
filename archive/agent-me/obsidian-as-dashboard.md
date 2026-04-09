# Obsidian as Agent Me Dashboard：轻量级实现方案

> **核心洞察：不造轮子，用 Obsidian 作为 Agent Me 的监控面板 + 语音插件作为入口**
>
> 日期：2026-03-29

---

## 一、为什么 Obsidian 是完美的 Agent Me 底座

### 1.1 Obsidian 的核心优势

```yaml
本地优先 (Local-First):
    - 所有数据存储在用户本地
    - 纯文本 Markdown，用户完全控制
    - 无需云端，隐私最大化
    - 与 Gradience 理念完全一致

插件生态 (Plugin Ecosystem):
    - 强大的 API 支持
    - 社区活跃，数千插件
    - 开发门槛低 (TypeScript)
    - 热更新，无需重启

知识管理 (Knowledge Management):
    - 双向链接 [[ ]]
    - 图谱视图 (Graph View)
    - 标签系统 #tag
    - Mermaid 图表支持
    - 完美承载 AgentSoul.md

用户基础 (User Base):
    - 数百万知识工作者已使用
    - 高粘性用户群体
    - 付费意愿强 (Cult Following)
    - 不需要教育成本
```

### 1.2 与 Gradience 理念的契合

| Gradience 理念 | Obsidian 特性        | 契合度  |
| -------------- | -------------------- | ------- |
| Local-First    | 本地存储，无云端依赖 | ✅ 完美 |
| 数据主权       | 用户拥有所有文件     | ✅ 完美 |
| 可扩展性       | 插件系统             | ✅ 完美 |
| 开放格式       | Markdown 标准        | ✅ 完美 |
| 长期保存       | 纯文本，30年后仍可读 | ✅ 完美 |

---

## 二、架构设计：Obsidian + 语音插件 + OpenClaw

### 2.1 整体架构

```
用户设备
    │
    ├──▶ Obsidian (监控面板)
    │      │
    │      ├── 笔记视图 (AgentSoul.md)
    │      ├── 图谱视图 (Agent关系)
    │      ├── Dashboard 面板 (任务状态)
    │      └── 日志视图 (执行历史)
    │
    ├──▶ Agent Me 语音插件
    │      │
    │      ├── 语音采集 (WebRTC)
    │      ├── 语音转文字 (Whisper/STT)
    │      ├── WebSocket 客户端
    │      └── 语音播放 (TTS)
    │
    └──▶ OpenClaw (本地运行)
           │
           ├── Agent 大脑 (LLM)
           ├── Skill 执行
           ├── 工具调用
           └── 链上交互

连接流程：
1. 用户在 Obsidian 中点击 "语音对话" 按钮
2. 语音插件采集语音，转文字
3. 通过 WebSocket 发送到本地 OpenClaw
4. OpenClaw 处理，返回结果
5. 语音插件播放回复
6. Obsidian 笔记自动更新 (任务状态、日志等)
```

### 2.2 插件架构

```typescript
// Obsidian 插件结构
.
├── manifest.json          # 插件元数据
├── main.ts                # 入口
├── ui/
│   ├── VoiceWidget.tsx    # 语音控制浮窗
│   ├── DashboardView.tsx  # 监控面板
│   └── LogView.tsx        # 日志视图
├── core/
│   ├── VoiceManager.ts    # 语音管理 (STT/TTS)
│   ├── WSClient.ts        # WebSocket 客户端
│   ├── NoteSync.ts        # 笔记同步
│   └── CommandParser.ts   # 命令解析
└── styles.css             # 样式

// 核心功能
class AgentMePlugin extends Plugin {
  async onload() {
    // 1. 注册语音面板
    this.registerView(
      VIEW_TYPE_VOICE,
      (leaf) => new VoiceControlView(leaf, this)
    );

    // 2. 注册命令
    this.addCommand({
      id: 'toggle-voice',
      name: 'Toggle Voice Control',
      callback: () => this.toggleVoice()
    });

    // 3. 连接 OpenClaw
    this.wsClient = new WSClient('ws://localhost:18789/ws');

    // 4. 初始化语音
    this.voiceManager = new VoiceManager({
      stt: 'whisper-local',  // 或 'gemini-live'
      tts: 'edge-tts'        // 或系统 TTS
    });
  }
}
```

---

## 三、功能实现

### 3.1 语音控制浮窗

```typescript
// 悬浮在 Obsidian 界面的语音控制
class VoiceControlView extends ItemView {
  render() {
    return (
      <div className="agent-me-voice-widget">
        {/* 状态指示器 */}
        <div className={`status ${this.state}`}>
          {this.state === 'listening' && '● Listening...'}
          {this.state === 'thinking' && '◐ Thinking...'}
          {this.state === 'speaking' && '◐ Speaking...'}
          {this.state === 'idle' && '○ Click to speak'}
        </div>

        {/* 语音按钮 */}
        <button
          className="voice-btn"
          onClick={() => this.toggleListening()}
        >
          {this.isListening ? '🎙️' : '🎤'}
        </button>

        {/* 最近对话 */}
        <div className="recent-chats">
          {this.recentMessages.map(msg => (
            <div className={`message ${msg.role}`}>
              {msg.content.slice(0, 50)}...
            </div>
          ))}
        </div>

        {/* 快捷命令 */}
        <div className="quick-actions">
          <button onClick={() => this.sendCommand('pause')}>⏸️</button>
          <button onClick={() => this.sendCommand('status')}>📊</button>
          <button onClick={() => this.sendCommand('stop')}>⏹️</button>
        </div>
      </div>
    );
  }
}
```

### 3.2 Dashboard 面板（Obsidian 风格）

````markdown
# Agent Me Dashboard

## 当前状态

```dataviewjs
// 自动从 OpenClaw 获取状态
const status = await app.plugins.getPlugin('agent-me').getStatus();

// 渲染状态卡片
dv.table(
  ["指标", "数值"],
  [
    ["运行状态", status.running ? "🟢 运行中" : "🔴 停止"],
    ["当前任务", status.currentTask || "无"],
    ["今日完成", status.tasksCompletedToday],
    ["WebSocket", status.wsConnected ? "已连接" : "断开"],
    ["语音引擎", status.voiceEngine]
  ]
);
```
````

## 今日任务

```tasks
not done
path includes Tasks
```

## Agent 对话历史

```dataview
TABLE timestamp, role, content
FROM "Agent/Conversations"
SORT timestamp DESC
LIMIT 10
```

## 快捷操作

- [[Start Voice Chat|🎤 开始语音对话]]
- [[View All Tasks|📋 查看所有任务]]
- [[Agent Settings|⚙️ 设置]]

````

### 3.3 自动笔记同步

```typescript
// OpenClaw 执行结果自动写入 Obsidian
class NoteSync {
  async syncExecutionResult(result: ExecutionResult) {
    const fileName = `Agent/Executions/${result.timestamp}.md`;

    const content = `---
timestamp: ${result.timestamp}
task: ${result.taskName}
status: ${result.status}
duration: ${result.duration}ms
---

# ${result.taskName}

## 执行结果

${result.output}

## 决策日志

${result.decisions.map(d => `- ${d.timestamp}: ${d.reason}`).join('\n')}

## 相关链接

- [[AgentSoul|返回 AgentSoul]]
- [[Dashboard|查看 Dashboard]]
`;

    await this.app.vault.create(fileName, content);

    // 更新图谱
    await this.updateGraph(result);
  }
}
````

---

## 四、与纯 APP 方案的对比

### 4.1 开发成本对比

| 维度         | 自建 APP (React Native) | Obsidian 插件            |
| ------------ | ----------------------- | ------------------------ |
| **开发时间** | 3-6 个月                | 2-4 周                   |
| **代码量**   | 20K+ 行                 | 3K-5K 行                 |
| **团队规模** | 3-5 人                  | 1-2 人                   |
| **维护成本** | 高 (多平台适配)         | 低 (Obsidian 处理跨平台) |
| **UI 设计**  | 从零设计                | 复用 Obsidian 设计系统   |
| **知识管理** | 自建系统                | 复用 Obsidian 双链       |

### 4.2 用户体验对比

| 维度           | 自建 APP               | Obsidian 插件           |
| -------------- | ---------------------- | ----------------------- |
| **启动成本**   | 下载新 APP，学习界面   | 安装插件，已有熟悉环境  |
| **数据可见性** | 封闭在 APP 内          | 完全开放，Markdown 格式 |
| **扩展性**     | 依赖官方更新           | 与其他插件组合使用      |
| **长期保存**   | APP 可能停止维护       | 纯文本，永久可读        |
| **跨平台**     | 需单独开发 iOS/Android | Obsidian 已覆盖全平台   |

### 4.3 功能完整性对比

```
自建 APP 能做到但 Obsidian 插件做不到的：
❌ 原生后台运行（iOS 限制）
❌ 推送通知（需要单独实现）
❌ 硬件级优化（音频处理）

Obsidian 插件能做到但自建 APP 做不到的：
✅ 与知识库深度整合
✅ 双向链接和图谱
✅ 社区插件生态系统
✅ 无需审核发布
✅ 用户自定义主题

两者都能做到的（核心功能）：
✅ 语音采集和播放
✅ WebSocket 连接
✅ 状态监控面板
✅ 日志记录
```

---

## 五、实现路线图

### 5.1 MVP 版本（2周）

```yaml
Week 1:
    - Obsidian 插件框架搭建
    - WebSocket 客户端连接 OpenClaw
    - 基础语音按钮组件
    - 简单命令发送/接收

Week 2:
    - 语音转文字 (STT)
    - 文字转语音 (TTS)
    - 基础 Dashboard 视图
    - 笔记自动同步

Deliverable:
    - 可以在 Obsidian 中语音对话
    - 可以看到 OpenClaw 状态
    - 可以查看执行日志
```

### 5.2 完整版本（1个月）

```yaml
Week 3:
    - 语音流优化 (WebRTC)
    - 打断功能实现
    - Dashboard 数据可视化
    - 快捷命令面板

Week 4:
    - 与 AgentSoul.md 整合
    - 图谱视图展示 Agent 关系
    - 设置面板
    - 社区文档

Deliverable:
    - 生产可用的 Obsidian 插件
    - 发布到社区插件市场
    - 完整文档和示例
```

---

## 六、关键设计决策

### 6.1 语音引擎选择

```yaml
方案 A: 本地 Whisper (轻量)
  优点:
    - 完全本地，隐私最好
    - 无需网络
  缺点:
    - 质量一般
    - 延迟较高
  适合: MVP，隐私敏感用户

方案 B: Gemini Live API (质量)
  优点:
    - 质量最高
    - 延迟最低 (<1s)
    - 支持打断
  缺点:
    - 需要网络
    - 有 API 成本
  适合: 生产版本，追求体验

方案 C: 混合模式 (推荐)
  - 默认使用 Gemini Live
  - 离线时 fallback 到本地 Whisper
  - 用户可配置
```

### 6.2 数据存储策略

```yaml
Obsidian Vault 结构:
.
├── Agent/
│   ├── AgentSoul.md          # 核心配置
│   ├── Dashboard.md          # 监控面板
│   ├── Conversations/        # 对话历史
│   │   ├── 2026-03-29-001.md
│   │   └── 2026-03-29-002.md
│   ├── Executions/           # 执行记录
│   │   └── ...
│   └── Skills/               # 技能配置
│       └── ...
└── Tasks/                    # 任务管理
    └── ...

同步策略:
  - 所有数据存储在 Obsidian Vault 中
  - 纯 Markdown，用户完全控制
  - 可选同步到 Git/云存储
  - OpenClaw 只读取配置，不存储数据
```

### 6.3 与 OpenClaw 的边界

```
Obsidian 插件负责:
  - UI 展示
  - 语音采集/播放
  - 笔记管理
  - WebSocket 客户端

OpenClaw 负责:
  - LLM 推理
  - Skill 执行
  - 工具调用
  - 链上交互

明确边界的好处:
  - 插件保持轻量
  - OpenClaw 可独立升级
  - 用户可以选择其他前端
```

---

## 七、商业模式思考

### 7.1 免费 + 增值服务

```yaml
免费版 (Obsidian 插件):
    - 基础语音对话
    - 基础 Dashboard
    - 本地 Whisper
    - 社区支持

付费版 (Pro 订阅):
    - Gemini Live API 集成
    - 高级 Dashboard 视图
    - 云同步备份
    - 优先技术支持

企业版:
    - 私有化部署
    - 定制开发
    - SLA 保障
```

### 7.2 与 Obsidian 的关系

```
策略：成为 Obsidian 生态的核心插件

- 参与社区，建立声誉
- 与其他插件开发者合作
- 成为 Obsidian 官方推荐插件
- 推动 Obsidian 向 Agent-Native 演进

长期价值:
  - Obsidian 用户 = Agent Me 潜在用户
  - 数百万用户基础
  - 无需自建用户获取渠道
```

---

## 八、总结

### 8.1 核心优势

```
Obsidian + 语音插件方案：

✅ 开发快: 2-4 周 vs 3-6 个月
✅ 成本低: 1-2 人 vs 3-5 人团队
✅ 体验好: 用户已有熟悉环境
✅ 扩展强: 复用 Obsidian 生态
✅ 理念合: 本地优先，数据主权
```

### 8.2 风险评估

```
风险:
  ⚠️ Obsidian 可能改变插件政策
  ⚠️ 依赖第三方平台
  ⚠️ 无法实现原生后台运行

缓解:
  - 保持 OpenClaw 独立
  - 插件代码开源，可迁移
  - 未来可开发原生 APP 作为备选
```

### 8.3 一句话定位

> **Agent Me = Obsidian 插件（监控面板）+ 语音入口 + 本地 OpenClaw**
>
> 利用 Obsidian 的本地优先特性和强大生态，以最小开发成本实现 Agent-Native 的用户体验。

---

## 参考文档

- [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Agent Me 定位澄清](../agent-me/agent-me-positioning-clarified.md)
- [双重视角产品设计](./dual-perspective-product-design.md)

---

_"不造轮子，站在巨人肩膀上。Obsidian 是完美的 Agent Me 底座。"_
