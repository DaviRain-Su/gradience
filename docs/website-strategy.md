# Gradience 官网公开策略

> 目标：在技术细节保密的同时，建立用户期待并收集早期用户

---

## 当前问题

- 仓库已设为私有（正确决定）
- 但官网仍链接到 Codeberg（链接将失效）
- 需要区分：**公开给用户** vs **保密技术**

---

## 核心原则

```
保密: 代码实现、协议细节、架构设计
公开: 产品愿景、使用场景、用户价值、等待列表

用户不需要知道你怎么做，只需要知道：
- 这是什么？
- 对我有什么用？
- 我什么时候能用？
```

---

## 三阶段策略

### 🔒 阶段一：现在（保密期）

**官网展示内容：**

1. **愿景叙事** (保持现有 Hero 部分)
   - "The Trustless Settlement Layer for the Services Revolution"
   - 强调问题（$1T services market, AI Agent economy）
   - 不解释技术细节（不要提 Escrow/Judge/Reputation 具体实现）

2. **使用场景** (3个具体例子)
   ```
   - 游戏开发者发布 AI 任务
   - Agent 开发者赚取收入  
   - 玩家拥有可交易的 AI 伴侣
   ```
   用图示/动画展示，不写技术文档

3. **等待列表（Waitlist）**
   - 邮件收集表单
   - 区分用户类型：
     * "I'm a Developer" → Agent 开发者
     * "I'm a User" → 最终用户
     * "I'm a Protocol" → 协议方
   
4. **移除/修改：**
   - ❌ 移除 "Source code" 按钮
   - ❌ 移除 GitHub/Codeberg 链接
   - ✅ 保留 "Read whitepaper"（白皮书可以公开）
   - ✅ 改为 "Join Waitlist" 或 "Get Early Access"

**技术保密边界：**
- 可以提：Bitcoin-inspired, permissionless, reputation
- 不提：具体合约地址、代码结构、PDA 设计、状态机细节

---

### 🟡 阶段二：Agent.im Beta（1-2 个月后）

**公开内容：**

1. **Agent.im 公开测试版**
   - 用户可注册、登录（Google OAuth）
   - 可浏览任务市场（只读）
   - 可申请成为 Agent（需审核）
   
2. **官网新增：**
   - "Try Beta" 按钮 → 跳转到 Agent.im
   - 产品演示视频（录屏，不暴露代码）
   - 用户案例（如果有）

3. **仍然保密：**
   - 核心合约代码
   - Chain Hub 实现细节
   - SDK 源码（可以发布编译版）

---

### 🟢 阶段三：完全公开（3-6 个月后）

**时机：** 产品成熟、竞争优势确立、Grant/Hackathon 成果显现

**完全开源：**
- 合约代码（已审计）
- SDK 源码
- 文档完整

---

## 具体修改建议（立即执行）

### 1. 修改 Hero.tsx

```tsx
// 移除或注释掉
{/* <a href="https://codeberg.org/...">Read whitepaper</a> */}

// 改为
<a
  href="#waitlist"  // 或链接到白皮书 PDF（可以公开）
  className="..."
>
  Join Waitlist
</a>
```

### 2. 修改 GetStarted.tsx

```tsx
// 移除这些按钮：
// - 💻 Source code
// - 📜 中文文档（或改为链接到白皮书 PDF）

// 保留：
// - 📄 White paper（链接到公开的白皮书 PDF）

// 新增：
<a href="#waitlist" className="...">
  🚀 Join the Waitlist
</a>

<a href="mailto:contact@gradiences.xyz" className="...">
  💼 Partner with us
</a>
```

### 3. 新增 Waitlist 组件

```tsx
// components/Waitlist.tsx
export function Waitlist() {
  return (
    <section id="waitlist" className="py-24 px-6">
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4">
          Be the first to experience the Agent Economy
        </h2>
        <p className="text-[var(--text-2)] mb-8">
          Join 2,000+ developers and users on the waitlist. 
          Early access launching Q2 2026.
        </p>
        
        <form className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            placeholder="Enter your email"
            className="flex-1 px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]"
          />
          <select className="px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
            <option>I'm a Developer</option>
            <option>I'm a Gamer/User</option>
            <option>I'm a Protocol/Company</option>
          </select>
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-white text-[var(--bg)] font-semibold"
          >
            Join Waitlist
          </button>
        </form>
        
        <p className="text-xs text-[var(--text-3)] mt-4">
          No spam. Unsubscribe anytime. We'll notify you when early access is available.
        </p>
      </div>
    </section>
  );
}
```

### 4. 白皮书处理

**可以公开的：**
- ✅ 白皮书 PDF（已更新，不含代码）
- ✅ 协议设计哲学（高层次）
- ✅ 经济模型

**不公开的：**
- ❌ 技术规格文档（Technical Spec）
- ❌ 代码实现
- ❌ 架构详细文档

**建议：** 将白皮书 PDF 放在官网 `public/whitepaper.pdf`，直接下载

---

## FAQ 准备（应对用户询问）

**Q: 代码开源吗？**
> "我们计划在未来开源核心协议。目前团队专注于构建最稳固的基础设施，确保产品成熟后再向社区公开代码。"

**Q: 我什么时候可以用？**
> "我们正在招募早期测试用户。加入等待列表，Q2 2026 获得首批体验资格。"

**Q: 这具体是怎么工作的？**
> "简单说：发布任务 → AI Agent 竞争完成 → 最佳结果获胜 → 自动支付。
> 类似 Bitcoin 的挖矿竞争，但用于 AI 服务。技术白皮书已公开。"
> （不要深入技术细节）

**Q: 和 Virtuals 有什么区别？**
> "Virtuals 是平台（20-30% 费用，平台控制匹配）。
> Gradience 是协议（5% 费用，开放竞争，无需许可）。"

---

## 检查清单

### 立即执行
- [ ] 移除官网所有 GitHub/Codeberg 链接
- [ ] 添加等待列表表单（可用 Google Forms/Typeform 快速实现）
- [ ] 更新 CTA 按钮："Get started" → "Join Waitlist"
- [ ] 确保白皮书 PDF 可下载（不含代码细节）
- [ ] 检查所有文案，移除技术实现细节

### 本周内
- [ ] 设置邮件收集工具（Mailchimp/ConvertKit/Resend）
- [ ] 创建简单的欢迎邮件序列
- [ ] 在 Twitter/X 发布 "Join the waitlist" 帖子

### 发布后监控
- [ ] 跟踪等待列表增长
- [ ] 根据用户类型调整沟通策略
- [ ] 准备 Beta 测试邀请流程

---

## 总结

| 维度 | 现在（阶段一） | 未来（阶段三） |
|------|--------------|---------------|
| **代码** | 🔒 私有 | 🟢 开源 |
| **产品** | 🟡 等待列表 | 🟢 公开使用 |
| **文档** | 📄 白皮书公开 | 📚 完整文档 |
| **策略** | 建立期待 | 生态扩张 |

**你的直觉是对的：** Agent.im 是用户级产品，应该让用户直接体验。但在产品 ready 之前，等待列表是平衡保密和营销的最佳选择。

---

*策略版本: v1.0*  
*更新日期: 2026-04-03*
