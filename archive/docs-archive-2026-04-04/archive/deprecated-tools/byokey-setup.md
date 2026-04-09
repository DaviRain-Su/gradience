# BYOKEY 启动指南

## 📋 项目介绍

**BYOKEY** = Bring Your Own Keys

将你的 AI 订阅（Claude Pro、OpenAI Plus、GitHub Copilot 等）转换为标准 API 端点，供各种工具使用。

```
Subscriptions          BYOKEY            Tools
───────────────────────────────────────────────────
Claude Pro  ──┐                         ├──  Amp Code
OpenAI Plus ──┼──  byokey serve  ──────┼──  Cursor
Copilot     ──┘                         ├──  Windsurf
                                        └──  任何 OpenAI/Anthropic 客户端
```

---

## 🚀 快速启动步骤

### 1. 安装

**选项 A: Homebrew (推荐)**

```bash
brew install AprilNEA/tap/byokey
```

**选项 B: Cargo**

```bash
cargo install byokey
```

**选项 C: 从源码编译**

```bash
git clone https://github.com/AprilNEA/BYOKEY
cd BYOKEY
cargo install --path .
```

---

### 2. 登录认证

```bash
# 登录 Claude (PKCE OAuth)
byokey login claude

# 登录 OpenAI Codex
byokey login codex

# 登录 GitHub Copilot
byokey login copilot

# 登录 Google Gemini
byokey login gemini

# 登录 AWS Kiro
byokey login kiro
```

**这会打开浏览器进行 OAuth 认证**，token 会保存在 `~/.byokey/tokens.db`

---

### 3. 启动服务

```bash
# 前台运行（推荐测试用）
byokey serve

# 或指定端口
byokey serve --port 8018

# 后台运行
byokey start

# 查看状态
byokey status
```

---

### 4. 配置工具使用

#### 对于 Amp Code

```bash
# 自动注入配置
byokey amp inject

# 或手动编辑 ~/.amp/settings.json
{
  "amp.url": "http://localhost:8018/amp"
}
```

#### 对于 Cursor

```bash
# 设置环境变量
export OPENAI_BASE_URL=http://localhost:8018/v1
export OPENAI_API_KEY=***  # 任意值，byokey 会忽略
```

#### 对于 Factory CLI (Droid)

```bash
export OPENAI_BASE_URL=http://localhost:8018/v1
export ANTHROPIC_BASE_URL=http://localhost:8018/v1
```

#### 通用 OpenAI 客户端

```python
import openai

client = openai.OpenAI(
    base_url="http://localhost:8018/v1",
    api_key="dummy"  # 会被忽略
)

response = client.chat.completions.create(
    model="claude-opus-4",  # 或 "gpt-4", "gemini-2.0-flash"
    messages=[{"role": "user", "content": "Hello!"}]
)
```

---

## ⚙️ 配置文件

创建 `~/.config/byokey/settings.yaml`:

```yaml
port: 8018
host: 127.0.0.1

providers:
    # 使用 API Key 而不是 OAuth
    claude:
        api_key: 'sk-ant-api03-...'

    # 禁用某个 provider
    gemini:
        enabled: false

    # 只使用 OAuth（需要提前 byokey login）
    codex:
        enabled: true
```

---

## 🔧 完整 CLI 命令

```bash
# 服务管理
byokey serve          # 前台启动
byokey start          # 后台启动
byokey stop           # 停止后台服务
byokey restart        # 重启
byokey autostart enable  # 开机自启

# 认证管理
byokey login <provider>     # 登录
byokey logout <provider>    # 登出
byokey status               # 查看状态
byokey accounts <provider>  # 查看账号列表
byokey switch <provider>    # 切换账号

# 其他
byokey openapi        # 导出 OpenAPI 规范
byokey completions    # 生成 shell 补全
```

---

## ✅ 验证安装

```bash
# 1. 检查版本
byokey --version

# 2. 查看登录状态
byokey status

# 3. 启动服务
byokey serve

# 4. 测试 API (另一个终端)
curl http://localhost:8018/v1/models

# 5. 测试聊天
curl http://localhost:8018/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## 🐛 常见问题

### 1. 端口被占用

```bash
# 使用其他端口
byokey serve --port 8080
```

### 2. Token 过期

```bash
# 重新登录
byokey logout claude
byokey login claude
```

### 3. 后台服务日志

```bash
# 查看日志
tail -f ~/.byokey/server.log
```

### 4. 数据库位置

```bash
# Token 存储在
~/.byokey/tokens.db

# 配置在
~/.config/byokey/settings.json
```

---

## 📝 支持的模型

| Provider    | 认证方式    | 模型                                   |
| ----------- | ----------- | -------------------------------------- |
| **Claude**  | PKCE        | opus-4-6, sonnet-4-5, haiku-4-5        |
| **Codex**   | PKCE        | o4-mini, o3                            |
| **Copilot** | Device code | gpt-5.x, claude-sonnet-4.x, gemini-3.x |
| **Gemini**  | PKCE        | 2.0-flash, 1.5-pro, 1.5-flash          |
| **Kiro**    | Device code | kiro-default                           |

---

## 🎯 使用场景

1. **省钱**: 用 Claude Pro 订阅替代 API 调用费用
2. **隐私**: 数据不经过第三方，直接到提供商
3. **统一**: 一个端点支持多个提供商
4. **本地**: 完全自托管，控制所有数据

---

## 🔗 相关链接

- GitHub: https://github.com/AprilNEA/BYOKEY
- Crates: https://crates.io/crates/byokey
- Amp Code: https://ampcode.com
- Factory: https://factory.ai

---

**需要我帮你安装或配置吗？** 🔥
