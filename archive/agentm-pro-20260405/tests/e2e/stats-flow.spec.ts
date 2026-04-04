import { expect, test } from '@playwright/test';

test.describe('AgentM Pro stats flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.clear();
        });
        await page.goto('/app');
    });

    test('shows stats widgets and fallback data', async ({ page }) => {
        await page.getByTestId('nav-stats').click();

        await expect(page.getByTestId('stats-view')).toBeVisible();
        await expect(page.getByTestId('reputation-score-card')).toBeVisible();
        await expect(page.getByTestId('revenue-chart')).toBeVisible();
        await expect(page.getByTestId('stats-data-source-value')).toHaveText('demo');
    });

    test('uses live data when reputation endpoint is available', async ({ page }) => {
        await page.route('**/api/agents/**/reputation', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    avg_score: 91,
                    completed: 42,
                    total_applied: 48,
                    win_rate: 0.875,
                    total_earned: 12300000000,
                }),
            });
        });

        await page.getByTestId('nav-stats').click();

        await expect(page.getByTestId('stats-data-source-value')).toHaveText('live');
        await expect(page.getByTestId('stats-completed-value')).toHaveText('42');
        await expect(page.getByTestId('reputation-score-value')).toHaveText('91');
        await expect(page.getByTestId('stats-total-earned-value')).toHaveText('12.3000 SOL');
    });
});
