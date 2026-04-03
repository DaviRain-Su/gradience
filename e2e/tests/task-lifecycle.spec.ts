import { test, expect } from '@playwright/test';

/**
 * E2E Test: 任务完整生命周期
 * 
 * 覆盖流程:
 * 1. Poster 登录并发布任务
 * 2. Agent 登录并申请任务
 * 3. Agent 提交结果
 * 4. Judge 评判并结算
 */

test.describe('任务生命周期', () => {
  test.beforeEach(async ({ page }) => {
    // 访问首页
    await page.goto('/');
    await expect(page).toHaveTitle(/Agent Arena|Gradience/i);
  });

  test('Poster 可以发布任务', async ({ page }) => {
    // 1. 连接钱包（模拟）
    await page.click('text=Connect Wallet');
    await page.waitForSelector('text=Connected', { timeout: 10000 });

    // 2. 打开发布任务表单
    await page.click('text=Post Task');
    
    // 3. 填写任务信息
    await page.fill('[name="description"]', 'E2E Test Task: Write a Solana program');
    await page.fill('[name="reward"]', '1000000000'); // 1 SOL
    await page.selectOption('[name="category"]', '1'); // Code category
    
    // 4. 提交任务
    await page.click('text=Create Task');
    
    // 5. 验证任务创建成功
    await expect(page.locator('text=Task created successfully')).toBeVisible();
    
    // 6. 验证任务出现在列表
    await expect(page.locator('text=E2E Test Task')).toBeVisible();
  });

  test('Agent 可以申请并提交任务', async ({ page }) => {
    // 1. 连接钱包作为 Agent
    await page.click('text=Connect Wallet');
    await page.waitForSelector('text=Connected', { timeout: 10000 });

    // 2. 找到并点击任务
    await page.click('text=View Details', { first: true });
    
    // 3. 申请任务
    await page.click('text=Apply for Task');
    await expect(page.locator('text=Application submitted')).toBeVisible();

    // 4. 提交结果
    await page.fill('[name="resultRef"]', 'ipfs://QmTest123');
    await page.fill('[name="traceRef"]', 'ipfs://QmTrace456');
    await page.click('text=Submit Result');
    
    // 5. 验证提交成功
    await expect(page.locator('text=Result submitted')).toBeVisible();
  });

  test('Judge 可以评判任务', async ({ page }) => {
    // 1. 连接钱包作为 Judge
    await page.click('text=Connect Wallet');
    await page.waitForSelector('text=Connected', { timeout: 10000 });

    // 2. 进入任务详情
    await page.click('text=View Details', { first: true });
    
    // 3. 评判任务
    await page.fill('[name="score"]', '85');
    await page.fill('[name="reason"]', 'Good implementation');
    await page.click('text=Judge & Settle');
    
    // 4. 验证评判成功
    await expect(page.locator('text=Task judged successfully')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
  });
});

test.describe('Agent 声誉系统', () => {
  test('可以查看 Agent 声誉', async ({ page }) => {
    await page.goto('/');
    
    // 连接钱包
    await page.click('text=Connect Wallet');
    await page.waitForSelector('text=Connected', { timeout: 10000 });

    // 查看声誉
    await page.click('text=My Reputation');
    
    // 验证声誉数据显示
    await expect(page.locator('text=Reputation Score')).toBeVisible();
    await expect(page.locator('text=Tasks Completed')).toBeVisible();
  });

  test('声誉排行榜显示正确', async ({ page }) => {
    await page.goto('/');
    
    // 查看排行榜
    await page.click('text=Leaderboard');
    
    // 验证排行榜显示
    await expect(page.locator('text=Top Agents')).toBeVisible();
    await expect(page.locator('[data-testid="agent-rank"]').first()).toBeVisible();
  });
});

test.describe('Chain Hub 集成', () => {
  test('可以查询 Agent 信息', async ({ page }) => {
    await page.goto('/');
    
    // 搜索 Agent
    await page.fill('[name="search"]', 'test-agent');
    await page.press('[name="search"]', 'Enter');
    
    // 验证搜索结果
    await expect(page.locator('text=Search Results')).toBeVisible();
  });

  test('可以浏览 Skills', async ({ page }) => {
    await page.goto('/skills');
    
    // 验证 Skills 页面
    await expect(page.locator('text=Available Skills')).toBeVisible();
    await expect(page.locator('[data-testid="skill-card"]').first()).toBeVisible();
  });
});
