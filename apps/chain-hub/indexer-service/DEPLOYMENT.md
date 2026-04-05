# Chain Hub Indexer 部署指南

## 快速启动

```bash
cd apps/chain-hub/indexer-service

# 复制环境配置
cp .env.example .env

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

## 服务组件

| 服务 | 描述 | 端口 |
|------|------|------|
| `chain-hub-indexer-db` | PostgreSQL 数据库 | 5433 |
| `indexer-service-migrate-1` | 数据库迁移服务 | - |
| `indexer-service-indexer-1` | Indexer API 服务 | 8788 |

## 验证部署

### 1. 检查容器状态
```bash
docker ps | grep indexer
```

### 2. 健康检查脚本
```bash
# 使用健康检查脚本
./scripts/health-check.sh

# 检查特定主机和端口
./scripts/health-check.sh localhost 8788
```

### 3. 测试 API 端点
```bash
# 测试技能列表
curl http://localhost:8788/api/skills

# 测试协议列表
curl http://localhost:8788/api/protocols

# 测试调用记录
curl http://localhost:8788/api/invocations
```

### 3. 检查数据库
```bash
docker exec chain-hub-indexer-db psql -U gradience -d gradience_chain_hub -c "\dt"
```

## 环境变量配置

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `POSTGRES_PASSWORD` | 数据库密码 | gradience_dev |
| `POSTGRES_PORT` | 数据库端口 | 5433 |
| `DATABASE_URL` | 数据库连接字符串 | - |
| `INDEXER_BIND_ADDR` | 服务绑定地址 | 0.0.0.0:8788 |
| `CHAIN_HUB_PROGRAM_ID` | Chain Hub 程序 ID | 11111111111111111111111111111111 |
| `SOLANA_WS_URL` | Solana WebSocket URL | wss://api.devnet.solana.com |
| `SOLANA_SUBSCRIBE` | 启用 Solana 订阅 | false |

## 故障排除

### 端口冲突
如果端口 8788 或 5433 被占用：
```bash
# 修改 .env 文件中的端口配置
POSTGRES_PORT=5434
# 并修改 docker-compose.yml 中的端口映射
```

### 数据库迁移失败
如果迁移失败，重置数据卷：
```bash
docker-compose down -v
docker-compose up -d
```

### 重建服务
```bash
docker-compose down
docker-compose up -d --build
```

## 2026-04-05 部署记录

### 修复内容

1. **Dockerfile 更新**: 将 Rust 版本从 1.75 升级到 1.86
   - 原因: 依赖包需要更新的 Rust 版本支持
   - 修改: `FROM rust:1.75-slim` → `FROM rust:1.86-slim`

2. **迁移脚本修复**: 添加 `IF NOT EXISTS` 到所有 CREATE INDEX 语句
   - 原因: 避免重复运行迁移时的索引已存在错误
   - 修改: `CREATE INDEX` → `CREATE INDEX IF NOT EXISTS`

3. **创建 .env 文件**: 从 .env.example 复制并配置

### 验证结果

- ✅ PostgreSQL 数据库运行正常 (端口 5433)
- ✅ 数据库迁移成功执行
- ✅ Indexer 服务启动成功 (端口 8788)
- ✅ API 端点响应正常:
  - `/api/skills` - 返回空数组 []
  - `/api/protocols` - 返回空数组 []
  - `/api/invocations` - 返回空数组 []
- ✅ 数据库表已创建: skills, protocols, royalties, invocations

## 注意事项

1. 首次启动时会自动运行数据库迁移
2. 服务依赖于 PostgreSQL，数据库健康检查通过后才会启动 indexer
3. 默认配置使用本地开发环境设置
4. 生产环境部署前请修改默认密码和密钥
