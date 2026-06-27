import { test, expect } from '@playwright/test';

test.describe('Site Navigation', () => {
  test('landing -> dashboard', async ({ page }) => {
    await page.goto('/');
    await page.locator('a').filter({ hasText: 'Start Chatting' }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('landing -> dashboard via Open App', async ({ page }) => {
    await page.goto('/');
    await page.locator('a').filter({ hasText: 'Open App' }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('dashboard -> archive', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('nav a').filter({ hasText: 'Archive' }).click();
    await expect(page).toHaveURL('/archive');
  });

  test('dashboard -> settings', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('nav a').filter({ hasText: 'Settings' }).click();
    await expect(page).toHaveURL('/settings');
  });

  test('archive page shows connect gate when not connected', async ({ page }) => {
    await page.goto('/archive');
    await expect(page.locator('text=Connect your wallet')).toBeVisible();
  });

  test('settings page shows connect gate when not connected', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('text=Connect your wallet')).toBeVisible();
  });

  test('conversation page shows back button', async ({ page }) => {
    await page.goto('/conversation/abc123');
    await expect(page.locator('a').filter({ hasText: 'Back' })).toBeVisible();
  });

  test('404 page for unknown routes', async ({ page }) => {
    const response = await page.goto('/nonexistent-route');
    expect(response?.status()).toBe(404);
  });
});
