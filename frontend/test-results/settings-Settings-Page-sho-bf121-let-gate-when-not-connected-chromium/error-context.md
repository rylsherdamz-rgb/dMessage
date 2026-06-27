# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings.spec.ts >> Settings Page >> should have ConnectWallet gate when not connected
- Location: e2e/settings.spec.ts:13:7

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
- paragraph: Authenticate to manage your profile
- button "Connect Wallet"
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Settings Page', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/settings');
  6  |     await page.waitForLoadState('networkidle');
  7  |   });
  8  | 
  9  |   test('should display settings heading', async ({ page }) => {
  10 |     await expect(page.locator('h1, h2').filter({ hasText: 'Settings' })).toBeVisible();
  11 |   });
  12 | 
  13 |   test('should have ConnectWallet gate when not connected', async ({ page }) => {
> 14 |     await expect(page.locator('text=Connect your wallet')).toBeVisible();
     |                                                            ^ Error: expect(locator).toBeVisible() failed
  15 |   });
  16 | 
  17 |   test('should show network as Stellar Testnet', async ({ page }) => {
  18 |     // Even when not connected, network info is visible
  19 |     await expect(page.locator('text=Stellar Testnet').or(page.locator('text=Connect your wallet'))).toBeVisible();
  20 |   });
  21 | });
  22 | 
```