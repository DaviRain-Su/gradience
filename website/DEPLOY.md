# 网站部署指南

## 邮件订阅服务配置

### 方案 1: Vercel 托管（推荐，支持 API 路由）

#### 1. 注册 Resend
- 访问 https://resend.com
- 注册账号
- 获取 API Key

#### 2. 部署到 Vercel
```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
cd website
vercel --prod
```

#### 3. 配置环境变量
在 Vercel Dashboard 中添加：
```
RESEND_API_KEY=re_xxxxxxxx
ADMIN_EMAIL=hello@gradiences.xyz
```

#### 4. 验证域名（可选）
在 Resend 中添加 gradiences.xyz 域名，验证后可从 hello@gradiences.xyz 发送邮件。

---

### 方案 2: 静态托管（Netlify/Cloudflare Pages）

静态托管不支持 API 路由，需要改用第三方表单服务：

#### 选项 A: Google Forms（免费，最简单）
1. 创建 Google Form（邮箱 + 用户类型）
2. 获取预填充链接
3. 修改 Waitlist.tsx 跳转至 Google Form

#### 选项 B: Formspree（免费 50 次/月）
1. 注册 https://formspree.io
2. 获取 form endpoint
3. 修改 API 调用地址

#### 选项 C: Airtable（免费 1200 行）
1. 创建 Airtable Base
2. 使用 Airtable Form
3. 嵌入到网站

---

### 方案 3: 自建后端

如果你有自己的服务器：

```bash
# 部署 Next.js 应用到服务器
npm run build
npm start
```

或使用 Docker：
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 构建命令

### 开发
```bash
cd website
npm install
npm run dev
```

### 生产构建
```bash
cd website
npm install
npm run build
```

### 静态导出（用于 Netlify/Cloudflare Pages）
```bash
cd website
STATIC_EXPORT=true npm run build
# 输出在 dist/ 目录
```

---

## 环境变量

创建 `.env.local`：
```bash
# Resend API Key（用于发送邮件）
RESEND_API_KEY=re_xxxxxxxx

# 管理员邮箱（接收新用户通知）
ADMIN_EMAIL=hello@gradiences.xyz
```

---

## 部署前检查清单

- [ ] 所有环境变量已配置
- [ ] 构建成功无错误
- [ ] 邮件订阅功能已测试
- [ ] 白皮书 PDF 已放入 public/
- [ ] 移动端显示正常

---

## 当前实现状态

✅ 邮件订阅表单前端
✅ API 路由（等待邮件服务配置）
⏳ 需要选择托管方案并配置环境变量

推荐：使用 Vercel + Resend，30 分钟即可上线。
