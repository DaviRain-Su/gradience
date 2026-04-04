# Vercel 部署快速启动

## 5 分钟完成配置

### 1. 连接 GitHub 到 Vercel (2分钟)

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "Add New..." > "Project"
3. 导入 `gradiences/gradience` GitHub 仓库
4. 配置：
   - **Framework Preset**: Next.js
   - **Root Directory**: `website`
   - **Build Command**: `cd .. && pnpm install --frozen-lockfile && pnpm --filter @gradiences/website build`
   - **Output Directory**: `.next`
5. 点击 "Deploy"

### 2. 配置环境变量 (2分钟)

在 Vercel Dashboard > Project Settings > Environment Variables：

```bash
# 必需
RESEND_API_KEY=your_resend_api_key
ADMIN_EMAIL=hello@gradiences.xyz

# Vercel KV (从 Vercel Dashboard > Storage 获取)
KV_URL=redis://...
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...

# 其他
NEXT_TELEMETRY_DISABLED=1
```

### 3. 配置 GitHub Secrets (1分钟)

在 GitHub Repository > Settings > Secrets and variables > Actions：

```bash
VERCEL_TOKEN=your_vercel_token      # 从 vercel.com/account/tokens 获取
VERCEL_ORG_ID=your_org_id           # 从项目设置获取
VERCEL_PROJECT_ID_WEBSITE=your_project_id  # 从项目设置获取
```

获取 org_id 和 project_id：

```bash
cd website
vercel link
# 查看生成的 .vercel/project.json
cat .vercel/project.json
```

## 部署流程

```
Push to main ──► 自动部署到 Production
       │
       └── PR ──► 自动部署 Preview (PR 评论中显示链接)
```

## 验证部署

```bash
# 检查主页
curl https://gradiences.xyz

# 检查 API
curl https://gradiences.xyz/api/subscribe?action=count
```

## 常见问题

**Q: 为什么部署失败？**
- 检查 pnpm 版本是否为 9.x
- 检查 Node.js 版本是否为 20+
- 检查所有环境变量是否配置

**Q: 如何查看部署日志？**
- Vercel Dashboard > Deployments > 选择部署 > Build Logs

**Q: 如何回滚？**
- Vercel Dashboard > Deployments > 选择旧版本 > "Promote to Production"

## 下一步

- 配置自定义域名: [DNS_SETUP.md](./DNS_SETUP.md)
- 配置邮件服务: [EMAIL_SETUP.md](./EMAIL_SETUP.md)
- 完整配置说明: [DEPLOYMENT.md](./DEPLOYMENT.md)
