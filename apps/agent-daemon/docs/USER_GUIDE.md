# Agent Daemon 用户安装和启动指南

本文档介绍如何安装、配置和启动 Gradience Agent Daemon。

## 目录

1. [系统要求](#系统要求)
2. [安装步骤](#安装步骤)
3. [配置说明](#配置说明)
4. [启动 Daemon](#启动-daemon)
5. [验证安装](#验证安装)
6. [故障排除](#故障排除)

---

## 系统要求

### 必需依赖

| 依赖项  | 最低版本 | 说明                                 |
| ------- | -------- | ------------------------------------ |
| Node.js | 22.x     | 运行时环境                           |
| pnpm    | 9.x      | 包管理器 (本项目使用 pnpm workspace) |
| Git     | 2.x      | 克隆仓库                             |

### 可选依赖

| 依赖项                  | 说明                 |
| ----------------------- | -------------------- |
| Solana CLI              | 用于本地 Solana 开发 |
| Docker & Docker Compose | 用于容器化部署       |
| SQLite                  | 内置，无需单独安装   |

### 系统要求

- **操作系统**: macOS, Linux, Windows (WSL2)
- **内存**: 最少 512MB RAM，推荐 1GB+
- **磁盘**: 最少 500MB 可用空间
- **网络**: 需要互联网连接以连接 Chain Hub 和 Solana RPC

---

## 安装步骤

### 1. 克隆仓库

```bash
git clone <repository-url>
cd gradience-protocol
```

### 2. 安装依赖

```bash
# 安装项目根目录依赖
pnpm install

# 构建 agent-daemon 及其依赖
pnpm turbo run build --filter=@gradiences/agent-daemon...
```

### 3. 注册 Agent

在启动 Daemon 之前，需要先注册一个 master wallet：

```bash
cd apps/agent-daemon

# 注册 agent (替换 <MASTER_WALLET_PUBKEY> 为你的 Solana 钱包公钥)
npx tsx src/index.ts register --master-wallet <MASTER_WALLET_PUBKEY>
```

或者使用 pnpm:

```bash
pnpm dev register --master-wallet <MASTER_WALLET_PUBKEY>
```

这会在 `~/.agentd/` 目录下生成：

- `keypair` - Agent 的密钥对
- `config.json` - 配置文件

---

## 配置说明

### 配置文件位置

Daemon 会按以下顺序查找配置：

1. `./agentd.json` (当前工作目录)
2. `~/.agentd/config.json` (用户主目录)
3. 环境变量
4. 命令行参数

### 环境变量

所有配置项都可以通过环境变量设置，前缀为 `AGENTD_`：

#### 必需配置

| 环境变量      | 默认值      | 说明                                        |
| ------------- | ----------- | ------------------------------------------- |
| `AGENTD_PORT` | `7420`      | API 服务端口                                |
| `AGENTD_HOST` | `127.0.0.1` | 绑定地址 (生产环境 Docker 中设为 `0.0.0.0`) |

#### Chain Hub 连接

| 环境变量                    | 默认值                            | 说明                     |
| --------------------------- | --------------------------------- | ------------------------ |
| `AGENTD_CHAIN_HUB_URL`      | `wss://indexer.gradiences.xyz/ws` | Chain Hub WebSocket 地址 |
| `AGENTD_CHAIN_HUB_REST_URL` | `https://indexer.gradiences.xyz`  | Chain Hub REST API 地址  |

#### Solana 配置

| 环境变量                | 默认值                          | 说明            |
| ----------------------- | ------------------------------- | --------------- |
| `AGENTD_SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Solana RPC 端点 |

#### 存储配置

| 环境变量           | 默认值              | 说明                                |
| ------------------ | ------------------- | ----------------------------------- |
| `AGENTD_DB_PATH`   | `~/.agentd/data.db` | SQLite 数据库路径                   |
| `AGENTD_LOG_LEVEL` | `info`              | 日志级别 (debug, info, warn, error) |

#### A2A 通信配置

| 环境变量                   | 默认值  | 说明                           |
| -------------------------- | ------- | ------------------------------ |
| `AGENTD_A2A_ENABLED`       | `true`  | 启用 A2A 通信                  |
| `AGENTD_NOSTR_RELAYS`      | 见下方  | Nostr 中继服务器列表，逗号分隔 |
| `AGENTD_NOSTR_PRIVATE_KEY` | -       | Nostr 私钥 (可选)              |
| `AGENTD_XMTP_ENABLED`      | `false` | 启用 XMTP 通信                 |

默认 Nostr 中继:

- `wss://relay.damus.io`
- `wss://relay.nostr.band`
- `wss://nos.lol`
- `wss://relay.snort.social`

#### Evaluator 配置

| 环境变量                            | 默认值   | 说明                                  |
| ----------------------------------- | -------- | ------------------------------------- |
| `AGENTD_AUTO_JUDGE`                 | `true`   | 自动评估任务                          |
| `AGENTD_JUDGE_PROVIDER`             | `openai` | LLM 提供商 (openai, claude, moonshot) |
| `AGENTD_JUDGE_MODEL`                | `gpt-4`  | 评估模型                              |
| `AGENTD_JUDGE_CONFIDENCE_THRESHOLD` | `0.7`    | 置信度阈值 (0-1)                      |

#### LLM Provider API Keys

| 环境变量            | 说明                                   |
| ------------------- | -------------------------------------- |
| `OPENAI_API_KEY`    | OpenAI API 密钥                        |
| `OPENAI_BASE_URL`   | OpenAI 基础 URL (可选，用于自定义端点) |
| `ANTHROPIC_API_KEY` | Claude API 密钥                        |
| `MOONSHOT_API_KEY`  | Moonshot API 密钥                      |

#### 高级配置

| 环境变量                      | 默认值  | 说明                             |
| ----------------------------- | ------- | -------------------------------- |
| `AGENTD_MAX_AGENT_PROCESSES`  | `8`     | 最大 Agent 进程数                |
| `AGENTD_HEARTBEAT_INTERVAL`   | `30000` | 心跳间隔 (毫秒)                  |
| `AGENTD_ALLOW_ALL_INTERFACES` | -       | 允许绑定到 0.0.0.0 (Docker 需要) |

### 配置文件示例

创建 `~/.agentd/config.json`:

```json
{
    "port": 7420,
    "host": "127.0.0.1",
    "chainHubUrl": "wss://indexer.gradiences.xyz/ws",
    "solanaRpcUrl": "https://api.devnet.solana.com",
    "logLevel": "info",
    "a2aEnabled": true,
    "autoJudge": true,
    "judgeProvider": "openai",
    "judgeModel": "gpt-4"
}
```

---

## 启动 Daemon

### 开发模式

```bash
cd apps/agent-daemon

# 使用 tsx 直接运行 (热重载)
pnpm dev start

# 或者指定端口
pnpm dev start --port 8080

# 指定 Chain Hub
pnpm dev start --chain-hub-url wss://custom-hub.example.com/ws
```

### 生产模式

```bash
cd apps/agent-daemon

# 1. 构建
pnpm build

# 2. 启动
pnpm start

# 或者直接运行
node dist/src/index.js start
```

### Docker 部署

```bash
# 构建镜像
docker build -f docker/Dockerfile.agent-daemon -t gradience/agent-daemon .

# 运行容器
docker run -d \
  --name agent-daemon \
  -p 4001:4001 \
  -v agentd-data:/data \
  -e AGENTD_SOLANA_RPC_URL=https://api.devnet.solana.com \
  gradience/agent-daemon

# 或使用 docker-compose
docker compose -f deploy/docker-compose.prod.yml up agent-daemon -d
```

### 作为系统服务 (systemd)

创建 `/etc/systemd/system/agent-daemon.service`:

```ini
[Unit]
Description=Gradience Agent Daemon
After=network.target

[Service]
Type=simple
User=agentd
WorkingDirectory=/opt/gradience/apps/agent-daemon
ExecStart=/usr/bin/node dist/src/index.js start
Restart=always
RestartSec=5
Environment="NODE_ENV=production"
Environment="AGENTD_LOG_LEVEL=info"
Environment="AGENTD_PORT=7420"

[Install]
WantedBy=multi-user.target
```

启用并启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable agent-daemon
sudo systemctl start agent-daemon
```

---

## 验证安装

### 1. 检查 Daemon 状态

```bash
cd apps/agent-daemon

# 使用 CLI 查看状态
pnpm dev status

# 或直接用 API
curl http://localhost:7420/api/v1/status \
  -H "Authorization: Bearer $(cat ~/.agentd/auth-token)"
```

### 2. 健康检查端点

```bash
# 基础健康检查 (无需认证)
curl http://localhost:7420/health

# 预期响应
{"status":"ok"}
```

### 3. 查看钱包信息

```bash
pnpm dev wallet
```

### 4. 查看日志

```bash
# 实时查看日志
pnpm dev logs

# 查看最近 100 行
pnpm dev logs --lines 100

# 或者直接查看日志文件
tail -f ~/.agentd/daemon.log
```

### 5. 运行测试

```bash
# 单元测试
pnpm test

# 集成测试
pnpm test:integration

# E2E 测试
pnpm test:e2e
```

---

## CLI 命令参考

```bash
# 启动 Daemon
agentd start [--port <port>] [--chain-hub-url <url>]

# 注册 Agent
agentd register --master-wallet <pubkey>

# 查看状态
agentd status

# 查看钱包
agentd wallet

# 查看日志
agentd logs [--lines <n>]

# Agent 进程管理
agentd agents list
agentd agents add --name <name> --command <cmd> [--args <args...>] [--cwd <path>] [--auto-start]
agentd agents remove <id>

# 任务队列管理
agentd tasks list [--state <state>] [--limit <n>]
agentd tasks stats
```

---

## 故障排除

### 常见问题

#### 1. 端口被占用

```
Error: Port 7420 is already in use
```

**解决方案:**

```bash
# 查找占用端口的进程
lsof -i :7420

# 杀掉进程或更换端口
agentd start --port 8080
```

#### 2. 权限错误

```
Error: EACCES: permission denied, open '~/.agentd/keypair'
```

**解决方案:**

```bash
# 修复权限
chmod 700 ~/.agentd
chmod 600 ~/.agentd/keypair ~/.agentd/auth-token
```

#### 3. Chain Hub 连接失败

```
Connection error: WebSocket connection failed
```

**解决方案:**

- 检查网络连接
- 验证 Chain Hub URL 是否正确
- 检查防火墙设置
- 查看日志获取详细信息: `agentd logs`

#### 4. 缺少依赖 (better-sqlite3)

```
Error: Cannot find module 'better-sqlite3'
```

**解决方案:**

```bash
# 重新安装依赖
pnpm install

# 或在 Alpine Linux 上安装构建工具
apk add --no-cache python3 make g++
```

#### 5. 认证失败

```
Error: 401 Unauthorized
```

**解决方案:**

- 确保 Daemon 正在运行: `agentd status`
- 检查 auth token: `cat ~/.agentd/auth-token`
- 重启 Daemon 重新生成 token

### 日志查看

```bash
# 查看所有日志
pnpm dev logs

# 查看特定行数
pnpm dev logs -n 200

# 在生产环境查看日志
journalctl -u agent-daemon -f
```

### 调试模式

```bash
# 启用详细日志
AGENTD_LOG_LEVEL=debug pnpm dev start

# 使用 Node.js 调试器
NODE_OPTIONS='--inspect' pnpm dev start
```

### 重置数据

```bash
# 停止 Daemon
# 删除数据目录
rm -rf ~/.agentd

# 重新注册
agentd register --master-wallet <pubkey>
```

---

## 更多信息

- [API 文档](./openapi.json) - OpenAPI 规范
- [架构文档](../../docs/architecture/README.md) - 系统架构说明
- [README.md](../README.md) - 项目概览

## 获取帮助

- GitHub Issues: [提交问题](https://github.com/gradiences/protocol/issues)
- 文档: https://docs.gradiences.xyz
- 社区: https://discord.gg/gradiences
