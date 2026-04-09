# 邮件列表服务集成指南

## 推荐方案对比

| 方案             | 价格         | 难度        | 特点                               | 推荐度     |
| ---------------- | ------------ | ----------- | ---------------------------------- | ---------- |
| **Resend**       | 免费 3000/月 | ⭐⭐ 简单   | 开发者友好，API 简单，可发确认邮件 | ⭐⭐⭐⭐⭐ |
| **ConvertKit**   | $0-9/月      | ⭐⭐⭐ 中等 | 专业邮件营销，自动化流程           | ⭐⭐⭐⭐   |
| **Mailchimp**    | 免费 500/月  | ⭐⭐⭐ 中等 | 老牌，功能全，但界面复杂           | ⭐⭐⭐     |
| **Google Forms** | 免费         | ⭐ 最简单   | 零代码，但不够专业                 | ⭐⭐       |
| **Airtable**     | 免费         | ⭐⭐ 简单   | 数据库+表单，灵活                  | ⭐⭐⭐     |

## 推荐：Resend（最适合开发者）

### 为什么选 Resend？

1. **开发者友好** - 简单的 API，TypeScript 支持
2. **免费额度足** - 每月 3000 封邮件
3. **可发确认邮件** - 用户提交后立即收到欢迎邮件
4. **可验证域名** - 从 hello@gradiences.xyz 发送
5. **未来可扩展** - 产品通知、营销邮件都能用

### 集成步骤

#### 1. 注册 Resend

```
https://resend.com
```

#### 2. 验证域名

- 添加 DNS 记录验证 gradiences.xyz
- 可以发送 from: hello@gradiences.xyz

#### 3. 获取 API Key

- 创建 API Key (只选 `sending` 权限)
- 复制到环境变量

#### 4. 安装依赖

```bash
cd website
npm install resend
```

#### 5. 创建 API Route

创建 `app/api/subscribe/route.ts`：

```typescript
import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
    try {
        const { email, userType } = await request.json();

        // 验证邮箱
        if (!email || !email.includes('@')) {
            return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
        }

        // 发送确认邮件
        await resend.emails.send({
            from: 'Gradience <hello@gradiences.xyz>',
            to: email,
            subject: 'Welcome to the Gradience Waitlist!',
            html: `
        <h1>You're on the list!</h1>
        <p>Thanks for joining the Gradience waitlist.</p>
        <p>We'll notify you when early access is available (Q2 2026).</p>
        <br/>
        <p>Follow us on Twitter: @gradienceprotocol</p>
      `,
        });

        // 同时发送通知给你
        await resend.emails.send({
            from: 'Gradience <hello@gradiences.xyz>',
            to: 'your-email@example.com',
            subject: `New Waitlist Signup: ${userType}`,
            html: `<p>New signup: ${email} (${userType})</p>`,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Subscribe error:', error);
        return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
    }
}
```

#### 6. 更新 Waitlist 组件

修改提交逻辑，调用 API：

```typescript
const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');

    try {
        const response = await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, userType }),
        });

        if (response.ok) {
            setStatus('success');
            setEmail('');
        } else {
            setStatus('error');
        }
    } catch (error) {
        setStatus('error');
    }
};
```

#### 7. 环境变量

创建 `.env.local`：

```
RESEND_API_KEY=re_xxxxxxxx
```

---

## 备选：ConvertKit（适合长期运营）

如果你需要更专业的邮件营销功能：

### 优点

- 可视化自动化流程
- 邮件序列（欢迎系列、产品更新）
- A/B 测试
- 详细分析

### 注册

```
https://convertkit.com
```

### 使用他们的表单嵌入

ConvertKit 提供现成的表单代码，可以直接嵌入网站。

---

## 快速方案：Google Forms（今天就能用）

如果明天就要部署，可以用 Google Forms：

### 步骤

1. 创建 Google Form（邮箱 + 用户类型）
2. 获取预填充链接
3. 点击 "Join Waitlist" 跳转到 Google Form
4. 提交后显示 "Thanks" 页面

### 缺点

- 用户离开网站
- 无法自定义样式
- 没有自动确认邮件
- 不够专业

---

## 实施建议

### 今天快速上线

1. 用 Resend 注册账号
2. 创建 API Route
3. 更新 Waitlist 组件
4. 部署

预计时间：30 分钟

### 本周完善

1. 验证域名（hello@gradiences.xyz）
2. 设计确认邮件模板
3. 添加邮件序列（欢迎邮件 → 产品更新）
4. 设置用户分组（开发者/用户/协议方）

---

## 需要我帮你实现吗？

我可以帮你：

1. ✅ 创建 Resend API Route
2. ✅ 更新 Waitlist 组件
3. ✅ 设计确认邮件模板
4. ✅ 部署到生产环境

选择哪个方案？
