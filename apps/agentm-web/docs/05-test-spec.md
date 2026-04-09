# Phase 5: Test Spec（测试规格）

> **目的**: 在写代码之前，定义所有测试用例。TDD 的核心。
> **输入**: Phase 3 技术规格 + Phase 4 任务列表
> **输出物**: 测试用例表 + 测试代码骨架，存放到 `apps/agentm-web/docs/05-test-spec.md`
>
> ⚠️ **每个技术规格中的接口/函数必须有对应的测试用例。**
> ⚠️ **测试代码骨架先于实现代码编写。**

---

## 5.1 测试策略（必填）

| 测试类型 | 覆盖范围        | 工具                           | 运行环境 |
| -------- | --------------- | ------------------------------ | -------- |
| 单元测试 | Hooks, Utils    | Vitest                         | Node.js  |
| 集成测试 | 组件交互        | Vitest + React Testing Library | Node.js  |
| E2E 测试 | 完整用户流程    | Playwright                     | Browser  |
| 类型测试 | TypeScript 类型 | tsc                            | Node.js  |

## 5.2 测试用例表（必填）

### 5.2.1 useProfile Hook

**正常路径 (Happy Path)**

| #   | 测试名称          | 输入                     | 预期输出     | 预期状态变化    |
| --- | ----------------- | ------------------------ | ------------ | --------------- |
| H1  | 获取 Profile 成功 | address: "valid_addr"    | profile 对象 | loading → false |
| H2  | 更新 Profile 成功 | updates: { displayName } | profile 更新 | 新 displayName  |

**边界条件 (Boundary)**

| #   | 测试名称   | 输入                  | 预期行为      | 备注     |
| --- | ---------- | --------------------- | ------------- | -------- |
| B1  | 空地址     | address: ""           | profile: null | 早期返回 |
| B2  | 超长显示名 | displayName: 51 chars | 截断或错误    | 验证长度 |

**异常/攻击 (Error/Attack)**

| #   | 测试名称 | 输入/操作            | 预期错误码    | 攻击类型 |
| --- | -------- | -------------------- | ------------- | -------- |
| E1  | API 404  | address: "not_exist" | NOT_FOUND     | 无效访问 |
| E2  | 网络错误 | offline              | NETWORK_ERROR | 网络中断 |

### 5.2.2 useFollowing Hook

**正常路径 (Happy Path)**

| #   | 测试名称            | 输入            | 预期输出    | 预期状态变化       |
| --- | ------------------- | --------------- | ----------- | ------------------ |
| H1  | Follow 成功         | target: "addr"  | success     | following 列表增加 |
| H2  | Unfollow 成功       | target: "addr"  | success     | following 列表减少 |
| H3  | 获取 Following 列表 | address: "user" | Following[] | 正确渲染           |

**边界条件 (Boundary)**

| #   | 测试名称    | 输入         | 预期行为   | 备注   |
| --- | ----------- | ------------ | ---------- | ------ |
| B1  | 重复 Follow | 已关注的地址 | 返回已关注 | 幂等性 |
| B2  | 关注自己    | target: self | 错误提示   | 不允许 |

**异常/攻击 (Error/Attack)**

| #   | 测试名称   | 输入/操作         | 预期错误码   | 攻击类型 |
| --- | ---------- | ----------------- | ------------ | -------- |
| E1  | 未登录调用 | wallet: null      | UNAUTHORIZED | 权限绕过 |
| E2  | 无效地址   | target: "invalid" | BAD_REQUEST  | 输入攻击 |

### 5.2.3 useSocial Hook

**正常路径 (Happy Path)**

| #   | 测试名称  | 输入             | 预期输出     | 预期状态变化 |
| --- | --------- | ---------------- | ------------ | ------------ |
| H1  | 创建帖子  | content: "Hello" | SocialPost   | Feed 更新    |
| H2  | 删除帖子  | postId: "123"    | success      | Feed 移除    |
| H3  | 获取 Feed | limit: 20        | SocialPost[] | 正确分页     |
| H4  | Like 帖子 | postId: "123"    | success      | like 数 +1   |

**边界条件 (Boundary)**

| #   | 测试名称     | 输入                | 预期行为   | 备注     |
| --- | ------------ | ------------------- | ---------- | -------- |
| B1  | 空内容       | content: ""         | 错误提示   | 验证非空 |
| B2  | 超长内容     | content: 1001 chars | 截断或错误 | 长度限制 |
| B3  | 大量 Feed 项 | offset: 1000        | 返回空数组 | 分页边界 |

**异常/攻击 (Error/Attack)**

| #   | 测试名称     | 输入/操作           | 预期错误码   | 攻击类型 |
| --- | ------------ | ------------------- | ------------ | -------- |
| E1  | 删除他人帖子 | postId: other's     | UNAUTHORIZED | 权限绕过 |
| E2  | XSS 内容     | content: "<script>" | 转义输出     | XSS 攻击 |

### 5.2.4 useDashboard Hook

**正常路径 (Happy Path)**

| #   | 测试名称 | 输入              | 预期输出       | 预期状态变化 |
| --- | -------- | ----------------- | -------------- | ------------ |
| H1  | 获取统计 | wallet: connected | DashboardStats | 所有字段有值 |
| H2  | 刷新数据 | -                 | updated stats  | 数据更新     |

**边界条件 (Boundary)**

| #   | 测试名称      | 输入     | 预期行为 | 备注     |
| --- | ------------- | -------- | -------- | -------- |
| B1  | 无 Profile    | new user | 0 统计   | 新用户   |
| B2  | 大量 Profiles | > 100    | 正确统计 | 性能测试 |

## 5.3 集成测试场景（必填）

| #   | 场景名称         | 步骤                                                                     | 预期结果     |
| --- | ---------------- | ------------------------------------------------------------------------ | ------------ |
| I1  | 完整社交流程     | 1. 登录 → 2. 创建 Profile → 3. Follow Agent → 4. 发布帖子 → 5. 查看 Feed | 每个步骤成功 |
| I2  | Profile 编辑流程 | 1. 查看 Profile → 2. 点击编辑 → 3. 修改信息 → 4. 保存 → 5. 验证更新      | 数据持久化   |
| I3  | 认证过期处理     | 1. 登录 → 2. 等待过期 → 3. 尝试操作 → 4. 重定向登录                      | 优雅处理     |

## 5.4 组件测试场景（必填）

| #   | 组件         | 测试内容                    |
| --- | ------------ | --------------------------- |
| C1  | ProfileCard  | 渲染 profile 数据，点击跳转 |
| C2  | FollowButton | 状态切换，点击事件          |
| C3  | PostCard     | 渲染内容，Like 按钮         |
| C4  | Feed         | 列表渲染，无限滚动          |
| C5  | Dashboard    | 统计卡片渲染                |

## 5.5 测试代码骨架（必填）

```typescript
// src/__tests__/hooks/useProfile.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProfile } from '@/hooks/useProfile';

describe('useProfile', () => {
    // Happy Path
    it('H1: should fetch profile successfully when address is valid', async () => {
        // TODO: implement
    });

    it('H2: should update profile when updateProfile is called', async () => {
        // TODO: implement
    });

    // Boundary
    it('B1: should return null when address is empty', async () => {
        // TODO: implement
    });

    // Error
    it('E1: should set error when API returns 404', async () => {
        // TODO: implement
    });

    it('E2: should handle network error gracefully', async () => {
        // TODO: implement
    });
});
```

```typescript
// src/__tests__/hooks/useFollowing.test.ts
import { describe, it, expect } from 'vitest';

describe('useFollowing', () => {
    it('H1: should follow agent successfully', async () => {
        // TODO: implement
    });

    it('H2: should unfollow agent successfully', async () => {
        // TODO: implement
    });

    it('B1: should handle duplicate follow gracefully', async () => {
        // TODO: implement
    });

    it('E1: should fail when wallet is not connected', async () => {
        // TODO: implement
    });
});
```

```typescript
// src/__tests__/hooks/useSocial.test.ts
import { describe, it, expect } from 'vitest';

describe('useSocial', () => {
    it('H1: should create post successfully', async () => {
        // TODO: implement
    });

    it('H3: should fetch feed with pagination', async () => {
        // TODO: implement
    });

    it('B1: should reject empty content', async () => {
        // TODO: implement
    });

    it('E2: should escape XSS content', async () => {
        // TODO: implement
    });
});
```

```typescript
// src/__tests__/components/ProfileCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('ProfileCard', () => {
    it('should render profile information correctly', () => {
        // TODO: implement
    });

    it('should navigate to profile page on click', () => {
        // TODO: implement
    });
});
```

## 5.6 E2E 测试场景

```typescript
// e2e/social-flow.spec.ts
import { test, expect } from '@playwright/test';

test('complete social flow', async ({ page }) => {
    // 1. 登录
    await page.goto('/');
    await page.click('[data-testid="login-button"]');
    // ... 完成登录

    // 2. 创建 Profile
    await page.goto('/profile/edit');
    await page.fill('[name="displayName"]', 'Test Agent');
    await page.click('[data-testid="save-profile"]');

    // 3. Follow Agent
    await page.goto('/profiles');
    await page.click('[data-testid="follow-button"]:first-child');

    // 4. 验证 Feed
    await page.goto('/app');
    await expect(page.locator('[data-testid="feed-item"]')).toBeVisible();
});
```

## 5.7 测试覆盖目标（必填）

| 指标         | 目标         |
| ------------ | ------------ |
| 语句覆盖率   | ≥ 80%        |
| 分支覆盖率   | ≥ 75%        |
| Hooks 覆盖率 | 100%         |
| 组件渲染测试 | 所有主要组件 |
| E2E 场景     | 核心用户流程 |

---

## ✅ Phase 5 验收标准

- [x] 技术规格中的每个接口/函数都有对应测试用例
- [x] Happy Path + Boundary + Error 三类齐全
- [x] 测试代码骨架已编写（可编译，但 TODO 未实现）
- [x] 集成测试至少 3 个完整场景
- [x] E2E 测试骨架已定义
- [x] 覆盖目标已定义

**验收通过后，进入 Phase 6: Implementation →**
