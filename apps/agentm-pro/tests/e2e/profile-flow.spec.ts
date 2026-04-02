import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

test.describe('AgentM Pro profile flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.clear();
        });
        await page.goto('/app');
    });

    test('can create and publish a profile', async ({ page }) => {
        await page.getByTestId('nav-profiles').click();
        await createProfile(page, {
            name: 'E2E Agent',
            description: 'AgentM Pro end-to-end profile creation test.',
            version: '1.2.3',
        });
        await expect(page.getByTestId('profile-card-name').first()).toHaveText('E2E Agent');

        await page.getByTestId('profile-publish-button').first().click();
        await expect(page.getByTestId('profile-status-badge').first()).toHaveText('published');
    });

    test('can edit, deprecate, and delete a profile with toasts', async ({ page }) => {
        await page.getByTestId('nav-profiles').click();
        await createProfile(page, {
            name: 'Lifecycle Agent',
            description: 'Initial lifecycle profile description.',
            version: '1.0.0',
        });
        await expect(page.getByTestId('toast-message').last()).toContainText('Profile created.');

        await page.getByTestId('profile-edit-button').first().click();
        await page.getByTestId('profile-name-input').fill('Lifecycle Agent Updated');
        await page.getByTestId('profile-submit-button').click();
        await expect(page.getByTestId('profile-card-name').first()).toHaveText('Lifecycle Agent Updated');
        await expect(page.getByTestId('toast-message').last()).toContainText('Profile updated.');

        await page.getByTestId('profile-publish-button').first().click();
        await expect(page.getByTestId('profile-status-badge').first()).toHaveText('published');
        await page.getByTestId('profile-deprecate-button').first().click();
        await expect(page.getByTestId('profile-status-badge').first()).toHaveText('deprecated');
        await expect(page.getByTestId('toast-message').last()).toContainText('Deprecated Lifecycle Agent Updated');

        await page.getByTestId('profile-delete-button').first().click();
        await expect(page.getByTestId('profiles-empty-state')).toBeVisible();
        await expect(page.getByTestId('toast-message').last()).toContainText('Deleted Lifecycle Agent Updated');
    });
});

async function createProfile(
    page: Page,
    input: { name: string; description: string; version: string }
) {
    await page.getByTestId('create-profile-button').click();
    await page.getByTestId('profile-name-input').fill(input.name);
    await page.getByTestId('profile-description-input').fill(input.description);
    await page.getByTestId('profile-version-input').fill(input.version);
    await page.getByTestId('profile-capability-name-input').fill('text-generation');
    await page.getByTestId('profile-capability-description-input').fill('Generate high quality text');
    await page.getByTestId('profile-pricing-amount-input').fill('2000000');
    await page.getByTestId('profile-submit-button').click();
}
