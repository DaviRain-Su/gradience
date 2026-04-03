import { expect, test } from '@playwright/test';

test.describe('AgentM Pro social reputation integration', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.clear();
        });

        await page.route('**/api/tasks**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        task_id: 1,
                        poster: 'agent-alpha',
                        judge: 'judge-1',
                        judge_mode: 'designated',
                        reward: 100,
                        mint: 'SOL',
                        min_stake: 1,
                        state: 'completed',
                        category: 1,
                        eval_ref: 'cid://eval-a',
                        deadline: 1,
                        judge_deadline: 2,
                        submission_count: 2,
                        winner: 'agent-alpha',
                        created_at: 1,
                        slot: 1,
                    },
                    {
                        task_id: 2,
                        poster: 'agent-beta',
                        judge: 'judge-2',
                        judge_mode: 'designated',
                        reward: 100,
                        mint: 'SOL',
                        min_stake: 1,
                        state: 'completed',
                        category: 2,
                        eval_ref: 'cid://eval-b',
                        deadline: 1,
                        judge_deadline: 2,
                        submission_count: 1,
                        winner: 'agent-beta',
                        created_at: 2,
                        slot: 2,
                    },
                ]),
            });
        });

        await page.route('**/api/agents/*/profile', async (route) => {
            const url = new URL(route.request().url());
            const pubkey = url.pathname.split('/')[3];
            const payload =
                pubkey === 'agent-alpha'
                    ? {
                          agent: 'agent-alpha',
                          display_name: 'Alpha Agent',
                          bio: 'High reputation strategy agent',
                          links: { website: 'https://alpha.test' },
                          onchain_ref: 'cid://alpha',
                          publish_mode: 'manual',
                          updated_at: 1,
                      }
                    : pubkey === 'agent-beta'
                      ? {
                            agent: 'agent-beta',
                            display_name: 'Beta Agent',
                            bio: 'Emerging market participant',
                            links: { website: 'https://beta.test' },
                            onchain_ref: 'cid://beta',
                            publish_mode: 'manual',
                            updated_at: 2,
                        }
                      : null;

            if (!payload) {
                await route.fulfill({ status: 404, body: 'not_found' });
                return;
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(payload),
            });
        });

        await page.route('**/api/agents/*/reputation', async (route) => {
            const url = new URL(route.request().url());
            const pubkey = url.pathname.split('/')[3];
            const payload =
                pubkey === 'agent-alpha'
                    ? {
                          agent: 'agent-alpha',
                          global_avg_score: 9100,
                          global_win_rate: 8600,
                          global_completed: 22,
                          global_total_applied: 26,
                          total_earned: 100000,
                          updated_slot: 1,
                      }
                    : pubkey === 'agent-beta'
                      ? {
                            agent: 'agent-beta',
                            global_avg_score: 7300,
                            global_win_rate: 6400,
                            global_completed: 8,
                            global_total_applied: 15,
                            total_earned: 50000,
                            updated_slot: 2,
                        }
                      : null;
            if (!payload) {
                await route.fulfill({ status: 404, body: 'not_found' });
                return;
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(payload),
            });
        });

        await page.goto('/app');
        await page.getByTestId('nav-discover').click();
    });

    test('shows reputation ranking, trust score and verified badge', async ({ page }) => {
        await expect(page.getByTestId('discover-view')).toBeVisible();
        await expect(page.getByTestId('discover-reputation-source')).toHaveText('live');
        await expect(page.getByTestId('discover-ranking-1')).toContainText('Alpha Agent');
        await expect(page.getByTestId('social-verified-1')).toBeVisible();
        await expect(page.getByTestId('social-trust-1')).toBeVisible();

        await page.getByPlaceholder('Search by address, alice.sol, or vitalik.eth').fill('agent-beta');
        await page.getByRole('button', { name: 'Search' }).click();
        await expect(page.getByTestId('discover-search-result')).toContainText('Beta Agent');
        await expect(page.getByTestId('discover-search-result')).toContainText('Trust:');
    });
});
