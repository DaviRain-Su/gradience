# AgentM Pro - Review & Deploy (Phase 7)

## 1. 预发布检查清单

### 1.1 功能验收
- [ ] Profile 创建流程完整可用
- [ ] Profile 编辑功能正常
- [ ] 声誉评分显示正确
- [ ] 登录/登出功能正常
- [ ] 移动端基本可用

### 1.2 性能检查
- [ ] 首屏加载 < 3s
- [ ] Lighthouse 评分 > 80
- [ ] API 响应 < 500ms (95th percentile)

### 1.3 安全审查
- [ ] 无敏感信息硬编码
- [ ] API 调用带认证
- [ ] 输入已做 sanitization
- [ ] CORS 配置正确

---

## 2. 部署流程

### 2.1 生产环境配置
```bash
# Vercel 环境变量设置
vercel env add VITE_PRIVY_APP_ID production
vercel env add VITE_API_BASE_URL production
vercel env add VITE_CHAINHUB_URL production
```

### 2.2 部署步骤
```bash
# 1. 合并到 main 分支
git checkout main
git merge feature/agentm-pro

# 2. 推送到远程 (触发 Vercel 自动部署)
git push origin main

# 3. 等待 Vercel 构建完成
vercel --prod

# 4. 验证部署
open https://pro.gradiences.xyz
```

### 2.3 域名配置
已配置域名：
- `pro.gradiences.xyz` → Vercel Project: agentm-pro

DNS 配置：
```
Type: A
Name: pro
Value: 76.76.21.21
```

---

## 3. 监控与报警

### 3.1 监控指标
| 指标 | 工具 | 阈值 |
|------|------|------|
| 错误率 | Vercel Analytics | < 1% |
| 性能 | Lighthouse CI | > 80 |
| 可用性 | UptimeRobot | > 99.9% |

### 3.2 日志查看
```bash
# 实时日志
vercel logs pro.gradiences.xyz --tail

# 错误日志
vercel logs pro.gradiences.xyz --level error
```

---

## 4. 回滚计划

### 4.1 自动回滚条件
- 错误率 > 5%
- 首屏加载 > 10s
- 关键功能不可用

### 4.2 手动回滚
```bash
# 查看历史部署
vercel deployments

# 回滚到上一个版本
vercel rollback
```

---

## 5. 发布后任务

### 5.1 验证清单
- [ ] 生产环境功能测试通过
- [ ] 监控看板正常
- [ ] 用户反馈渠道就绪

### 5.2 团队通知
- [ ] 在 Discord/Slack 通知团队
- [ ] 更新产品文档
- [ ] 准备用户指南

---

## 6. 版本记录

| 版本 | 日期 | 变更 | 负责人 |
|------|------|------|--------|
| 0.1.0 | 2026-04-03 | MVP 发布 | Team |

---
**Status:** Draft  
**Created:** 2026-04-03  
**Owner:** Product Manager
