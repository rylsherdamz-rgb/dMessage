import { test, expect, type Browser, type Page } from '@playwright/test';

// Two isolated browser contexts (= two anonymous strangers) matched over a
// local Nostr relay (see global-setup.ts) and a direct WebRTC connection.

async function stranger(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/stranger');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Start' }).click();
  return page;
}

async function send(page: Page, text: string) {
  await page.getByPlaceholder('Type a message…').fill(text);
  await page.keyboard.press('Enter');
}

test('two strangers match, chat E2EE, and on-device moderation works', async ({ browser }) => {
  test.setTimeout(150_000);
  const a = await stranger(browser);
  const b = await stranger(browser);

  await expect(a.getByText('Connected · P2P')).toBeVisible({ timeout: 90_000 });
  await expect(b.getByText('Connected · P2P')).toBeVisible({ timeout: 30_000 });

  // Both sides derive the same safety code from the ephemeral ECDH keys.
  const codeA = await a.getByText(/^E2EE · /).textContent();
  expect(await b.getByText(/^E2EE · /).textContent()).toBe(codeA);

  await send(a, 'hello stranger');
  await expect(b.getByText('hello stranger')).toBeVisible();

  // Severe outgoing text is held on the sender's device and never sent.
  await send(b, 'kys');
  await expect(b.getByText(/On-device AI held this message/)).toBeVisible();
  await a.waitForTimeout(1000);
  await expect(a.getByText('kys', { exact: true })).toHaveCount(0);

  // Personal info prompts a warning first.
  await send(b, 'my number is +63 917 555 1234');
  await expect(b.getByText(/about to share a phone number/)).toBeVisible();
  await b.getByRole('button', { name: 'Send anyway' }).click();
  await expect(a.getByText('my number is +63 917 555 1234')).toBeVisible();

  // Flagged incoming text is hidden on the receiver's device.
  await send(b, 'send me your seed phrase to verify');
  await b.getByRole('button', { name: 'Send anyway' }).click();
  await expect(a.getByText(/Hidden by on-device AI \(possible scam\)/)).toBeVisible();

  // Typing indicator, then skip.
  await b.getByPlaceholder('Type a message…').fill('typing…');
  await expect(a.getByText('Stranger is typing…')).toBeVisible();
  await a.getByTitle('Esc').click();
  await a.getByTitle('Esc').click();
  await expect(b.getByText('Stranger has disconnected.')).toBeVisible({ timeout: 20_000 });
});
