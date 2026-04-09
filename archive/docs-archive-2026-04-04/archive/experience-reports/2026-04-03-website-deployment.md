# 经验报告：Gradience 网站部署 (2026-04-03)

## 背景

完成 Gradience 官网及 AgentM 子产品的域名统一和部署。

## 执行过程

### 1. 任务清单

- [x] 更新官网 Hero (添加 ChainHub 认知)
- [x] 更新域名 (agentm.xyz → agentm.gradiences.xyz)
- [x] 部署官网到 gradiences.xyz
- [x] 部署 AgentM Web 到 agentm.gradiences.xyz
- [x] 部署 AgentM Pro placeholder 到 pro.gradiences.xyz

### 2. 遇到的问题及解决

#### 问题 1: 域名拼写错误

**现象**: 最初把 `gradiences.xyz` 错写成 `gradience.syz`
**解决**: 仔细检查后修正
**教训**: 复制域名时不要凭记忆，要从可靠来源复制

#### 问题 2: Cloudflare CNAME 记录报错 "Content invalid"

**现象**: 添加 CNAME 记录时 Cloudflare 报错
**原因**: Vercel 实际需要的是 A 记录 (IP 地址)，不是 CNAME
**解决**:

```
Type: A
Name: agentm
Value: 76.76.21.21
```

**教训**: 仔细看 Vercel 的提示，它明确说了 `A agentm.gradiences.xyz 76.76.21.21`

#### 问题 3: 域名被旧项目占用

**现象**: `vercel domains add` 报错 "already assigned to another project"
**原因**: 之前测试时域名绑定到了其他 Vercel 项目
**解决**: 在 Vercel Dashboard 手动转移域名，或使用 `vercel domains rm` 先删除
**教训**: 项目初期就规划好域名结构，避免重复绑定

#### 问题 4: AgentM Web 初始为空白页

**现象**: 打开 agentm.gradiences.xyz 白屏
**原因**: VITE_PRIVY_APP_ID 环境变量未设置，应用进入 DemoApp 模式但 DemoApp 未实现
**解决**: 需要设置环境变量或实现 DemoApp
**状态**: 待修复 (见 Bug Report)

### 3. 正确配置参考

#### DNS 配置 (Cloudflare)

```
Type: A    Name: @       Value: 76.76.21.21  (官网)
Type: A    Name: agentm  Value: 76.76.21.21  (AgentM Web)
Type: A    Name: pro     Value: 76.76.21.21  (AgentM Pro)
```

#### Vercel 环境变量

```
NEXT_PUBLIC_AGENTM_URL=https://agentm.gradiences.xyz
NEXT_PUBLIC_AGENTM_PRO_URL=https://pro.gradiences.xyz
```

### 4. 时间记录

| 任务            | 预估      | 实际      | 差异原因     |
| --------------- | --------- | --------- | ------------ |
| 官网更新        | 30min     | 30min     | -            |
| 部署官网        | 10min     | 15min     | 域名配置确认 |
| 部署 AgentM Web | 15min     | 30min     | 构建时间较长 |
| DNS 配置        | 10min     | 20min     | 记录类型错误 |
| **总计**        | **65min** | **95min** |              |

### 5. 改进建议

1. **文档化**: 把 DNS 配置模板写入文档，下次直接复制
2. **自动化**: 使用 Terraform 或脚本管理 DNS 配置
3. **预检查**: 部署前自动检查环境变量是否设置
4. **监控**: 添加部署后的健康检查

### 6. 相关文档

- 方法论文档: `docs/methodology/`
- AgentM Pro 开发文档: `apps/agentm-pro/docs/`
- Bug 报告: `docs/experience-reports/2026-04-03-agentm-web-white-screen.md`

---

**Reporter:** Product Manager  
**Date:** 2026-04-03  
**Status:** Completed
