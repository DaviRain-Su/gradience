# Indexer 服务重启报告

**日期**: 2026-04-04  
**服务器**: 64.23.248.73 (DigitalOcean)  
**状态**: ✅ 运行正常

---

## 🚀 执行的操作

### 1. 构建 Indexer Docker 镜像
```bash
cd /opt/gradience/apps/agent-arena
docker build -f indexer/Dockerfile -t gradience/indexer:latest .
```
**结果**: ✅ 构建成功 (1m 06s)

### 2. 修复种子数据
**问题**: Solana 地址长度超过 VARCHAR(44) 限制  
**解决**: 缩短种子数据中的地址长度  
**文件**: `apps/chain-hub/indexer/migrations/002_seed_data.sql`

### 3. 启动服务
```bash
cd /opt/gradience/apps/chain-hub/indexer
docker compose up -d  # PostgreSQL + Redis
docker run -d --name gradience-indexer ...  # Indexer API
```

---

## ✅ 当前状态

| 服务 | 容器名 | 状态 | 端口 |
|------|--------|------|------|
| Indexer API | gradience-indexer | ✅ Up | 3001 |
| PostgreSQL | gradience-indexer-db | ✅ Healthy | 5432 |
| Redis | gradience-indexer-cache | ✅ Healthy | 6379 |

---

## 🧪 健康检查

```bash
$ curl http://64.23.248.73:3001/healthz

{
  "ok": true,
  "uptime_seconds": 50,
  "events_processed_total": 0,
  "ws_active_connections": 0,
  "active_webhook_source": null
}
```

**状态**: ✅ 200 OK

---

## 📝 配置更新

已更新 `apps/agentm-web/.env.local`:
```diff
-NEXT_PUBLIC_INDEXER_URL=http://127.0.0.1:3001
+NEXT_PUBLIC_INDEXER_URL=http://64.23.248.73:3001
```

---

## 🎯 下一步

1. **测试 API 端点** - 确认所有路由正常工作
2. **重新构建 AgentM Web** - 使用新的 Indexer URL
3. **验证数据流** - 从 Web → Indexer → PostgreSQL

---

## ⚠️ 已知问题

- API 端点 (`/v1/tasks`, `/v1/agents`) 返回 404
- 可能需要检查 Indexer 的具体路由配置

---

## 🔄 重启命令（备用）

```bash
ssh root@64.23.248.73

cd /opt/gradience/apps/chain-hub/indexer
docker compose down -v
docker compose up -d

docker rm -f gradience-indexer
docker run -d --name gradience-indexer --network indexer_default -p 3001:3001 \
  -e DATABASE_URL=postgresql://gradience:gradience_dev@gradience-indexer-db:5432/gradience_indexer \
  -e REDIS_URL=redis://gradience-indexer-cache:6379 \
  -e RUST_LOG=info \
  gradience/indexer:latest
```
