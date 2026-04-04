import { expect, test } from '@playwright/test';

test.describe('AgentM Pro Metaplex A2A interactions', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.clear();
        });
        await page.goto('/app');
        await page.getByTestId('nav-messages').click();
    });

    test('creates delegation, sends A2A message, and settles token payment', async ({ page }) => {
        await expect(page.getByTestId('messages-view')).toBeVisible();
        await page.getByTestId('a2a-delegation-task').fill('Generate collection metadata');
        await page.getByTestId('a2a-delegation-amount').fill('55');
        await page.getByTestId('a2a-delegation-submit').click();

        await expect(page.getByTestId('a2a-delegation-created')).toContainText(
            'Generate collection metadata'
        );
        await expect(page.getByTestId('a2a-settlement-status')).toContainText('in_progress');
        await expect(page.getByTestId('a2a-settlement-wallet')).toBeVisible();

        await page.getByTestId('a2a-chat-input').fill('Task accepted. Working on it now.');
        await page.getByTestId('a2a-chat-send').click();
        await expect(
            page.getByTestId('a2a-chat-panel').getByTestId('a2a-chat-message-content').last()
        ).toHaveText('Task accepted. Working on it now.');

        await page.getByTestId('a2a-settle-button').click();
        await expect(page.getByTestId('a2a-settlement-status')).toContainText('settled');
        await expect(page.getByTestId('a2a-settlement-log')).toContainText('settlement_tx:');
    });
});
