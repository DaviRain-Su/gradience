import { expect, test } from '@playwright/test';

test.describe('AgentM Pro mobile navigation', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.clear();
        });
        await page.goto('/app');
    });

    test('opens and closes mobile drawer and navigates to stats', async ({ page }) => {
        await page.getByTestId('mobile-menu-button').click();
        await expect(page.getByTestId('mobile-sidebar')).toBeVisible();

        await page.getByTestId('mobile-sidebar').getByTestId('nav-stats').click();
        await expect(page.getByTestId('mobile-sidebar')).not.toBeVisible();
        await expect(page.getByTestId('stats-view')).toBeVisible();

        await page.getByTestId('mobile-menu-button').click();
        await expect(page.getByTestId('mobile-sidebar')).toBeVisible();
        await page.getByTestId('mobile-sidebar-close').click();
        await expect(page.getByTestId('mobile-sidebar')).not.toBeVisible();
    });
});
