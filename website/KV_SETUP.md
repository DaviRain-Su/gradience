# Vercel KV Setup Guide

## 概述

Waitlist 数据现在使用 Vercel KV 进行持久化存储，替代原来的内存存储。

## 配置步骤

### 1. 创建 Vercel KV 数据库

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择你的项目
3. 点击 "Storage" 标签
4. 点击 "Connect Database"
5. 选择 "KV" (Redis)
6. 创建新数据库或使用现有数据库
7. 连接到你的项目

### 2. 获取环境变量

连接数据库后，Vercel 会自动添加以下环境变量到你的项目：

- `KV_URL` - Redis 连接 URL
- `KV_REST_API_URL` - REST API URL
- `KV_REST_API_TOKEN` - REST API Token (读写)
- `KV_REST_API_READ_ONLY_TOKEN` - 只读 Token

在本地开发时，从 Vercel Dashboard 复制这些值到 `.env.local`：

```bash
# Vercel Dashboard > Storage > KV Database > .env.local tab
KV_URL="redis://..."
KV_REST_API_URL="https://..."
KV_REST_API_TOKEN="..."
KV_REST_API_READ_ONLY_TOKEN="..."
```

### 3. 生成 Admin API Key

用于访问管理 API：

```bash
openssl rand -base64 32
```

添加到 `.env.local`：

```bash
ADMIN_API_KEY=your-generated-key
```

## API 端点

### POST /api/subscribe

订阅 waitlist（公开）

```bash
curl -X POST https://your-site.com/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "userType": "developer"}'
```

### GET /api/subscribe?action=count

获取订阅数量（公开）

```bash
curl https://your-site.com/api/subscribe?action=count
```

### GET /api/subscribe?action=list

列出所有订阅者（需要 Admin Key）

```bash
curl https://your-site.com/api/subscribe?action=list \
  -H "x-admin-key: your-admin-api-key"
```

响应：

```json
{
  "count": 42,
  "users": [
    {
      "email": "user@example.com",
      "userType": "developer",
      "timestamp": "2025-01-15T08:30:00.000Z"
    }
  ]
}
```

## 数据存储结构

### Redis Set: `waitlist:emails`

存储所有邮箱地址，用于去重检查。

### Redis Hash: `waitlist:user:{email}`

存储每个用户的详细信息：

- `email`: 用户邮箱
- `userType`: 用户类型 (developer/gamer/protocol/investor)
- `timestamp`: ISO 8601 格式的时间戳

## 从内存存储迁移

如果你之前使用内存存储有数据需要保留，需要手动导出并导入到 KV：

```bash
# 旧版数据格式示例
curl -X POST https://your-site.com/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email": "existing@example.com", "userType": "developer"}'
```

由于之前的数据会在部署重启后丢失，重新订阅即可。

## 故障排除

### KV 连接失败

1. 检查环境变量是否正确设置
2. 确保 `.env.local` 中变量名与代码中一致
3. 检查 Vercel KV 数据库状态

### 本地开发

确保安装了 `@vercel/kv`：

```bash
cd website && pnpm add @vercel/kv
```

### Vercel KV 已弃用说明

Vercel KV 已标记为弃用，但仍可正常使用。新项目建议使用：
- [Upstash Redis](https://vercel.com/marketplace/upstash) (Vercel Marketplace)
- [Redis Cloud](https://vercel.com/marketplace/redis)

当前使用的 `@vercel/kv` 底层就是 Upstash Redis，后续迁移到 Upstash 直接集成也很简单。
