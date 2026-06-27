# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> Dashboard Page >> should display ConnectGate when not connected
- Location: e2e/dashboard.spec.ts:17:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Connect your wallet')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=Connect your wallet')

```

```yaml
- navigation:
  - link "dMessage":
    - /url: /
  - link "Chats":
    - /url: /dashboard
  - link "Archive":
    - /url: /archive
  - link "Settings":
    - /url: /settings
  - button "Connect Wallet"
- heading "Connect Wallet" [level=1]
- paragraph: Authenticate to start messaging
- button "Connect Wallet"
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Dashboard Page', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/dashboard');
  6  |     await page.waitForLoadState('networkidle');
  7  |   });
  8  | 
  9  |   test('should display nav bar', async ({ page }) => {
  10 |     await expect(page.locator('nav')).toBeVisible();
  11 |   });
  12 | 
  13 |   test('should display ConnectWallet button for unauthenticated user', async ({ page }) => {
  14 |     await expect(page.locator('button, a').filter({ hasText: 'Connect Wallet' })).toBeVisible();
  15 |   });
  16 | 
  17 |   test('should display ConnectGate when not connected', async ({ page }) => {
> 18 |     await expect(page.locator('text=Connect your wallet')).toBeVisible();
     |                                                            ^ Error: expect(locator).toBeVisible() failed
  19 |   });
  20 | 
  21 |   test('should have nav links: Chats, Archive, Settings', async ({ page }) => {
  22 |     await expect(page.locator('nav a').filter({ hasText: 'Chats' })).toBeVisible();
  23 |     await expect(page.locator('nav a').filter({ hasText: 'Archive' })).toBeVisible();
  24 |     await expect(page.locator('nav a').filter({ hasText: 'Settings' })).toBeVisible();
  25 |   });
  26 | 
  27 |   test('should navigate to archive', async ({ page }) => {
  28 |     await page.locator('nav a').filter({ hasText: 'Archive' }).click();
  29 |     await expect(page).toHaveURL('/archive');
  30 |   });
  31 | 
  32 |   test('should navigate to settings', async ({ page }) => {
  33 |     await page.locator('nav a').filter({ hasText: 'Settings' }).click();
  34 |     await expect(page).toHaveURL('/settings');
  35 |   });
  36 | 
  37 |   test('should have correct page title', async ({ page }) => {
  38 |     await expect(page).toHaveTitle(/dMessage/);
  39 |   });
  40 | });
  41 | 
```