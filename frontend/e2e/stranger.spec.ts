import { test, expect } from '@playwright/test';

test.describe('Stranger Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/stranger');
  });

  test('shows the setup screen without requiring a wallet', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Talk to a stranger' })).toBeVisible();
    await expect(page.getByPlaceholder('music, stellar, anime')).toBeVisible();
  });

  test('Start stays disabled until the 18+ box is ticked', async ({ page }) => {
    const start = page.getByRole('button', { name: 'Start' });
    await expect(start).toBeDisabled();
    await page.getByRole('checkbox').check();
    await expect(start).toBeEnabled();
  });

  test('exposes on-device safety toggles', async ({ page }) => {
    for (const name of ['Video chat', 'On-device AI moderation', 'AI video & image safety', 'Auto-next']) {
      await expect(page.getByRole('switch', { name: new RegExp(name, 'i') })).toBeVisible();
    }
  });

  test('toggles persist locally', async ({ page }) => {
    const autoNext = page.getByRole('switch', { name: /Auto-next/i });
    const before = await autoNext.getAttribute('aria-checked');
    await autoNext.click();
    await page.reload();
    await expect(page.getByRole('switch', { name: /Auto-next/i })).not.toHaveAttribute('aria-checked', before!);
  });

  test('is reachable from the nav', async ({ page }) => {
    await page.goto('/settings');
    await page.getByTitle('Strangers').first().click();
    await expect(page).toHaveURL(/\/stranger$/);
  });
});

test.describe('Safety settings', () => {
  test('are available without connecting a wallet', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /Safety & Privacy/i })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'AI text moderation' })).toBeVisible();
  });
});
