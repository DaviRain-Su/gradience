# 邮件发送问题排查指南

## 🔍 第一步：检查 Vercel 日志

1. 打开 https://vercel.com/dashboard
2. 进入你的项目
3. 点击 **Logs** 标签
4. 提交一次表单
5. 查看是否有错误信息

常见错误：
- `Invalid API Key` - API Key 错误
- `Domain not verified` - 域名未验证
- `Rate limited` - 发送频率限制

---

## 🔍 第二步：检查 Resend 发送记录

1. 打开 https://resend.com
2. 进入 **Logs**
3. 查看最近的发送记录
4. 状态应该是 `Delivered` 或 `Bounced`

如果看不到记录，说明 API 调用没成功。

---

## 🔍 第三步：检查环境变量

在 Vercel Dashboard → Settings → Environment Variables：

必须有的变量：
```
RESEND_API_KEY = re_xxxxxxxxxxxxxxxx
FROM_EMAIL = hello@gradiences.xyz
ADMIN_EMAIL = your-email@example.com
```

⚠️ **重要**: 修改环境变量后需要重新部署！

---

## 🔍 第四步：检查域名验证状态

在 Resend → Domains：
- `gradiences.xyz` 应该显示 **Verified** (绿色)
- 如果显示 **Pending**，说明 DNS 还没生效

---

## 🔍 第五步：检查代码

让我确认代码里的发件人设置：

```typescript
// 当前代码用的发件人
from: `Gradience <${fromEmail}>`
// fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev'
```

如果 `FROM_EMAIL` 设置了 `hello@gradiences.xyz`，就会用它。

---

## 🛠️ 快速修复方案

### 方案 1: 直接在代码里写死发件人（测试用）

修改 `route.ts`：
```typescript
await resend.emails.send({
  from: 'Gradience <hello@gradiences.xyz>',  // 直接写死
  to: email,
  subject: "You're on the Gradience waitlist!",
  html: `...`,
});
```

### 方案 2: 使用 Resend 测试邮箱（100%可用）

```typescript
from: 'Gradience <onboarding@resend.dev>'
```

先测试这个能不能收到。

---

## 📧 检查你的邮箱

1. **收件箱** - 查看有没有
2. **垃圾邮件/垃圾箱** - 经常在这里
3. **所有邮件** - 搜索 "Gradience" 或 "waitlist"

---

## 🧪 测试 API 直接

用 curl 测试：
```bash
curl -X POST https://your-site.com/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","userType":"developer"}'
```

看返回什么：
- `{"success":true}` - API 正常
- 错误信息 - 看具体问题

---

## ❓ 回答这些问题

1. **Vercel 日志有错误吗？**
2. **Resend 控制台能看到发送记录吗？**
3. **域名显示 Verified 吗？**
4. **环境变量 FROM_EMAIL 设置了吗？**
5. **邮件在垃圾箱吗？**

告诉我答案，我帮你定位问题。
