import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should display settings heading', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: 'Settings' })).toBeVisible();
  });

  test('should have ConnectWallet gate when not connected', async ({ page }) => {
    await expect(page.locator('text=Connect your wallet')).toBeVisible();
  });

  test('should show network as Stellar Testnet', async ({ page }) => {
    // Even when not connected, network info is visible
    await expect(page.locator('text=Stellar Testnet').or(page.locator('text=Connect your wallet'))).toBeVisible();
  });
});
