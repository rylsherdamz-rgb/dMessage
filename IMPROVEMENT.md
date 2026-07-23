# dMessage — Improvement Roadmap

Ideas for the next iteration beyond the current testnet MVP. Prioritized by impact vs. effort.

## Phase 1 — Core UX (High Impact, Low Effort)

### Message Search
Full-text search across conversations. Index messages locally (they're encrypted, so server-side search is impossible). Use a simple in-memory trie or Fuse.js.

### Message Editing & Deletion
- **Edit**: Allow sender to edit a message within 5 minutes. Store edit history or just replace the IPFS blob.
- **Delete**: Soft-delete (mark as deleted in the contract) or hard-delete (remove IPFS pin).

### Typing Indicators
Emit an event or use short-lived contract storage to signal "user is typing" to the conversation partner. Poll on the receiving side.

### Image/File Previews
Render inline previews for image CIDs in the message thread. Video/audio players for media types.

### Better Empty States
When no messages exist, show a helpful prompt rather than a blank screen. Onboarding tips in the sidebar.

### Unread Badge Count
Show unread message count on conversation items and the browser tab title.

## Phase 2 — Communication Features (High Impact, Medium Effort)

### Group Chats
Create a group with N members. Share a symmetric key encrypted to each member's public key. Store group metadata as a separate Soroban contract or within the MessageContract.

### Message Reactions
Store emoji reactions as contract events (not in message storage) to keep bloat off the inbox Vec. Fetch reactions separately when rendering.

### Contact Discovery
- Lookup by Stellar address or username
- Share contact via QR code (done in Settings)
- "Add from conversation" flow

### Push Notifications
- Web Push API for browser notifications
- Service worker registers for push events
- On new message, trigger a notification with sender info
- Encrypted payload so the push server can't read content

### Read Receipts Privacy
Add a per-user setting to disable sending read receipts. Respect the remote user's preference when displaying ✓✓.

## Phase 3 — Polish & Scale (Medium Impact, Medium Effort)

### Mobile Responsiveness
The current layout works on desktop but needs work for mobile. Convert the sidebar to a drawer, make the message input sticky at the bottom, add swipe gestures.

### PWA / Installable
Add a manifest.json, service worker, and offline fallback page. Make the app installable as a PWA on mobile and desktop.

### Message Virtualization
The current message list renders all messages. For users with thousands of messages, switch to windowed rendering (e.g., `react-window` or `@tanstack/virtual`).

### Accessibility (WCAG 2.1 AA)
Audit current components:
- Focus management in the chat view
- ARIA labels on all interactive elements
- Keyboard navigation for message list
- Screen reader announcements for new messages
- Color contrast ratios (especially the accent green on light mode)

### Internationalization (i18n)
Set up `next-intl` or similar. Translate the app into at least 2-3 languages. All user-facing strings should go through a translation function.

### Encryption Key Verification
Display key fingerprints (hex hashes of ECDH public keys). Allow users to verify fingerprints out-of-band and mark a contact as "verified."

## Phase 4 — Advanced (High Impact, High Effort)

### Mainnet Deployment
- Security audit of all three contracts
- Fund deployer account with real XLM
- Update deployment scripts for mainnet
- Switch wallet network to Stellar Mainnet
- Update all contract references

### Multiple Wallet Support
Currently Freighter-only. Add support for:
- Albedo
- Wallet Connect (via Stellar Wallet Kit)
- Ledger hardware wallet
- Private key import (with warnings)

### Voice Messages
Record audio in-browser via MediaRecorder API. Encrypt with the same ECDH + AES-GCM scheme. Upload to IPFS as audio blob. Display a waveform player in the message thread.

### Message Backup & Export
Export all conversations as a single encrypted JSON blob. Allow re-import on another device. Uses the same keypair so only the user can decrypt their backup.

### Communities / Public Channels
Topic-based public channels stored in a new contract. Messages are publicly visible but still stored on IPFS. Moderation via designated channel admins.

### Cross-chain Identity
Let users link their Stellar address to an Ethereum or Solana address via a signed message. Display all linked identities on the profile.

## Phase 5 — Ecosystem (Variable Impact, Variable Effort)

### DAO Governance
Token-weighted voting on protocol parameters (e.g., max message size, storage rent). Requires a governance token contract.

### Bug Bounty Program
Launch on Immunefi or similar. Offer real rewards for vulnerability disclosures.

### Mobile Native App
- React Native app reusing crypto/IPFS primitives
- Native push notifications via Firebase/APNs
- Biometric authentication for key access

### Stellar Asset Integration
Allow users to attach Stellar assets (tokens, NFTs) to messages. Enables use cases like "send XLM with a birthday message."

---

## How to Contribute

Pick any item from the lists above, create a feature branch from `improvement`, and open a PR. See [`README.md`](README.md) for development setup instructions.
