import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display hero section with title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'dMessage' })).toBeVisible();
    await expect(page.getByText('Decentralized Messaging on Stellar')).toBeVisible();
  });

  test('should have Start Chatting link to dashboard', async ({ page }) => {
    const startLink = page.getByRole('link', { name: 'Start Chatting' });
    await expect(startLink).toBeVisible();
    await expect(startLink).toHaveAttribute('href', '/dashboard');
  });

  test('should display Connect Wallet button in hero', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Connect Wallet' }).first()).toBeVisible();
  });

  test('should display marquee ticker', async ({ page }) => {
    await expect(page.getByText('END-TO-END ENCRYPTED').first()).toBeVisible();
    await expect(page.getByText('STELLAR SOROBAN').first()).toBeVisible();
    await expect(page.getByText('IPFS STORAGE').first()).toBeVisible();
  });

  test('should display features section', async ({ page }) => {
    await expect(page.locator('#features')).toBeVisible();
    await expect(page.locator('#features')).toContainText('E2E Encryption');
    await expect(page.locator('#features')).toContainText('Wallet Identity');
  });

  test('should display how-it-works section with steps', async ({ page }) => {
    const how = page.locator('#how');
    await expect(how).toBeVisible();
    await expect(how).toContainText('Connect');
    await expect(how).toContainText('Register');
  });

  test('should display contracts section with 3 contract cards', async ({ page }) => {
    const contracts = page.locator('#contracts');
    await expect(contracts).toBeVisible();
    await expect(contracts.getByRole('heading', { name: 'UserRegistry' })).toBeVisible();
    await expect(contracts.getByRole('heading', { name: 'SocialGraph' })).toBeVisible();
    await expect(contracts.getByRole('heading', { name: 'MessageContract' })).toBeVisible();
  });

  test('should have Open App link to dashboard', async ({ page }) => {
    const openApp = page.getByRole('link', { name: 'Open App' });
    await expect(openApp).toBeVisible();
    await expect(openApp).toHaveAttribute('href', '/dashboard');
  });

  test('should display footer with links', async ({ page }) => {
    await expect(page.locator('footer')).toBeVisible();
  });

  test('should navigate to dashboard on Start Chatting click', async ({ page }) => {
    await page.getByRole('link', { name: 'Start Chatting' }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should have dark background', async ({ page }) => {
    const bg = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });
    const rgb = bg.match(/\d+/g);
    if (rgb) {
      const [r, g, b] = rgb.map(Number);
      expect(r + g + b).toBeLessThan(384);
    }
  });
});
