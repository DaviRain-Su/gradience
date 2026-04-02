# 网站部署指南

## 修改总结

本次更新完成了以下内容：

### 1. 新增组件
- `Waitlist.tsx` - 邮件收集表单组件
  - 支持邮箱输入
  - 用户类型选择（Developer/Gamer/Protocol/Investor）
  - 本地存储数据（临时方案）
  - 提交状态反馈

### 2. 修改的文件
- `Hero.tsx` - CTA 改为 "Join waitlist"，白皮书链接改为本地 PDF
- `GetStarted.tsx` - 移除源代码链接，保留白皮书和联系邮箱
- `Audiences.tsx` - 卡片链接改为 #waitlist
- `page.tsx` - 添加 Waitlist 组件

### 3. 新增资源
- `public/whitepaper.pdf` - 白皮书 PDF

---

## 部署步骤

### 1. 构建

```bash
cd website
npm install  # 如果还没有安装依赖
npm run build
```

### 2. 检查构建输出

确保 `out/` 目录包含：
- `index.html`
- `_next/` 静态资源
- `whitepaper.pdf`

### 3. 部署

根据你的托管平台选择：

#### Vercel（推荐）
```bash
vercel --prod
```

#### Netlify
```bash
netlify deploy --prod --dir=out
```

#### 静态托管（Cloudflare Pages / AWS S3）
上传 `out/` 目录内容到对应服务。

---

## 邮件收集后端方案

目前表单数据存储在浏览器 localStorage 中。你需要选择一个后端方案：

### 选项 1: Google Forms（最简单）
1. 创建 Google Form
2. 使用表单提交 URL
3. 修改 Waitlist.tsx 中的提交逻辑

### 选项 2: Mailchimp / ConvertKit
- 使用他们的 API
- 需要 API key

### 选项 3: Resend（推荐）
- 简单的邮件服务
- 可以发送确认邮件

### 选项 4: 自建后端
- 简单的 Express/Fastify 服务
- 存储到数据库或发送到 Discord/Slack

---

## 本地预览

```bash
cd website
npm run dev
```

访问 http://localhost:3000

---

## 验证清单

- [ ] 网站能正常打开
- [ ] "Join waitlist" 按钮能滚动到表单
- [ ] 邮箱输入和类型选择正常工作
- [ ] 提交后显示成功消息
- [ ] "Read whitepaper" 能下载 PDF
- [ ] 所有 Codeberg 链接已移除
- [ ] 移动端显示正常

---

*更新日期: 2026-04-03*
