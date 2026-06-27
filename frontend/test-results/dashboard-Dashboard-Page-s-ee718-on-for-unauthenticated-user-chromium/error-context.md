# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> Dashboard Page >> should display ConnectWallet button for unauthenticated user
- Location: e2e/dashboard.spec.ts:13:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button, a').filter({ hasText: 'Connect Wallet' })
Expected: visible
Error: strict mode violation: locator('button, a').filter({ hasText: 'Connect Wallet' }) resolved to 2 elements:
    1) <button tabindex="0" class="font-mono text-sm uppercase tracking-wider px-8 py-4 font-bold transition-colors neobrutalist bg-[var(--accent)] text-black hover:bg-[var(--accent-dim)] disabled:opacity-40">Connect Wallet</button> aka getByRole('navigation').getByRole('button', { name: 'Connect Wallet' })
    2) <button tabindex="0" class="font-mono text-sm uppercase tracking-wider px-8 py-4 font-bold transition-colors neobrutalist bg-[var(--accent)] text-black hover:bg-[var(--accent-dim)] disabled:opacity-40">Connect Wallet</button> aka locator('section').getByRole('button', { name: 'Connect Wallet' })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('button, a').filter({ hasText: 'Connect Wallet' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - navigation [ref=e3]:
      - link "dMessage" [ref=e4] [cursor=pointer]:
        - /url: /
        - generic [ref=e6]: dMessage
      - generic [ref=e7]:
        - generic [ref=e8]:
          - link "Chats" [ref=e9] [cursor=pointer]:
            - /url: /dashboard
            - img [ref=e10]
            - generic [ref=e13]: Chats
          - link "Archive" [ref=e14] [cursor=pointer]:
            - /url: /archive
            - img [ref=e15]
            - generic [ref=e18]: Archive
          - link "Settings" [ref=e19] [cursor=pointer]:
            - /url: /settings
            - img [ref=e20]
            - generic [ref=e23]: Settings
        - button "Connect Wallet" [ref=e24]
    - generic [ref=e25]:
      - img [ref=e27]
      - generic [ref=e30]:
        - heading "Connect Wallet" [level=1] [ref=e31]
        - paragraph [ref=e32]: Authenticate to start messaging
      - button "Connect Wallet" [ref=e33]
  - button "Open Next.js Dev Tools" [ref=e39] [cursor=pointer]:
    - img [ref=e40]
  - alert [ref=e43]
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
> 14 |     await expect(page.locator('button, a').filter({ hasText: 'Connect Wallet' })).toBeVisible();
     |                                                                                   ^ Error: expect(locator).toBeVisible() failed
  15 |   });
  16 | 
  17 |   test('should display ConnectGate when not connected', async ({ page }) => {
  18 |     await expect(page.locator('text=Connect your wallet')).toBeVisible();
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