# Developer Docs Deployment Guide

## 部署信息

| 项目 | 详情 |
|------|------|
| **部署平台** | Vercel |
| **生产环境** | https://docs.gradiences.xyz |
| **项目路径** | `apps/developer-docs/` |
| **框架** | Next.js 14.2.0 |

## 本地开发

```bash
# 进入项目目录
cd apps/developer-docs

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

访问 http://localhost:3000

## 部署流程

### 自动部署 (GitHub Actions)

1. **Push 到 main 分支** → 自动触发生产部署
2. **Pull Request** → 自动生成预览链接

### 手动部署 (Vercel CLI)

```bash
# 安装 Vercel CLI
pnpm add -g vercel

# 登录
vercel login

# 部署预览
vercel

# 部署生产环境
vercel --prod
```

## 所需环境变量

在 GitHub Secrets 中配置:

| Secret | 说明 |
|--------|------|
| `VERCEL_TOKEN` | Vercel API Token |
| `VERCEL_ORG_ID` | Vercel Organization ID |
| `VERCEL_PROJECT_ID_DEVELOPER_DOCS` | Developer Docs 项目 ID |

## 自定义域名配置

在 Vercel Dashboard 中:
1. 进入项目 Settings → Domains
2. 添加域名: `docs.gradiences.xyz`
3. 按照 Vercel 提示配置 DNS 记录

## 构建配置

- **Build Command**: `pnpm build`
- **Output Directory**: `.next`
- **Node Version**: 22

## 监控

- 每次部署后会自动运行 Smoke Test
- 检查结果会显示在 GitHub Commit/PR 评论中
