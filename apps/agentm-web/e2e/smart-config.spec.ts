/**
 * SmartConfig E2E 测试
 */

import { test, expect } from '@playwright/test';

test.describe('SmartConfig', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/agents/create');
    });

    test('应该显示智能配置和传统配置模式切换', async ({ page }) => {
        // 检查模式切换按钮
        await expect(page.getByText('智能配置')).toBeVisible();
        await expect(page.getByText('传统配置')).toBeVisible();
    });

    test('应该能切换到智能配置模式', async ({ page }) => {
        // 点击智能配置按钮
        await page.getByRole('button', { name: '智能配置' }).click();

        // 检查智能配置界面元素
        await expect(page.getByPlaceholder(/描述你的 Agent/)).toBeVisible();
        await expect(page.getByRole('button', { name: '生成配置界面' })).toBeVisible();
    });

    test('应该能输入提示词并显示示例', async ({ page }) => {
        // 切换到智能配置
        await page.getByRole('button', { name: '智能配置' }).click();

        // 输入提示词
        const promptInput = page.getByPlaceholder(/描述你的 Agent/);
        await promptInput.fill('监控 ETH 价格');

        // 检查示例按钮
        await expect(page.getByRole('button', { name: '代币监控' })).toBeVisible();
        await expect(page.getByRole('button', { name: '价格提醒' })).toBeVisible();
    });

    test('应该能切换到传统配置模式并填写表单', async ({ page }) => {
        // 点击传统配置
        await page.getByRole('button', { name: '传统配置' }).click();

        // 填写表单
        await page.getByLabel(/Agent 名称/).fill('测试 Agent');
        await page.getByLabel(/描述/).fill('这是一个测试 Agent');

        // 检查提交按钮
        await expect(page.getByRole('button', { name: '创建 Agent' })).toBeVisible();
    });
});

test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard');
    });

    test('应该显示仪表盘页面', async ({ page }) => {
        await expect(page.getByText('动态数据仪表盘')).toBeVisible();
        await expect(page.getByPlaceholder(/询问你的数据/)).toBeVisible();
    });

    test('应该能输入查询并显示常用查询', async ({ page }) => {
        // 检查常用查询按钮
        await expect(page.getByRole('button', { name: '显示我过去 7 天的收益' })).toBeVisible();

        // 输入查询
        const queryInput = page.getByPlaceholder(/询问你的数据/);
        await queryInput.fill('SOL 价格走势');

        // 点击查询
        await page.getByRole('button', { name: '查询' }).click();
    });
});

test.describe('AI Playground', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/ai-playground');
    });

    test('应该显示 Playground 页面', async ({ page }) => {
        await expect(page.getByText('AI Playground')).toBeVisible();
        await expect(page.getByText('用自然语言创建界面')).toBeVisible();
    });

    test('应该能选择模板', async ({ page }) => {
        // 打开模板选择
        await page.getByRole('combobox').click();

        // 选择一个模板
        await page.getByText('加密货币监控面板').click();

        // 检查描述是否被填充
        const textarea = page.locator('textarea').first();
        await expect(textarea).not.toHaveValue('');
    });
});
