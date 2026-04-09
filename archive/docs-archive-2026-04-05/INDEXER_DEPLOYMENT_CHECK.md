# Indexer 服务器检查清单

**服务器 IP**: 64.23.248.73

## ✅ 端口状态

```
Port 3001: OPEN ✅
Port 80:   OPEN ✅
Port 443:  OPEN ✅
```

## ❌ 问题

HTTP 请求超时，Indexer 服务可能没有正确启动。

## 🔧 检查步骤

请在服务器上运行：

```bash
ssh root@64.23.248.73

# 1. 检查 Indexer 进程
docker ps | grep indexer

# 2. 检查 Indexer 日志
docker logs gradience-indexer

# 3. 检查端口监听
netstat -tlnp | grep 3001

# 4. 本地测试
curl http://localhost:3001/health
```

## 🚀 如果服务没运行

```bash
cd /opt/gradience
docker compose -f deploy/docker-compose.prod.yml up -d indexer
```

## 📝 配置更新

已更新 `apps/agentm-web/.env.local`:

```diff
-NEXT_PUBLIC_INDEXER_URL=http://127.0.0.1:3001
+NEXT_PUBLIC_INDEXER_URL=http://64.23.248.73:3001
```

## ⏳ 下一步

1. 登录服务器检查 Indexer 状态
2. 如果服务挂了，重启它
3. 确认 `curl http://64.23.248.73:3001/health` 返回 200
4. 重新构建 AgentM Web
