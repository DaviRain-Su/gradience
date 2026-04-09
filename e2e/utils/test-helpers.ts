import { Page } from '@playwright/test';

/**
 * E2E 测试工具函数
 */

/**
 * 连接测试钱包
 */
export async function connectWallet(page: Page, walletType: 'phantom' | 'solflare' = 'phantom') {
    // 点击连接钱包按钮
    await page.click('text=Connect Wallet');

    // 等待钱包选择弹窗
    await page.waitForSelector(`text=${walletType}`, { timeout: 5000 });

    // 选择钱包
    await page.click(`text=${walletType}`);

    // 等待连接成功
    await page.waitForSelector('text=Connected', { timeout: 10000 });
}

/**
 * 创建测试任务
 */
export async function createTestTask(
    page: Page,
    options: {
        description: string;
        reward: string;
        category: string;
        deadline?: string;
    },
) {
    await page.click('text=Post Task');

    await page.fill('[name="description"]', options.description);
    await page.fill('[name="reward"]', options.reward);
    await page.selectOption('[name="category"]', options.category);

    if (options.deadline) {
        await page.fill('[name="deadline"]', options.deadline);
    }

    await page.click('text=Create Task');

    // 等待成功提示
    await page.waitForSelector('text=Task created successfully', { timeout: 15000 });
}

/**
 * 等待交易确认
 */
export async function waitForTransaction(page: Page, timeout = 30000) {
    await page.waitForSelector('text=Confirmed|Success|Completed', { timeout });
}

/**
 * 获取最新任务 ID
 */
export async function getLatestTaskId(page: Page): Promise<number> {
    const taskElement = await page.locator('[data-testid="task-id"]').first();
    const taskIdText = await taskElement.textContent();
    return parseInt(taskIdText?.replace('#', '') || '0', 10);
}

/**
 * 模拟区块链延迟
 */
export async function waitForBlockchainDelay(ms = 2000) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
