import { expect, test } from '@playwright/test';

test.describe('AgentM Pro wallet risk scoring', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.clear();
        });
        await page.goto('/app');
        await page.getByTestId('nav-wallet').click();
    });

    test('runs risk scan and renders factor breakdown', async ({ page }) => {
        await expect(page.getByTestId('wallet-view')).toBeVisible();
        await expect(page.getByTestId('wallet-risk-panel')).toBeVisible();
        await expect(page.getByTestId('whale-feed-panel')).toBeVisible();
        await expect(page.getByTestId('dex-bot-panel')).toBeVisible();
        await expect(page.getByTestId('goldrush-probe-panel')).toBeVisible();
        await expect(page.getByTestId('metaplex-reputation-panel')).toBeVisible();

        await page.getByTestId('wallet-risk-address-input').fill('DemoWalletRiskAddress001');
        await page.getByTestId('wallet-risk-scan-button').click();

        await expect(page.getByTestId('wallet-risk-result')).toBeVisible();
        await expect(page.getByTestId('wallet-risk-score')).not.toHaveText('');
        await expect(page.getByTestId('wallet-risk-level')).not.toHaveText('');
        await expect(page.getByTestId('wallet-risk-factor-token_balances')).toBeVisible();
        await expect(page.getByTestId('wallet-risk-factor-approval_hygiene')).toBeVisible();
        await expect(page.getByTestId('wallet-risk-factor-transaction_history')).toBeVisible();
        await expect(page.getByTestId('wallet-security-alerts')).toBeVisible();

        await page.getByTestId('whale-feed-wallets-input').fill('WhaleWalletA,WhaleWalletB');
        await page.getByTestId('whale-feed-load-button').click();
        await expect(page.getByTestId('whale-feed-summary')).toBeVisible();
        await expect(page.getByTestId('whale-feed-event').first()).toBeVisible();

        await page.getByTestId('dex-bot-pair-input').fill('SOL/USDC');
        await page.getByTestId('dex-bot-generate-button').click();
        await expect(page.getByTestId('dex-bot-result')).toBeVisible();
        await expect(page.getByTestId('dex-bot-gridless-badge')).toBeVisible();
        await expect(page.getByTestId('dex-bot-action')).not.toHaveText('');
        await expect(page.getByTestId('dex-bot-guard')).not.toHaveText('');

        await page.getByTestId('goldrush-probe-button').click();
        await expect(page.getByTestId('goldrush-probe-result')).toBeVisible();
        await expect(page.getByTestId('goldrush-probe-source')).not.toHaveText('');
        await expect(page.getByTestId('metaplex-reputation-empty')).toBeVisible();
    });
});
