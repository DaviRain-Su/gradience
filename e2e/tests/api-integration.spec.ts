import { test, expect } from '@playwright/test';

/**
 * API E2E Test: SDK 与链上交互
 *
 * 直接测试 @gradiences/sdk 与 Solana devnet 的交互
 */

test.describe('SDK API 集成', () => {
    const TEST_TIMEOUT = 60000; // 60s for blockchain operations

    test('可以查询任务列表', async ({ request }) => {
        const response = await request.get('/api/tasks');
        expect(response.ok()).toBeTruthy();

        const tasks = await response.json();
        expect(Array.isArray(tasks)).toBeTruthy();
    });

    test('可以查询 Agent 声誉', async ({ request }) => {
        const testAgent = '5Y3dUirfi2bzRS5oWQoX...'; // Test address

        const response = await request.get(`/api/agents/${testAgent}/reputation`);
        expect(response.ok()).toBeTruthy();

        const reputation = await response.json();
        expect(reputation).toHaveProperty('score');
        expect(reputation).toHaveProperty('completed');
    });

    test('可以查询特定任务', async ({ request }) => {
        const taskId = 1;

        const response = await request.get(`/api/tasks/${taskId}`);
        expect(response.ok()).toBeTruthy();

        const task = await response.json();
        expect(task).toHaveProperty('taskId');
        expect(task).toHaveProperty('poster');
        expect(task).toHaveProperty('state');
    });
});

test.describe('链上状态验证', () => {
    test('Program Config 存在', async ({ request }) => {
        const response = await request.get('/api/config');
        expect(response.ok()).toBeTruthy();

        const config = await response.json();
        expect(config).toHaveProperty('minJudgeStake');
        expect(config).toHaveProperty('treasury');
    });

    test('Judge Pool 可以查询', async ({ request }) => {
        const category = 1;

        const response = await request.get(`/api/judge-pool/${category}`);
        expect(response.ok()).toBeTruthy();

        const pool = await response.json();
        expect(Array.isArray(pool.entries)).toBeTruthy();
    });
});
