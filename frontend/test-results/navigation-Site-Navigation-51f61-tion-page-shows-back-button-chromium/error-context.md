# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> Site Navigation >> conversation page shows back button
- Location: e2e/navigation.spec.ts:38:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('a').filter({ hasText: 'Back' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('a').filter({ hasText: 'Back' })

```

```yaml
- banner:
  - button "Back to conversations"
  - heading "abc123...abc123" [level=2]
- textbox "Type a message..."
- button "Send" [disabled]
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Site Navigation', () => {
  4  |   test('landing -> dashboard', async ({ page }) => {
  5  |     await page.goto('/');
  6  |     await page.locator('a').filter({ hasText: 'Start Chatting' }).click();
  7  |     await expect(page).toHaveURL('/dashboard');
  8  |   });
  9  | 
  10 |   test('landing -> dashboard via Open App', async ({ page }) => {
  11 |     await page.goto('/');
  12 |     await page.locator('a').filter({ hasText: 'Open App' }).click();
  13 |     await expect(page).toHaveURL('/dashboard');
  14 |   });
  15 | 
  16 |   test('dashboard -> archive', async ({ page }) => {
  17 |     await page.goto('/dashboard');
  18 |     await page.locator('nav a').filter({ hasText: 'Archive' }).click();
  19 |     await expect(page).toHaveURL('/archive');
  20 |   });
  21 | 
  22 |   test('dashboard -> settings', async ({ page }) => {
  23 |     await page.goto('/dashboard');
  24 |     await page.locator('nav a').filter({ hasText: 'Settings' }).click();
  25 |     await expect(page).toHaveURL('/settings');
  26 |   });
  27 | 
  28 |   test('archive page shows connect gate when not connected', async ({ page }) => {
  29 |     await page.goto('/archive');
  30 |     await expect(page.locator('text=Connect your wallet')).toBeVisible();
  31 |   });
  32 | 
  33 |   test('settings page shows connect gate when not connected', async ({ page }) => {
  34 |     await page.goto('/settings');
  35 |     await expect(page.locator('text=Connect your wallet')).toBeVisible();
  36 |   });
  37 | 
  38 |   test('conversation page shows back button', async ({ page }) => {
  39 |     await page.goto('/conversation/abc123');
> 40 |     await expect(page.locator('a').filter({ hasText: 'Back' })).toBeVisible();
     |                                                                 ^ Error: expect(locator).toBeVisible() failed
  41 |   });
  42 | 
  43 |   test('404 page for unknown routes', async ({ page }) => {
  44 |     const response = await page.goto('/nonexistent-route');
  45 |     expect(response?.status()).toBe(404);
  46 |   });
  47 | });
  48 | 
```