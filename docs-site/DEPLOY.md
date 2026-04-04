# Mintlify Deployment Guide

## 🚀 Deploy to Mintlify Cloud

### Step 1: Push to GitHub

确保你的代码已推送到 GitHub：

```bash
git push origin main
```

### Step 2: Connect to Mintlify

1. 访问 [Mintlify Dashboard](https://dashboard.mintlify.com)
2. 点击 "New Project"
3. 选择 "Connect GitHub Repository"
4. 授权 Mintlify 访问你的仓库
5. 选择 `DaviRain-Su/gradience` 仓库
6. 设置根目录为 `docs-site`

### Step 3: Configure Deployment

在 Mintlify Dashboard 中配置：

- **Project Name**: `gradience-docs`
- **Root Directory**: `docs-site`
- **Build Command**: (留空，使用默认)
- **Output Directory**: (留空，使用默认)

### Step 4: Deploy

点击 "Deploy"，Mintlify 会自动：
- 构建你的文档
- 部署到 CDN
- 提供访问链接

### Step 5: Custom Domain (可选)

1. 在 Dashboard 点击 "Settings"
2. 选择 "Custom Domain"
3. 输入你的域名，如 `docs.gradience.io`
4. 按照指示配置 DNS

## 📁 项目结构要求

```
docs-site/
├── mint.json          # 必需：Mintlify 配置
├── package.json       # 可选：依赖配置
├── README.md          # 可选：文档说明
├── logo/              # 建议：Logo 文件
│   ├── dark.svg
│   └── light.svg
├── images/            # 建议：图片资源
└── **/*.mdx           # 文档页面
```

## 🔧 本地预览

在部署前本地测试：

```bash
cd docs-site
npm install
npm run dev
```

访问 http://localhost:3000 预览

## 📝 重要配置

### mint.json 必需字段

```json
{
  "name": "Your Docs Name",
  "logo": {
    "dark": "/logo/dark.svg",
    "light": "/logo/light.svg"
  },
  "favicon": "/favicon.svg",
  "colors": {
    "primary": "#4779FF",
    "light": "#A0BFFF",
    "dark": "#69A5FF"
  },
  "navigation": [...]
}
```

## 🌐 部署后

### 默认域名
部署后会获得默认域名：
`https://gradience-docs.mintlify.app`

### 自定义域名
配置自定义域名后：
`https://docs.gradience.io`

### 自动部署
每次推送到 main 分支，Mintlify 会自动重新部署。

## 🆘 故障排除

### 构建失败
检查：
1. `mint.json` 格式是否正确
2. 所有导航页面是否存在
3. 图片路径是否正确

### 页面 404
检查：
1. 文件是否在正确的目录
2. 导航配置中的路径是否正确

### 样式问题
检查：
1. `colors` 配置是否完整
2. CSS 文件是否正确引入

## 📚 官方文档

- [Mintlify Docs](https://mintlify.com/docs)
- [Configuration Reference](https://mintlify.com/docs/settings/global)
- [Components](https://mintlify.com/docs/content/components)

## ✅ 部署检查清单

- [ ] 代码已推送到 GitHub
- [ ] Mintlify 已连接仓库
- [ ] 根目录设置为 `docs-site`
- [ ] 构建成功
- [ ] 所有页面可访问
- [ ] 自定义域名配置（可选）
