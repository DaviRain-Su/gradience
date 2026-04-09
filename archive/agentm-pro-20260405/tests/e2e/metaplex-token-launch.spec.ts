import { expect, test } from '@playwright/test';

test.describe('AgentM Pro Metaplex token launch', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.clear();
        });
        await page.goto('/app');
        await page.getByTestId('nav-wallet').click();
    });

    test('prepares genesis token launch plan and executes demo launch', async ({ page }) => {
        await expect(page.getByTestId('wallet-view')).toBeVisible();
        await expect(page.getByTestId('metaplex-token-launch-panel')).toBeVisible();

        await page.getByTestId('token-launch-name-input').fill('Gridless Agent Token');
        await page.getByTestId('token-launch-symbol-input').fill('GLAT');
        await page.getByTestId('token-launch-uri-input').fill('https://gradience.xyz/gridless-token.json');

        await page.getByTestId('token-launch-plan-button').click();
        await expect(page.getByTestId('token-launch-plan-result')).toContainText('Gridless Agent Token');

        await page.getByTestId('token-launch-execute-button').click();
        await expect(page.getByTestId('token-launch-result')).toBeVisible();
        await expect(page.getByTestId('token-launch-mint')).not.toHaveText('');
        await expect(page.getByTestId('token-launch-tx')).not.toHaveText('');

        await expect(page.getByTestId('token-utility-staking-weight')).not.toHaveText('');
        await expect(page.getByTestId('token-utility-service-fee')).not.toHaveText('');
        await expect(page.getByTestId('token-utility-governance-power')).not.toHaveText('');
    });
});
