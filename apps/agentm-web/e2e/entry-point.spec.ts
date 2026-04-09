import { test, expect } from '@playwright/test';

test.describe('Entry Points', () => {
    test('Landing page should render correctly', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => {
            const text = err.message;
            if (text.includes('Failed to fetch')) return;
            errors.push(text);
        });
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                const text = msg.text();
                // Ignore CORS / network errors from external APIs
                if (
                    text.includes('CORS policy') ||
                    text.includes('Failed to load resource') ||
                    text.includes('Failed to fetch')
                )
                    return;
                errors.push(text);
            }
        });

        await page.goto('/');
        await page.waitForTimeout(3000);

        // Use span locator to avoid matching hidden <title> text
        await expect(page.locator('span').filter({ hasText: 'AgentM' }).first()).toBeVisible();
        await expect(page.getByRole('link', { name: /Launch App/i })).toBeVisible();
        await expect(page.getByText('Find Your Perfect AI Companion')).toBeVisible();
        await expect(page.getByRole('link', { name: /Start Matching Now/i })).toBeVisible();

        expect(errors).toEqual([]);
    });

    test('App page should show login screen when not authenticated', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => {
            const text = err.message;
            if (text.includes('Failed to fetch')) return;
            errors.push(text);
        });
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                const text = msg.text();
                if (
                    text.includes('CORS policy') ||
                    text.includes('Failed to load resource') ||
                    text.includes('Failed to fetch')
                )
                    return;
                errors.push(text);
            }
        });

        await page.goto('/app');
        await page.waitForTimeout(3000);

        // LoginScreen renders AgentM as an <h1>
        await expect(page.getByRole('heading', { name: 'AgentM' })).toBeVisible();
        await expect(page.getByText(/Connect with Google, Twitter, or Discord/i)).toBeVisible();
        await expect(page.getByRole('link', { name: /Back to home/i })).toBeVisible();

        expect(errors).toEqual([]);
    });
});
