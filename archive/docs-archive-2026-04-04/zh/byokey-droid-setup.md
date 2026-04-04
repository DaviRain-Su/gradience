# BYOKEY + Factory Droid 配置指南

## 🎯 目标

让 Droid 通过 BYOKEY 使用你的 Claude Pro / OpenAI Plus 订阅

```
Droid CLI → BYOKEY (localhost:8018) → Claude Pro API
```

---

## 📋 前置要求

1. ✅ 已安装 Droid: `npm install -g @factoryai/droid`
2. ✅ 已安装 BYOKEY: `brew install AprilNEA/tap/byokey`
3. ✅ 已登录 Claude: `byokey login claude`

---

## 🚀 配置步骤

### Step 1: 启动 BYOKEY

```bash
# 启动服务
byokey serve --port 8018

# 验证运行
# 应该显示: Listening on http://127.0.0.1:8018
```

**保持这个终端运行**，或者使用后台模式：
```bash
byokey start
```

---

### Step 2: 配置 Droid

Droid 支持 OpenAI 兼容的 API，需要设置环境变量：

```bash
# 设置 Droid 使用 BYOKEY
export OPENAI_BASE_URL=http://localhost:8018/v1
export OPENAI_API_KEY=anything  # BYOKEY 会忽略这个值

# 如果使用 Anthropic 模型，也设置这个
export ANTHROPIC_BASE_URL=http://localhost:8018/v1
export ANTHROPIC_API_KEY=anything
```

---

### Step 3: 创建 Droid 配置文件

创建 `~/.droid/config.json`:

```json
{
  "providers": {
    "openai": {
      "baseUrl": "http://localhost:8018/v1",
      "apiKey": "dummy-key-byokey-ignores-this"
    },
    "anthropic": {
      "baseUrl": "http://localhost:8018/v1",
      "apiKey": "dummy-key-byokey-ignores-this"
    }
  },
  "defaultProvider": "anthropic",
  "defaultModel": "claude-opus-4"
}
```

**或者使用环境变量方式**（推荐）

创建 `~/.droid/.env`:

```bash
OPENAI_BASE_URL=http://localhost:8018/v1
OPENAI_API_KEY=byokey
ANTHROPIC_BASE_URL=http://localhost:8018/v1
ANTHROPIC_API_KEY=byokey
```

---

### Step 4: 测试 Droid

```bash
# 验证配置
droid config

# 应该显示 baseUrl 指向 localhost:8018

# 测试简单任务
droid "解释什么是区块链"

# 或者进入交互模式
droid

# 然后输入:
> 写一个 Python 函数计算斐波那契数列
```

---

## 🔧 高级配置

### 使用特定模型

```bash
# Droid 中指定模型
droid --model claude-opus-4 "写代码"
droid --model gpt-4 "写代码"
droid --model gemini-2.0-flash "写代码"
```

### 配置多个 Provider

```json
// ~/.droid/config.json
{
  "profiles": {
    "claude": {
      "provider": "anthropic",
      "baseUrl": "http://localhost:8018/v1",
      "model": "claude-opus-4"
    },
    "openai": {
      "provider": "openai",
      "baseUrl": "http://localhost:8018/v1",
      "model": "gpt-4"
    }
  }
}
```

使用：
```bash
droid --profile claude "任务描述"
```

---

## 📊 可用模型列表

配置完成后，Droid 可以通过 BYOKEY 使用：

| 模型 | 命令示例 |
|------|---------|
| Claude Opus 4 | `droid --model claude-opus-4 "task"` |
| Claude Sonnet 4.5 | `droid --model claude-sonnet-4-5 "task"` |
| GPT-4 | `droid --model gpt-4 "task"` |
| GPT-4o mini | `droid --model gpt-4o-mini "task"` |
| Gemini 2.0 Flash | `droid --model gemini-2.0-flash "task"` |

---

## 🐛 故障排除

### 问题 1: Droid 无法连接

```bash
# 检查 BYOKEY 是否运行
curl http://localhost:8018/v1/models

# 如果失败，重新启动
byokey stop
byokey serve --port 8018
```

### 问题 2: 认证失败

```bash
# 检查 BYOKEY 登录状态
byokey status

# 如果显示未登录
byokey login claude
```

### 问题 3: 模型不可用

```bash
# 查看 BYOKEY 支持的模型
curl http://localhost:8018/v1/models | jq

# 确保你登录的提供商支持该模型
# Claude Pro → claude-opus-4, claude-sonnet-4-5
# OpenAI Plus → gpt-4, gpt-4o
```

### 问题 4: Droid 报错 "Invalid API key"

这是正常的！BYOKEY 会忽略 API key，但 Droid 要求必须有。

确保设置了：
```bash
export OPENAI_API_KEY=dummy
```

---

## ⚡ 一键启动脚本

创建 `start-droid-with-byokey.sh`:

```bash
#!/bin/bash

echo "🚀 启动 BYOKEY + Droid..."

# 1. 检查 BYOKEY 状态
if ! curl -s http://localhost:8018/v1/models > /dev/null; then
    echo "🔑 启动 BYOKEY..."
    byokey start
    sleep 2
fi

# 2. 检查登录状态
if ! byokey status | grep -q "✓"; then
    echo "❗ 请先登录: byokey login claude"
    exit 1
fi

# 3. 设置 Droid 环境变量
export OPENAI_BASE_URL=http://localhost:8018/v1
export OPENAI_API_KEY=byokey
export ANTHROPIC_BASE_URL=http://localhost:8018/v1
export ANTHROPIC_API_KEY=byokey

echo "✅ BYOKEY 运行中"
echo "🤖 启动 Droid..."
echo ""

# 4. 启动 Droid
droid "$@"
```

使用：
```bash
chmod +x start-droid-with-byokey.sh
./start-droid-with-byokey.sh "你的任务"
```

---

## 🎯 日常使用流程

### 方式 1: 手动启动 (推荐)

**终端 1** (保持运行):
```bash
byokey serve
```

**终端 2** (使用 Droid):
```bash
export OPENAI_BASE_URL=http://localhost:8018/v1
export OPENAI_API_KEY=byokey

droid "写代码"
```

### 方式 2: 后台模式

```bash
# 启动 BYOKEY 后台服务
byokey start

# 配置 Droid 环境变量 (添加到 ~/.zshrc)
echo 'export OPENAI_BASE_URL=http://localhost:8018/v1' >> ~/.zshrc
echo 'export OPENAI_API_KEY=byokey' >> ~/.zshrc
source ~/.zshrc

# 直接使用
droid "任务"
```

---

## 💡 最佳实践

1. **开机自启**
   ```bash
   byokey autostart enable
   ```

2. **监控日志**
   ```bash
   tail -f ~/.byokey/server.log
   ```

3. **多模型切换**
   ```bash
   # 使用 Claude
   droid --model claude-opus-4 "复杂任务"
   
   # 使用 GPT-4
   droid --model gpt-4 "代码任务"
   
   # 使用 Gemini (更快)
   droid --model gemini-2.0-flash "简单任务"
   ```

4. **成本跟踪**
   ```bash
   # BYOKEY 不收费，但监控你的订阅使用
   # Claude Pro: 检查 https://console.anthropic.com/
   ```

---

**配置完成！现在 Droid 可以通过 BYOKEY 使用你的 Claude Pro 订阅了。** 🔥
