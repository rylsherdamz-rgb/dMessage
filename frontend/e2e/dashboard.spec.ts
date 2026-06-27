import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('should display nav bar', async ({ page }) => {
    await expect(page.locator('nav')).toBeVisible();
  });

  test('should display ConnectWallet button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Connect Wallet' }).first()).toBeVisible();
  });

  test('should display ConnectGate heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Connect Wallet' })).toBeVisible();
    await expect(page.getByText('Authenticate to continue')).toBeVisible();
  });

  test('should have nav links: Chats, Archive, Settings', async ({ page }) => {
    await expect(page.locator('nav').getByRole('link', { name: 'Chats' })).toBeVisible();
    await expect(page.locator('nav').getByRole('link', { name: 'Archive' })).toBeVisible();
    await expect(page.locator('nav').getByRole('link', { name: 'Settings' })).toBeVisible();
  });

  test('should navigate to archive', async ({ page }) => {
    await page.locator('nav').getByRole('link', { name: 'Archive' }).click();
    await expect(page).toHaveURL('/archive');
  });

  test('should navigate to settings', async ({ page }) => {
    await page.locator('nav').getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL('/settings');
  });

  test('should have correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/dMessage/);
  });
});
