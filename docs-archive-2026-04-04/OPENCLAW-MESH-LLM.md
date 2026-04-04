# Openclaw + Mesh-LLM 集成方案

## 🎯 用户场景

```
用户电脑（本地运行）
    ├─ Openclaw CLI（用户自己的工具）
    ├─ 可选：Mesh-LLM Worker（贡献算力）
    └─ 可选：本地模型缓存
         ↓
    连接远程 Mesh-LLM 网络
         ↓
    使用分布式 LLM 推理
```

**关键点**：
- ✅ 用户本地运行 Openclaw
- ✅ 不需要改 Openclaw 服务器（没有服务器！）
- ✅ 用户可以选择加入 Mesh-LLM 网络
- ✅ 无 Token 也能用大模型

---

## 🔧 两种集成模式

### 模式 A：Openclaw 作为 Mesh-LLM 客户端

**用户没有 GPU，只想使用网络**

```yaml
# ~/.openclaw/config.yaml
models:
  # 商业 API（用户有 Token 时用）
  openai:
    api_key: ${OPENAI_API_KEY}
    
  # Mesh-LLM 网络（无 Token 时用）
  mesh:
    enabled: true
    coordinator: "wss://mesh.clawsuite.com:9338"
    # 或社区协调器
    # coordinator: "wss://public-mesh.mesh-llm.org:9338"
    
    # 自动选择可用模型
    auto_select: true
    preferred_models:
      - llama-3.1-70b
      - qwen2.5-72b
      - mixtral-8x22b
```

**使用方式**：
```bash
# 用户有 OpenAI Token → 使用 GPT-4
openclaw chat --model gpt-4 "Hello"

# 用户无 Token → 自动使用 Mesh-LLM
openclaw chat --model llama-3.1-70b "Hello"
# 或
openclaw chat --provider mesh "Hello"
```

---

### 模式 B：Openclaw + Mesh-LLM Worker（贡献算力）

**用户有 GPU，想贡献算力换取免费使用**

```yaml
# ~/.openclaw/config.yaml
mesh_worker:
  enabled: true
  coordinator: "wss://mesh.clawsuite.com:9338"
  
  # 贡献的资源
  gpu: 0                    # GPU 设备号
  vram: "16GB"             # 可用显存
  models:                  # 愿意托管的模型
    - llama-3.1-70b-q4
    - qwen2.5-72b-q4
  
  # 收益设置
  rewards:
    wallet: "0x..."        # 接收代币的钱包
    share_ratio: 0.8       # 80% 收益给用户，20% 给网络
```

**启动方式**：
```bash
# 启动 Openclaw，同时作为 Mesh-LLM 节点
openclaw daemon --mesh-worker

# 或单独启动 Worker
openclaw mesh start

# 查看贡献状态
openclaw mesh status
# 输出：
# Node ID: node-abc123
# Status: Online
# VRAM Provided: 16GB
# Models Hosted: llama-3.1-70b-q4
# Credits Earned: 245.5
# Network Rank: #42
```

---

## 📦 具体实现方案

### 方案 1：Openclaw 内置 Mesh-LLM 客户端

**优点**：最简单，不改用户习惯
**缺点**：Openclaw 需要新增代码

```rust
// openclaw/src/llm/mod.rs

pub enum LLMProvider {
    OpenAI(OpenAIConfig),
    Anthropic(AnthropicConfig),
    Mesh(MeshConfig),  // 新增
}

pub struct MeshConfig {
    pub coordinator_url: String,
    pub node_id: Option<String>,
}

impl LLMProvider for MeshConfig {
    async fn chat(&self, req: ChatRequest) -> Result<ChatResponse> {
        // 连接 Mesh-LLM 协调器
        let client = MeshClient::connect(&self.coordinator_url).await?;
        
        // 发现可用节点
        let nodes = client.discover_nodes().await?;
        
        // 路由请求
        let response = client.route_chat(req, nodes).await?;
        
        Ok(response)
    }
}
```

### 方案 2：Mesh-LLM 作为独立 Sidecar

**优点**：Openclaw 不需要改代码，通过标准 API 调用
**缺点**：用户需要运行两个进程

```bash
# 终端 1：启动 Mesh-LLM（作为客户端）
mesh-llm client \
  --coordinator "wss://mesh.clawsuite.com:9338" \
  --api-bind "localhost:9337"

# 终端 2：Openclaw 配置使用本地 API
openclaw config set llm.endpoint "http://localhost:9337/v1"
openclaw config set llm.model "llama-3.1-70b"

# 使用
openclaw chat "Hello"
```

### 方案 3：Openclaw Plugin 系统

**优点**：模块化，可选安装
**缺点**：需要设计 Plugin API

```bash
# 安装 Mesh-LLM 插件
openclaw plugin install mesh-llm

# 启用插件
openclaw plugin enable mesh-llm

# 配置
openclaw mesh config --coordinator "wss://mesh.clawsuite.com:9338"

# 使用
openclaw chat --via-mesh "Hello"
```

---

## 🚀 推荐方案：混合模式

```
Openclaw 新版本
    ├── 内置 Mesh-LLM 客户端支持（模式 A）
    └── 可选 Mesh-LLM Worker 命令（模式 B）
```

### 用户使用流程

**新用户（无 Token）**：
```bash
# 1. 安装 Openclaw
curl -fsSL https://openclaw.dev/install | sh

# 2. 配置使用 Mesh-LLM（无需 Token）
openclaw config set provider mesh
openclaw config set mesh.coordinator "wss://mesh.clawsuite.com:9338"

# 3. 直接使用
openclaw chat "帮我写一个 Python 函数"
# → 自动连接到 Mesh-LLM 网络
# → 使用社区提供的免费算力
```

**老用户（有 Token，想省钱）**：
```bash
# 配置 fallback
openclaw config set provider openai
openclaw config set fallback.enabled true
openclaw config set fallback.provider mesh

# 使用：优先 OpenAI，失败时自动切换
openclaw chat "复杂任务"  # 使用 GPT-4
openclaw chat "简单任务"  # 如果 OpenAI 额度用完，自动用 Mesh-LLM
```

**矿工用户（有 GPU，想赚取代币）**：
```bash
# 1. 配置 GPU
openclaw config set mesh.worker.enabled true
openclaw config set mesh.worker.gpu 0
openclaw config set mesh.worker.vram "24GB"

# 2. 下载模型
openclaw mesh download-model llama-3.1-70b-q4

# 3. 启动 Worker
openclaw mesh start

# 4. 查看收益
openclaw mesh earnings
# Total Earned: 1,245 MESH tokens
# This Week: 234 MESH tokens
# Network Contribution: 156 hours
```

---

## 🔌 技术实现细节

### 1. Openclaw 配置文件扩展

```yaml
# ~/.openclaw/config.yaml
version: "2.0"

# 原有配置
llm:
  default_provider: openai
  
  providers:
    openai:
      api_key: sk-xxx
      model: gpt-4
      
    # 新增 Mesh-LLM 配置
    mesh:
      enabled: true
      coordinator: "wss://mesh.clawsuite.com:9338"
      
      # 客户端设置（用户使用网络）
      client:
        auto_select_model: true
        preferred_models:
          - llama-3.1-70b
          - qwen2.5-72b
        timeout: 120s
        
      # Worker 设置（用户贡献算力）
      worker:
        enabled: false
        gpu: 0
        vram: "16GB"
        models:
          - llama-3.1-70b-q4
        rewards:
          wallet: "0x..."

# 路由策略
routing:
  priority:
    - openai      # 优先商业 API
    - mesh        # 其次 Mesh-LLM
  fallback_on_error: true
  fallback_on_quota: true
```

### 2. Openclaw 命令扩展

```bash
# 原有命令
openclaw chat
openclaw config

# 新增 Mesh-LLM 命令
openclaw mesh status              # 查看网络状态
openclaw mesh models              # 列出可用模型
openclaw mesh download <model>    # 下载模型到本地
openclaw mesh start               # 启动 Worker
openclaw mesh stop                # 停止 Worker
openclaw mesh earnings            # 查看收益
openclaw mesh leaderboard         # 查看贡献排行榜
```

### 3. 与现有代码集成

```rust
// src/commands/chat.rs

pub async fn chat(args: ChatArgs, config: Config) -> Result<()> {
    let provider = select_provider(&config, args.model)?;
    
    let response = match provider {
        Provider::OpenAI(cfg) => openai_chat(cfg, args).await,
        Provider::Anthropic(cfg) => anthropic_chat(cfg, args).await,
        Provider::Mesh(cfg) => mesh_chat(cfg, args).await,  // 新增
    }?;
    
    println!("{}", response);
    Ok(())
}

async fn mesh_chat(cfg: MeshConfig, args: ChatArgs) -> Result<String> {
    // 1. 连接协调器
    let client = MeshClient::connect(&cfg.coordinator).await?;
    
    // 2. 获取可用模型
    let models = client.list_models().await?;
    let model = select_best_model(models, args.model)?;
    
    // 3. 发送请求
    let request = ChatRequest {
        model,
        messages: args.messages,
        stream: args.stream,
    };
    
    let response = client.chat(request).await?;
    Ok(response.content)
}
```

---

## 💡 商业模式

### 用户使用 Mesh-LLM 的成本

```
完全免费（由算力提供者承担）
    ↓ 或 ↓
小额付费（加速包）
    - $5/月：优先队列
    - $20/月：专用节点
```

### 算力提供者收益

```
贡献 1 小时 3090 GPU
    ↓
获得 10 MESH 代币
    ↓
可兑换：
    - 其他算力服务
    - 现金（通过 DEX）
    - Openclaw Pro 订阅
```

---

## ⚠️ 风险和考虑

### 1. 隐私问题
- 用户输入会发送到其他用户的节点
- **解决方案**：端到端加密，或只发送给可信节点

### 2. 服务质量
- 依赖社区节点的稳定性
- **解决方案**：多节点冗余，自动切换

### 3. 法律合规
- 某些地区可能限制 P2P 网络
- **解决方案**：中心化协调器选项

---

## 🎯 下一步

### 阶段 1：验证可行性（1 周）
1. 部署公共 Mesh-LLM 协调器
2. 测试 Openclaw 连接
3. 验证延迟和质量

### 阶段 2：MVP 集成（2 周）
1. Openclaw 添加 Mesh-LLM 客户端支持
2. 实现基本聊天功能
3. 发布 Beta 版本

### 阶段 3：Worker 模式（1 月）
1. 实现 GPU 贡献功能
2. 设计代币经济
3. 启动激励计划

---

**总结**：Openclaw 不需要服务器！只需要在用户本地添加 Mesh-LLM 支持，让没有 Token 的用户也能用大模型，有 GPU 的用户还能赚取代币。你觉得这个方案可行吗？
