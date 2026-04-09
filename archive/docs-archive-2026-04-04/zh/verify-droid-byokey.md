# 验证 Droid 是否通过 BYOKEY 代理

## 🔍 验证方法

### 方法 1: 查看 BYOKEY 日志 (最简单)

```bash
# 1. 确保 BYOKEY 在前台运行 (能看到日志)
byokey serve --port 8018

# 2. 在另一个终端使用 Droid
export OPENAI_BASE_URL=http://localhost:8018/v1
export OPENAI_API_KEY=byokey

droid "说Hello"

# 3. 检查 BYOKEY 终端输出
# 应该看到类似:
# [INFO] POST /v1/chat/completions
# [INFO] Request body: {...}
# [INFO] Provider: claude
# [INFO] Model: claude-opus-4
```

**✅ 如果能看到请求日志 = 代理成功**
**❌ 如果没有日志 = Droid 直连，没走代理**

---

### 方法 2: 抓包验证

```bash
# 安装 tcpdump (macOS)
brew install tcpdump

# 监控 8018 端口
sudo tcpdump -i lo0 port 8018 -n

# 然后使用 Droid，应该看到流量
```

或者用 `lsof`:

```bash
# 查看哪些进程连接了 8018
lsof -i :8018

# 应该看到 droid 进程
```

---

### 方法 3: 网络监控工具

```bash
# 使用 nettop (macOS 自带)
nettop -P -k state,interface -d

# 查找 droid 进程的网络连接
# 应该看到连接到 localhost:8018
```

---

### 方法 4: 代理测试端点

```bash
# 创建测试脚本
cat > test-proxy.sh << 'EOF'
#!/bin/bash

echo "🔍 测试 Droid 代理配置..."

# 检查环境变量
echo ""
echo "环境变量:"
echo "OPENAI_BASE_URL: ${OPENAI_BASE_URL:-未设置 ❌}"
echo "OPENAI_API_KEY: ${OPENAI_API_KEY:-未设置 ❌}"

# 检查 BYOKEY 是否运行
echo ""
echo "检查 BYOKEY:"
if curl -s http://localhost:8018/v1/models > /dev/null; then
    echo "✅ BYOKEY 运行在 localhost:8018"

    # 获取可用模型
    echo ""
    echo "可用模型:"
    curl -s http://localhost:8018/v1/models | grep -o '"id": "[^"]*"' | head -5
else
    echo "❌ BYOKEY 未运行"
    echo "请先运行: byokey serve --port 8018"
    exit 1
fi

# 测试 Droid
echo ""
echo "测试 Droid 连接:"
echo "发送测试请求..."

# 直接测试 API
curl -s http://localhost:8018/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4",
    "messages": [{"role": "user", "content": "Hi"}],
    "max_tokens": 10
  }' | head -c 200

echo ""
echo ""
echo "✅ 测试完成"
EOF

chmod +x test-proxy.sh
./test-proxy.sh
```

---

### 方法 5: Droid 调试模式

```bash
# 启用 Droid 详细日志
droid --verbose "Hello"

# 或者设置调试环境变量
DEBUG=* droid "Hello"

# 查看输出中的请求 URL
# 应该显示 http://localhost:8018/v1/chat/completions
# 而不是 https://api.anthropic.com
```

---

## 🚨 常见问题排查

### 问题 1: Droid 仍然直连 Anthropic

**症状**: BYOKEY 没有收到任何请求

**原因**: 环境变量未生效，或 Droid 配置覆盖了环境变量

**解决**:

```bash
# 1. 确认环境变量已设置
echo $OPENAI_BASE_URL  # 应该输出 http://localhost:8018/v1

# 2. 临时禁用 Droid 配置文件
mv ~/.droid/config.json ~/.droid/config.json.bak

# 3. 重新运行
droid "Hello"
```

---

### 问题 2: 请求到 BYOKEY 但报错

**症状**: BYOKEY 收到请求但返回错误

**查看详细日志**:

```bash
# 带调试启动 BYOKEY
RUST_LOG=debug byokey serve --port 8018

# 或使用 verbose 模式
byokey serve --port 8018 -v
```

**常见错误**:

- `401 Unauthorized`: Token 过期，重新 `byokey login claude`
- `404 Model not found`: 模型名称错误，检查可用模型列表
- `429 Rate Limited`: 订阅额度用完

---

### 问题 3: 部分请求走代理，部分不走

**原因**: Droid 可能使用不同的 provider 配置

**检查**:

```bash
# 查看 Droid 完整配置
droid config --show

# 检查是否有多个 provider 配置
# 确保 anthropic 和 openai 都指向 localhost:8018
```

---

## ✅ 验证清单

运行以下命令验证:

```bash
# 1. 环境变量检查
printenv | grep -E "OPENAI|ANTHROPIC"

# 期望输出:
# OPENAI_BASE_URL=http://localhost:8018/v1
# OPENAI_API_KEY=anything
# ANTHROPIC_BASE_URL=http://localhost:8018/v1
# ANTHROPIC_API_KEY=anything

# 2. BYOKEY 运行检查
curl http://localhost:8018/health
# 期望: {"status":"ok"}

# 3. 直接 API 测试
curl http://localhost:8018/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-opus-4","messages":[{"role":"user","content":"Hi"}]}'

# 期望: 返回 JSON 响应

# 4. Droid 测试
droid "Say hi in one word" --verbose 2>&1 | grep -E "localhost|api.anthropic|api.openai"

# 期望: 包含 "localhost:8018"
# 不应该包含 "api.anthropic.com" 或 "api.openai.com"
```

---

## 🔬 深度验证: 修改 BYOKEY 响应

如果你想 100% 确认，可以修改 BYOKEY 返回特殊响应:

```bash
# 1. 创建一个假的 BYOKEY 端点测试
python3 << 'EOF'
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

class TestHandler(BaseHTTPRequestHandler):
    def do_post(self):
        print(f"\n🎉 收到请求: {self.path}")
        print(f"Headers: {dict(self.headers)}")

        content_length = int(self.headers['Content-Length'])
        body = self.rfile.read(content_length)
        print(f"Body: {body.decode()[:200]}")

        # 返回测试响应
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()

        response = {
            "id": "test-123",
            "object": "chat.completion",
            "model": "test-model",
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": "✅ PROXY WORKING! Droid is using BYOKEY."
                }
            }]
        }
        self.wfile.write(json.dumps(response).encode())

print("🧪 启动测试服务器在 localhost:9999")
HTTPServer(('localhost', 9999), TestHandler).serve_forever()
EOF

# 2. 让 Droid 连接测试服务器
export OPENAI_BASE_URL=http://localhost:9999/v1

droid "Hello"

# 如果看到 "PROXY WORKING" = 配置正确！
```

---

## 📊 实时监控

```bash
# 使用 watch 持续监控 BYOKEY 日志
tail -f ~/.byokey/server.log | grep -E "POST|GET|Provider|Model"

# 然后在另一个终端使用 Droid
# 应该实时看到请求进来
```

---

**现在运行这些命令，我帮你分析输出结果！** 🔥
