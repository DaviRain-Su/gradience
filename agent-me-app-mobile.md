# Agent Me App：手机端语音助手架构设计

> **用户愿景**：手机端运行语音模型，通过语音长连接与 OpenClaw 实时交互，替代 Telegram 文字
> 
> **分析日期**: 2026-03-28

---

## 1. 直接回答：手机能跑语音模型吗？

### 现实评估

| 模型 | 参数 | 手机端 | 体验 |
|------|------|--------|------|
| **Cohere Transcribe** | 2B | ❌ 不行 | 需要 8GB+ RAM |
| **Whisper Large** | 1.5B | ❌ 不行 | 太慢 |
| **Whisper Base** | 74M | ⚠️ 勉强 | 3-5秒延迟 |
| **Whisper Tiny** | 39M | ✅ 可以 | 1-2秒延迟 |
| **SenseVoice Small** | 200M | ✅ 可以 | 中文优化好 |

### 结论

> 手机上**直接跑大模型不行**，但可以跑**小模型做预处理**，复杂理解上云

---

## 2. 推荐架构：端云协同

```
┌─────────────────────────────────────────────────────────────────┐
│                        手机端 (iOS/Android)                      │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  语音输入     │ → │  端侧小模型   │ → │  意图判断     │       │
│  │  (录音)      │    │  (Tiny/ONNX) │    │  (本地处理)   │       │
│  └──────────────┘    └──────────────┘    └──────┬───────┘       │
│                                                  │               │
│                     ┌────────────────────────────┼───────────┐   │
│                     │                            │           │   │
│                     ▼                            ▼           ▼   │
│              ┌──────────┐              ┌──────────────────┐  │   │
│              │ 简单指令  │              │  复杂对话/链上操作 │  │   │
│              │ (本地处理)│              │  (上传云端)       │  │   │
│              └────┬─────┘              └────────┬─────────┘  │   │
│                   │                              │            │   │
│              ┌────▼─────┐                   ┌────▼─────┐      │   │
│              │ 即时反馈  │                   │ WebSocket │      │   │
│              │ (0.5秒)  │                   │ 长连接    │      │   │
│              └──────────┘                   └────┬─────┘      │   │
│                                                  │            │   │
└──────────────────────────────────────────────────┼────────────┼───┘
                                                   │            │
                                                   ▼            ▼
┌──────────────────────────────────────────────────────────────────┐
│                      云端 (OpenClaw Gateway)                      │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │                    语音处理层                            │     │
│  │  ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │     │
│  │  │ 音频接收     │ → │ Cohere 2B    │ → │ 文本理解   │ │     │
│  │  │ (WebSocket)  │    │ (GPU 加速)   │    │           │ │     │
│  │  └──────────────┘    └──────────────┘    └─────┬─────┘ │     │
│  └────────────────────────────────────────────────┼────────┘     │
│                                                   │               │
│  ┌────────────────────────────────────────────────┼────────┐     │
│  │                    AI 大脑层 (Kimi/Claude)        │        │     │
│  │                                                ▼        │     │
│  │  ┌───────────────────────────────────────────────────┐  │     │
│  │  │ 意图理解 → 任务规划 → 链上操作 → 生成回复         │  │     │
│  │  └──────────────────────┬────────────────────────────┘  │     │
│  └─────────────────────────┼───────────────────────────────┘     │
│                            │                                     │
│  ┌─────────────────────────▼───────────────────────────────┐     │
│  │                    回复层                                │     │
│  │  文字回复 ◄── TTS语音合成 (可选) ◄── 操作结果            │     │
│  └─────────────────────────┬───────────────────────────────┘     │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   传回手机端     │
                    │  (语音/文字/UI) │
                    └─────────────────┘
```

---

## 3. 手机端技术实现

### 3.1 端侧小模型选择

#### 方案 A: Whisper.cpp (推荐)

```cpp
// 使用 Whisper.cpp 的 Core ML / NNAPI 版本
// iOS/Android 原生加速

whisper_context* ctx = whisper_init_from_file("tiny.bin");

// iOS: Core ML 加速
whisper_ctx_init_coreml(ctx, "tiny-encoder.mlmodelc");

// Android: NNAPI / GPU 加速
whisper_ctx_init_nnapi(ctx);
```

**性能** (iPhone 15 Pro):
- Tiny 模型: **实时转录** (RTF < 0.3)
- Base 模型: **1-2秒延迟** (RTF < 1.0)

#### 方案 B: SenseVoice (中文优化)

```python
# 阿里巴巴开源，中文 ASR 效果好
# 支持 ONNX Runtime Mobile

from funasr import AutoModel

model = AutoModel(
    model="iic/SenseVoiceSmall",  # 200M，手机可跑
    vad_model="iic/speech_fsmn_vad_zh-cn-16k-common-pytorch",
)

result = model.generate(
    input=audio_array,
    language="zh",  # 中文
)
```

### 3.2 React Native 实现

```typescript
// App.tsx - 核心架构
import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { RNWhisper } from 'react-native-whisper';
import { WebSocket } from 'ws';

export default function AgentMeApp() {
  const whisper = useRef<RNWhisper>(null);
  const ws = useRef<WebSocket>(null);
  const isListening = useRef(false);

  useEffect(() => {
    // 1. 初始化本地 Whisper (Tiny 模型)
    initLocalWhisper();
    
    // 2. 连接 OpenClaw Gateway
    connectToCloud();
    
    return () => {
      ws.current?.close();
    };
  }, []);

  const initLocalWhisper = async () => {
    // 下载 Tiny 模型 (约 40MB)
    await RNWhisper.downloadModel('tiny', {
      onProgress: (p) => console.log(`下载: ${p}%`),
    });
    
    whisper.current = await RNWhisper.initContext({
      model: 'tiny',
      useCoreML: true,  // iOS 加速
      useGPU: true,     // Android 加速
    });
  };

  const connectToCloud = () => {
    // WebSocket 长连接
    ws.current = new WebSocket('wss://openclaw.your-domain.com/voice');
    
    ws.current.onopen = () => {
      console.log('✅ 连接到 OpenClaw');
    };
    
    ws.current.onmessage = (event) => {
      const response = JSON.parse(event.data);
      handleCloudResponse(response);
    };
  };

  const startListening = async () => {
    isListening.current = true;
    
    // 开始录音
    await whisper.current?.startRealtimeTranscribe({
      language: 'zh',
      onResult: (result) => {
        // 本地识别结果
        console.log('本地:', result.text);
        
        // 判断意图复杂度
        if (isSimpleCommand(result.text)) {
          // 简单指令本地处理
          handleLocalCommand(result.text);
        } else {
          // 复杂对话上传云端
          uploadToCloud(result.audioData, result.text);
        }
      },
      onEndpoint: (result) => {
        // 一句话结束，发送完整音频到云端
        if (isListening.current) {
          uploadToCloud(result.audioData, result.text);
        }
      },
    });
  };

  const uploadToCloud = (audioData: ArrayBuffer, localText: string) => {
    // 发送音频到云端 (Cohere 2B 处理)
    ws.current?.send(JSON.stringify({
      type: 'voice',
      audio: arrayBufferToBase64(audioData),
      localText,  // 作为参考
      timestamp: Date.now(),
    }));
  };

  const handleCloudResponse = (response: CloudResponse) => {
    // 播放语音回复
    if (response.voiceUrl) {
      playAudio(response.voiceUrl);
    }
    
    // 显示文字
    if (response.text) {
      showBubble(response.text, 'agent');
    }
    
    // 更新 UI 组件
    if (response.uiUpdate) {
      updateComponent(response.uiUpdate);
    }
  };

  return (
    <View style={styles.container}>
      {/* 语音按钮 */}
      <TouchableOpacity 
        style={styles.voiceButton}
        onPressIn={startListening}
        onPressOut={() => isListening.current = false}
      >
        <Text>🎤 按住说话</Text>
      </TouchableOpacity>
      
      {/* 聊天记录 */}
      <ChatHistory />
      
      {/* 链上状态组件 */}
      <WalletCard />
      <TaskList />
    </View>
  );
}
```

---

## 4. 与 OpenClaw 的连接协议

### 4.1 WebSocket 协议设计

```typescript
// 协议定义
interface VoiceProtocol {
  // 客户端 → 服务端
  'voice.upload': {
    type: 'voice.upload';
    sessionId: string;
    audio: string;        // base64 encoded
    localText?: string;   // 本地识别结果（参考）
    timestamp: number;
  };
  
  'voice.interrupt': {
    type: 'voice.interrupt';
    sessionId: string;
    // 用户打断，停止生成
  };
  
  // 服务端 → 客户端
  'voice.transcript': {
    type: 'voice.transcript';
    text: string;         // Cohere 识别的最终文本
    confidence: number;
  };
  
  'voice.response': {
    type: 'voice.response';
    text: string;         // AI 回复文字
    voiceUrl?: string;    // TTS 语音 URL
    actions?: AgentAction[];  // 链上操作
  };
  
  'voice.uiUpdate': {
    type: 'voice.uiUpdate';
    component: string;    // 'wallet' | 'tasks' | 'market'
    data: any;
  };
}
```

### 4.2 云端处理流程 (OpenClaw)

```typescript
// server/voice-handler.ts
export class VoiceSession {
  private ws: WebSocket;
  private cohere: CohereTranscribe;
  private kimi: KimiClient;
  
  async handleVoiceUpload(data: VoiceUpload) {
    // 1. Cohere 2B 精确识别
    const audioBuffer = Buffer.from(data.audio, 'base64');
    const transcript = await this.cohere.transcribe(audioBuffer, 'zh');
    
    // 2. 发送识别结果给客户端
    this.send({
      type: 'voice.transcript',
      text: transcript,
      confidence: 0.95,
    });
    
    // 3. Kimi 理解意图
    const context = await this.getUserContext();
    const response = await this.kimi.chat({
      messages: [
        { role: 'system', content: getAgentMePrompt(context) },
        { role: 'user', content: transcript },
      ],
    });
    
    // 4. 解析回复
    const parsed = this.parseResponse(response);
    
    // 5. 执行链上操作 (如果有)
    if (parsed.actions) {
      for (const action of parsed.actions) {
        await this.executeAction(action);
      }
    }
    
    // 6. TTS 合成语音 (可选)
    let voiceUrl: string | undefined;
    if (parsed.shouldSpeak) {
      voiceUrl = await this.synthesizeVoice(parsed.reply);
    }
    
    // 7. 发送完整回复
    this.send({
      type: 'voice.response',
      text: parsed.reply,
      voiceUrl,
      actions: parsed.actions,
    });
    
    // 8. 更新 UI
    if (parsed.uiUpdate) {
      this.send({
        type: 'voice.uiUpdate',
        ...parsed.uiUpdate,
      });
    }
  }
}
```

---

## 5. 用户体验流程

### 场景 1: 简单查询 (本地处理)

```
用户按住手机: "看看我的钱包"
                ↓
        手机端 Whisper Tiny (本地)
                ↓
        识别: "看看我的钱包"
                ↓
        判断: 简单指令 (查询本地缓存)
                ↓
        显示: 钱包余额 (0.5秒)
                ↓
        语音: "你的钱包有 12.5 SOL"
```

**体验**: 秒回，无需联网

### 场景 2: 复杂操作 (云端处理)

```
用户按住手机: "帮我发布一个任务，审核这个合约"
                ↓
        手机端 Whisper Tiny (本地预识别)
                ↓
        上传音频到云端
                ↓
        Cohere 2B 精确识别
                ↓
        Kimi 理解 + 规划
                ↓
        询问确认: "建议奖励 0.1 SOL，限时24小时，可以吗？"
                ↓
        用户: "可以"
                ↓
        执行链上交易
                ↓
        回复: "已发布！任务 ID #12834"
                ↓
        UI 更新: 显示新任务卡片
```

**体验**: 2-3秒，像和真人对话

### 场景 3: 24小时陪伴

```
用户: (凌晨3点醒来) "看看有没有新任务"
                ↓
        我: (秒回) "有一个高优先级任务，NFT 分析，奖励 2 SOL"
                ↓
用户: "接"
                ↓
        我: "已接单。预计 2 小时完成。你可以继续睡，我帮你盯着。"
```

---

## 6. 技术栈总结

| 层级 | 技术 | 说明 |
|------|------|------|
| **手机端** | React Native / Flutter | 跨平台 |
| **端侧 ASR** | Whisper.cpp (Tiny) | 40MB，本地运行 |
| **连接** | WebSocket | 长连接，低延迟 |
| **云端 ASR** | Cohere 2B / Whisper Large | 精确识别 |
| **AI 大脑** | Kimi / Claude | 理解 + 规划 |
| **TTS** | Edge TTS / ElevenLabs | 语音合成 |
| **区块链** | Solana Agent Kit | 链上操作 |

---

## 7. 实现路线图

### Week 1: 原型验证

```bash
目标: 证明手机端 + 云端可行

[手机端]
- React Native 录音
- Whisper Tiny 本地识别
- WebSocket 连接

[云端]
- WebSocket 服务器
- Cohere 识别
- Kimi 回复

[体验]
- 按住说话 → 文字回复
- 延迟 < 3秒
```

### Week 2-3: 完整功能

```bash
目标: 可用版本

新增:
- TTS 语音回复
- 链上钱包集成
- 基础 UI 组件
- 本地缓存
```

### Week 4: 优化

```bash
目标: 流畅体验

优化:
- 端侧意图判断
- 本地简单指令
- 离线模式
- 电量优化
```

---

## 8. 总结

### 核心方案

> **端云协同：小模型本地预处理 + 大模型云端精确处理**

**手机上跑什么**:
- Whisper Tiny (39M) — 本地识别，秒回简单指令
- 意图判断逻辑 — 决定本地上传云端

**云端跑什么**:
- Cohere 2B — 精确识别
- Kimi — 理解 + 规划
- 区块链交互

### 对比 Telegram

| 特性 | Telegram 文字 | Agent Me App |
|------|--------------|--------------|
| **交互方式** | 打字 | 语音 (自然) |
| **响应速度** | 取决于打字 | 秒回 |
| **24小时陪伴** | 被动等待 | 主动推送 |
| **链上操作** | 复杂 | 语音一句话 |
| **体验** | 聊天工具 | 数字分身 |

### 下一步

1. **我搭建 WebSocket 语音服务** (用 Cohere 2B)
2. **你开发 React Native App 原型** (Whisper Tiny)
3. **测试端到端流程**

要我：
- 搭建云端语音服务？
- 提供 React Native 启动模板？
- 设计更详细的 UI 原型？

❤️‍🔥