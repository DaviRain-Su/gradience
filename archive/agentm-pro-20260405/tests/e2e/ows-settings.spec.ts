import { expect, test } from '@playwright/test';

test.describe('AgentM Pro OWS settings', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.clear();
        });
        await page.goto('/app');
        await page.getByTestId('nav-settings').click();
    });

    test('shows ows panel and connection error when provider is missing', async ({ page }) => {
        await expect(page.getByTestId('settings-ows-panel')).toBeVisible();
        await expect(page.getByTestId('ows-connect')).toBeVisible();
        await expect(page.getByTestId('ows-sign-demo')).toBeDisabled();

        await page.getByTestId('ows-connect').click();
        await expect(page.getByText('No OWS-compatible wallet found')).toBeVisible();
    });

    test('checks counterparty reputation and shows risk warning', async ({ page }) => {
        await page.route('**/api/agents/**/reputation', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    avg_score: 52,
                    completed: 1,
                    total_applied: 8,
                    win_rate: 0.12,
                    total_earned: 50000000,
                }),
            });
        });

        await page.getByTestId('counterparty-address-input').fill('demo-agent-low-score');
        await page.getByTestId('counterparty-check-button').click();

        await expect(page.getByTestId('counterparty-reputation-result')).toBeVisible();
        await expect(page.getByTestId('counterparty-trust-score')).not.toHaveText('');
        await expect(page.getByTestId('counterparty-trust-level')).not.toHaveText('');
        await expect(page.getByTestId('counterparty-trust-source')).not.toHaveText('');
    });
});
