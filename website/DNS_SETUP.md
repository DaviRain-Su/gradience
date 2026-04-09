# Resend 域名验证 - DNS 配置

## 步骤

### 1. 在 Resend 添加域名

1. 登录 https://resend.com
2. 进入 **Domains** → **Add Domain**
3. 输入: `gradiences.xyz`
4. 点击 **Add**

### 2. Resend 会提供 DNS 记录

通常需要添加以下记录：

#### SPF 记录 (TXT)

```
Type:  TXT
Name:  gradiences.xyz 或 @
Value: v=spf1 include:spf.resend.com ~all
```

#### DKIM 记录 (TXT)

```
Type:  TXT
Name:  resend._domainkey.gradiences.xyz
Value: [Resend 提供的 DKIM 值]
```

#### DMARC 记录 (TXT) - 可选但推荐

```
Type:  TXT
Name:  _dmarc.gradiences.xyz
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@gradiences.xyz
```

### 3. 在你的域名提供商添加记录

根据你的域名注册商（Cloudflare/GoDaddy/Namecheap 等）：

1. 登录域名管理面板
2. 找到 DNS 管理
3. 添加上面的 TXT 记录
4. 保存

### 4. 验证域名

回到 Resend，点击 **Verify**。通常几分钟内生效，最长 24 小时。

### 5. 更新环境变量

验证成功后，在 Vercel 添加：

```
FROM_EMAIL = hello@gradiences.xyz
```

---

## 常见域名提供商

| 提供商     | 控制面板                   |
| ---------- | -------------------------- |
| Cloudflare | DNS → Records              |
| GoDaddy    | My Products → DNS          |
| Namecheap  | Domain List → Advanced DNS |
| 阿里云     | 域名 → 解析设置            |
| 腾讯云     | 域名注册 → 解析            |

---

## 验证成功后

邮件会显示为：

```
From: Gradience <hello@gradiences.xyz>
```

更专业，不会被标记为垃圾邮件。
