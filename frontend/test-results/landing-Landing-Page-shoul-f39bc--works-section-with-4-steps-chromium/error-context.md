# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: landing.spec.ts >> Landing Page >> should display how-it-works section with 4 steps
- Location: e2e/landing.spec.ts:39:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 4
Received: 0
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - navigation [ref=e8]:
        - link "dMessage" [ref=e9] [cursor=pointer]:
          - /url: /
          - generic [ref=e11]: dMessage
        - generic [ref=e12]:
          - link "Features" [ref=e13] [cursor=pointer]:
            - /url: "#features"
          - link "How" [ref=e14] [cursor=pointer]:
            - /url: "#how"
          - link "Contracts" [ref=e15] [cursor=pointer]:
            - /url: "#contracts"
          - link "App" [ref=e16] [cursor=pointer]:
            - /url: /dashboard
      - generic [ref=e17]:
        - heading "dMessage" [level=1] [ref=e35]
        - paragraph [ref=e37]:
          - text: Censorship-resistant messaging
          - text: you actually own
        - generic [ref=e38]:
          - link "Start Chatting" [ref=e39] [cursor=pointer]:
            - /url: /dashboard
            - text: Start Chatting
            - img [ref=e40]
          - button "Connect Wallet" [ref=e42]
      - link "Scroll to features" [ref=e43] [cursor=pointer]:
        - /url: "#features"
        - generic [ref=e45]: Scroll
    - generic [ref=e48]:
      - generic [ref=e49]:
        - text: END-TO-END ENCRYPTED
        - img [ref=e50]
      - generic [ref=e53]:
        - text: STELLAR SOROBAN
        - img [ref=e54]
      - generic [ref=e57]:
        - text: IPFS STORAGE
        - img [ref=e58]
      - generic [ref=e61]:
        - text: CENSORSHIP-RESISTANT
        - img [ref=e62]
      - generic [ref=e65]:
        - text: X25519 · AES-GCM-256
        - img [ref=e66]
      - generic [ref=e69]:
        - text: YOU OWN YOUR KEYS
        - img [ref=e70]
      - generic [ref=e73]:
        - text: NO MIDDLEMEN
        - img [ref=e74]
      - generic [ref=e77]:
        - text: OPEN SOURCE
        - img [ref=e78]
      - generic [ref=e81]:
        - text: END-TO-END ENCRYPTED
        - img [ref=e82]
      - generic [ref=e85]:
        - text: STELLAR SOROBAN
        - img [ref=e86]
      - generic [ref=e89]:
        - text: IPFS STORAGE
        - img [ref=e90]
      - generic [ref=e93]:
        - text: CENSORSHIP-RESISTANT
        - img [ref=e94]
      - generic [ref=e97]:
        - text: X25519 · AES-GCM-256
        - img [ref=e98]
      - generic [ref=e101]:
        - text: YOU OWN YOUR KEYS
        - img [ref=e102]
      - generic [ref=e105]:
        - text: NO MIDDLEMEN
        - img [ref=e106]
      - generic [ref=e109]:
        - text: OPEN SOURCE
        - img [ref=e110]
    - generic [ref=e113]:
      - generic [ref=e114]:
        - generic [ref=e117]: Why dMessage
        - heading "Private by default. Yours by design." [level=2] [ref=e118]:
          - text: Private by default.
          - text: Yours by design.
      - generic [ref=e119]:
        - article [ref=e121]:
          - generic [ref=e122]:
            - img [ref=e123]
            - generic [ref=e126]: "01"
          - heading "End-to-End Encrypted" [level=3] [ref=e127]
          - paragraph [ref=e128]: X25519 ECDH key exchange with AES-GCM-256. Messages are sealed client-side — only you and the recipient hold the keys.
        - article [ref=e130]:
          - generic [ref=e131]:
            - img [ref=e132]
            - generic [ref=e135]: "02"
          - heading "Wallet Identity" [level=3] [ref=e136]
          - paragraph [ref=e137]: No emails, no passwords. Your Stellar wallet is your identity. Connect Freighter, Albedo, or any Wallet Kit signer.
        - article [ref=e139]:
          - generic [ref=e140]:
            - img [ref=e141]
            - generic [ref=e144]: "03"
          - heading "Decentralized Storage" [level=3] [ref=e145]
          - paragraph [ref=e146]: Encrypted blobs live on IPFS, message hashes and metadata on-chain. No central server to seize, censor, or shut down.
        - article [ref=e148]:
          - generic [ref=e149]:
            - img [ref=e150]
            - generic [ref=e153]: "04"
          - heading "On-Chain Integrity" [level=3] [ref=e154]
          - paragraph [ref=e155]: Every message hash is anchored to Soroban. Tamper-evident, ordered, and verifiable without trusting any intermediary.
        - article [ref=e157]:
          - generic [ref=e158]:
            - img [ref=e159]
            - generic [ref=e161]: "05"
          - heading "Low Gas Costs" [level=3] [ref=e162]
          - paragraph [ref=e163]: A read-heavy storage pattern keeps writes cheap. Only hashes hit the chain — the heavy payload stays off-chain.
        - article [ref=e165]:
          - generic [ref=e166]:
            - img [ref=e167]
            - generic [ref=e171]: "06"
          - heading "Fully Open Source" [level=3] [ref=e172]
          - paragraph [ref=e173]: Auditable contracts and frontend, end to end. Verify the cryptography yourself — trust the code, not a company.
    - generic [ref=e175]:
      - generic [ref=e176]:
        - generic [ref=e179]: How it works
        - heading "Four steps from wallet to whisper." [level=2] [ref=e180]:
          - text: Four steps from
          - text: wallet to whisper.
      - generic [ref=e181]:
        - generic [ref=e183]:
          - text: "01"
          - heading "Connect" [level=3] [ref=e184]
          - paragraph [ref=e185]: Link your Stellar wallet. Your address becomes your identity — no signup, no server-side account.
          - img [ref=e186]
        - generic [ref=e189]:
          - text: "02"
          - heading "Register" [level=3] [ref=e190]
          - paragraph [ref=e191]: Publish your X25519 public key to the UserRegistry contract so others can encrypt messages to you.
          - img [ref=e192]
        - generic [ref=e195]:
          - text: "03"
          - heading "Encrypt" [level=3] [ref=e196]
          - paragraph [ref=e197]: Messages are sealed in your browser with a shared secret derived via ECDH, then pinned to IPFS.
          - img [ref=e198]
        - generic [ref=e201]:
          - text: "04"
          - heading "Anchor" [level=3] [ref=e202]
          - paragraph [ref=e203]: The content hash is written to Soroban, ordered within your conversation. Tamper-evident, forever.
    - generic [ref=e204]:
      - generic [ref=e205]:
        - generic [ref=e208]: On-chain
        - heading "Three contracts. Zero middlemen." [level=2] [ref=e209]:
          - text: Three contracts.
          - text: Zero middlemen.
        - paragraph [ref=e210]: The entire protocol runs on three interlocking Soroban smart contracts, deployed to the Stellar network and auditable by anyone.
      - generic [ref=e211]:
        - article [ref=e213]:
          - generic [ref=e219]: Identity
          - generic [ref=e220]:
            - heading "UserRegistry" [level=3] [ref=e221]
            - paragraph [ref=e222]: "Stores user profiles: usernames, X25519 encryption public keys, and IPFS metadata links."
            - generic [ref=e223]:
              - code [ref=e224]: fn register_user()
              - code [ref=e225]: fn get_user()
        - article [ref=e227]:
          - generic [ref=e233]: Conversations
          - generic [ref=e234]:
            - heading "SocialGraph" [level=3] [ref=e235]
            - paragraph [ref=e236]: Derives deterministic conversation IDs (SHA-256 of sorted addresses) and tracks per-user threads.
            - generic [ref=e237]:
              - code [ref=e238]: fn ensure_conversation()
              - code [ref=e239]: fn get_user_conversations()
        - article [ref=e241]:
          - generic [ref=e247]: Messages
          - generic [ref=e248]:
            - heading "MessageContract" [level=3] [ref=e249]
            - paragraph [ref=e250]: Anchors ordered message hashes per conversation with cheap, paginated retrieval.
            - generic [ref=e251]:
              - code [ref=e252]: fn send_message()
              - code [ref=e253]: fn get_messages()
    - generic [ref=e255]:
      - generic [ref=e258]: Live on Stellar Testnet
      - heading "Take back your conversations." [level=2] [ref=e259]:
        - text: Take back your
        - text: conversations.
      - paragraph [ref=e260]: No accounts. No servers. No surveillance. Just your wallet and the people you choose to talk to.
      - generic [ref=e261]:
        - button "Connect Wallet" [ref=e262]
        - link "Open App" [ref=e263] [cursor=pointer]:
          - /url: /dashboard
          - text: Open App
          - img [ref=e264]
    - generic [ref=e267]:
      - generic [ref=e268]:
        - generic [ref=e269]:
          - generic [ref=e272]: dMessage
          - paragraph [ref=e273]: Decentralized, end-to-end encrypted messaging on Stellar Soroban.
        - generic [ref=e274]:
          - heading "Protocol" [level=4] [ref=e275]
          - list [ref=e276]:
            - listitem [ref=e277]:
              - link "Features" [ref=e278] [cursor=pointer]:
                - /url: "#features"
            - listitem [ref=e279]:
              - link "How it works" [ref=e280] [cursor=pointer]:
                - /url: "#how"
            - listitem [ref=e281]:
              - link "Contracts" [ref=e282] [cursor=pointer]:
                - /url: "#contracts"
        - generic [ref=e283]:
          - heading "App" [level=4] [ref=e284]
          - list [ref=e285]:
            - listitem [ref=e286]:
              - link "Dashboard" [ref=e287] [cursor=pointer]:
                - /url: /dashboard
            - listitem [ref=e288]:
              - link "Connect Wallet" [ref=e289] [cursor=pointer]:
                - /url: /dashboard
        - generic [ref=e290]:
          - heading "Source" [level=4] [ref=e291]
          - list [ref=e292]:
            - listitem [ref=e293]:
              - link "GitHub" [ref=e294] [cursor=pointer]:
                - /url: https://github.com/rylsherdamz-rgb/dMessage
            - listitem [ref=e295]:
              - link "Stellar Expert" [ref=e296] [cursor=pointer]:
                - /url: https://stellar.expert/explorer/testnet
      - generic [ref=e298]:
        - paragraph [ref=e299]: © 2026 dMessage · MIT License
        - paragraph [ref=e300]:
          - text: Built with
          - img [ref=e301]
          - text: on Stellar Soroban
  - button "Open Next.js Dev Tools" [ref=e312] [cursor=pointer]:
    - img [ref=e313]
  - alert [ref=e316]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Landing Page', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/');
  6  |     await page.waitForLoadState('networkidle');
  7  |   });
  8  | 
  9  |   test('should display hero section with title', async ({ page }) => {
  10 |     await expect(page.locator('text=dMessage')).toBeVisible();
  11 |     await expect(page.locator('text=Decentralized Messaging on Stellar')).toBeVisible();
  12 |   });
  13 | 
  14 |   test('should have Start Chatting link to dashboard', async ({ page }) => {
  15 |     const startLink = page.locator('a').filter({ hasText: 'Start Chatting' });
  16 |     await expect(startLink).toBeVisible();
  17 |     await expect(startLink).toHaveAttribute('href', '/dashboard');
  18 |   });
  19 | 
  20 |   test('should display Connect Wallet button in hero', async ({ page }) => {
  21 |     const connectBtn = page.locator('button, a').filter({ hasText: 'Connect Wallet' });
  22 |     await expect(connectBtn.first()).toBeVisible();
  23 |   });
  24 | 
  25 |   test('should display marquee ticker', async ({ page }) => {
  26 |     await expect(page.locator('text=END-TO-END ENCRYPTED')).toBeVisible();
  27 |     await expect(page.locator('text=STELLAR SOROBAN')).toBeVisible();
  28 |     await expect(page.locator('text=IPFS STORAGE')).toBeVisible();
  29 |   });
  30 | 
  31 |   test('should display features section with 6 cards', async ({ page }) => {
  32 |     const features = page.locator('#features');
  33 |     await expect(features).toBeVisible();
  34 |     const cards = features.locator('> div > div');
  35 |     const count = await cards.count();
  36 |     expect(count).toBe(6);
  37 |   });
  38 | 
  39 |   test('should display how-it-works section with 4 steps', async ({ page }) => {
  40 |     const how = page.locator('#how');
  41 |     await expect(how).toBeVisible();
  42 |     const steps = how.locator('ol > li');
  43 |     const count = await steps.count();
> 44 |     expect(count).toBe(4);
     |                   ^ Error: expect(received).toBe(expected) // Object.is equality
  45 |   });
  46 | 
  47 |   test('should display contracts section with 3 contract cards', async ({ page }) => {
  48 |     const contracts = page.locator('#contracts');
  49 |     await expect(contracts).toBeVisible();
  50 |     await expect(page.locator('text=UserRegistry')).toBeVisible();
  51 |     await expect(page.locator('text=SocialGraph')).toBeVisible();
  52 |     await expect(page.locator('text=MessageContract')).toBeVisible();
  53 |   });
  54 | 
  55 |   test('should have Open App link to dashboard', async ({ page }) => {
  56 |     const openApp = page.locator('a').filter({ hasText: 'Open App' });
  57 |     await expect(openApp).toBeVisible();
  58 |     await expect(openApp).toHaveAttribute('href', '/dashboard');
  59 |   });
  60 | 
  61 |   test('should display footer with links', async ({ page }) => {
  62 |     await expect(page.locator('footer')).toBeVisible();
  63 |     await expect(page.locator('footer a[href*="github"]')).toBeVisible();
  64 |   });
  65 | 
  66 |   test('should navigate to dashboard on Start Chatting click', async ({ page }) => {
  67 |     await page.locator('a').filter({ hasText: 'Start Chatting' }).click();
  68 |     await expect(page).toHaveURL('/dashboard');
  69 |   });
  70 | 
  71 |   test('should have dark background', async ({ page }) => {
  72 |     const bg = await page.evaluate(() => {
  73 |       return getComputedStyle(document.body).backgroundColor;
  74 |     });
  75 |     const rgb = bg.match(/\d+/g);
  76 |     if (rgb) {
  77 |       const [r, g, b] = rgb.map(Number);
  78 |       expect(r + g + b).toBeLessThan(384);
  79 |     }
  80 |   });
  81 | });
  82 | 
```