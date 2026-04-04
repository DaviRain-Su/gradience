# Vercel 自动部署配置指南

## 概述

本文档说明如何配置 GitHub 仓库与 Vercel 的自动部署集成。

## 部署架构

```
GitHub Repo (main branch) ──► Vercel Production Deployment
         │
         └── PR ──► Vercel Preview Deployment
```

## 自动部署流程

### 1. 生产部署 (Production)

- **触发条件**: `main` 分支的 push
- **目标环境**: https://gradiences.xyz
- **路径监控**: `website/**`, `packages/**`, `pnpm-lock.yaml`

### 2. 预览部署 (Preview)

- **触发条件**: 针对 `main` 分支的 Pull Request
- **特性**:
  - 每个 PR 自动创建预览环境
  - PR 评论中自动发布预览链接
  - 支持视觉回归测试

## 配置步骤

### 第一步：Vercel 项目设置

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 导入 GitHub 仓库
3. 选择项目根目录为 `website`
4. 框架预设选择 `Next.js`
5. 构建设置：
   - Build Command: `cd .. && pnpm install --frozen-lockfile && pnpm --filter @gradiences/website build`
   - Output Directory: `.next`
   - Install Command: `cd .. && pnpm install --frozen-lockfile`

### 第二步：配置环境变量

在 Vercel Dashboard > Project Settings > Environment Variables 中添加：

#### 生产环境 (Production)

```
RESEND_API_KEY=your_resend_api_key
ADMIN_EMAIL=hello@gradiences.xyz
KV_URL=your_kv_url
KV_REST_API_URL=your_kv_rest_api_url
KV_REST_API_TOKEN=your_kv_token
KV_REST_API_READ_ONLY_TOKEN=your_kv_readonly_token
NEXT_TELEMETRY_DISABLED=1
```

#### 预览环境 (Preview)

```
RESEND_API_KEY=your_resend_api_key_staging
ADMIN_EMAIL=hello@gradiences.xyz
KV_URL=your_kv_url_preview
KV_REST_API_URL=your_kv_rest_api_url_preview
KV_REST_API_TOKEN=your_kv_token_preview
KV_REST_API_READ_ONLY_TOKEN=your_kv_readonly_token_preview
NEXT_TELEMETRY_DISABLED=1
```

### 第三步：配置 GitHub Secrets

在 GitHub Repository > Settings > Secrets and variables > Actions 中添加：

| Secret Name | Description | How to Get |
|------------|-------------|------------|
| `VERCEL_TOKEN` | Vercel API Token | Vercel Dashboard > Settings > Tokens |
| `VERCEL_ORG_ID` | Vercel Organization ID | Vercel Project Settings > General |
| `VERCEL_PROJECT_ID_WEBSITE` | Vercel Project ID | Vercel Project Settings > General |

获取方式：

```bash
# 1. 登录 Vercel CLI
vercel login

# 2. 链接项目
vercel link
# 执行后会生成 .vercel/project.json，包含 projectId 和 orgId

# 3. 创建 Token
# 访问 https://vercel.com/account/tokens
# 生成新的 Token，复制到 GitHub Secrets
```

### 第四步：GitHub 环境保护规则 (可选)

对于生产环境部署，建议配置环境保护规则：

1. GitHub Repository > Settings > Environments
2. 创建 `production` 环境
3. 配置保护规则：
   - **Required reviewers**: 添加审核人员
   - **Wait timer**: 设置等待时间
   - **Deployment branches**: 限制为 `main` 分支

## 环境变量说明

### 必需变量

| 变量名 | 用途 | 来源 |
|-------|------|------|
| `RESEND_API_KEY` | 邮件服务 API | [Resend](https://resend.com) |
| `ADMIN_EMAIL` | 管理员邮箱通知 | 自定义 |
| `KV_URL` | Redis 连接 URL | Vercel KV Dashboard |
| `KV_REST_API_URL` | KV REST API 端点 | Vercel KV Dashboard |
| `KV_REST_API_TOKEN` | KV 读写 Token | Vercel KV Dashboard |
| `KV_REST_API_READ_ONLY_TOKEN` | KV 只读 Token | Vercel KV Dashboard |

### 可选变量

| 变量名 | 用途 | 默认值 |
|-------|------|-------|
| `NEXT_TELEMETRY_DISABLED` | 禁用 Next.js 遥测 | `1` |
| `ADMIN_API_KEY` | 管理 API 访问密钥 | - |

## 手动部署

如需手动部署，可以使用 Vercel CLI：

```bash
# 安装 Vercel CLI
pnpm add -g vercel

# 登录
vercel login

# 部署到预览环境
cd website
vercel

# 部署到生产环境
vercel --prod
```

## 故障排除

### 构建失败

1. **检查 pnpm 版本**: 确保 Vercel 使用 pnpm 9.x
2. **检查 Node 版本**: 确保使用 Node.js 20 或 22
3. **检查环境变量**: 确保所有必需变量已配置

### 部署成功但页面 404

1. 检查 `next.config.ts` 中的 `output: 'standalone'`
2. 检查 `vercel.json` 中的 `outputDirectory` 配置
3. 确认构建产物在 `.next` 目录

### KV 连接失败

1. 验证环境变量是否正确设置
2. 检查 Vercel KV 数据库状态
3. 确保 IP 白名单包含 Vercel 的部署 IP

### GitHub Actions 失败

1. 检查 Secrets 是否正确配置
2. 查看 Actions 日志获取详细错误信息
3. 确保 VERCEL_TOKEN 有正确的权限

## 部署状态检查

部署完成后，会自动执行 Smoke Test：

- ✅ Homepage: https://gradiences.xyz
- ✅ API Endpoint: https://gradiences.xyz/api/subscribe?action=count

## 相关文档

- [DEPLOY.md](./DEPLOY.md) - 基础部署指南
- [KV_SETUP.md](./KV_SETUP.md) - KV 数据库配置
- [EMAIL_SETUP.md](./EMAIL_SETUP.md) - 邮件服务配置
- [DNS_SETUP.md](./DNS_SETUP.md) - 域名配置

## 支持

如有部署问题，请联系：

- **维护者**: Gradience Team <hello@gradiences.xyz>
- **Issue**: https://github.com/gradiences/gradience/issues
