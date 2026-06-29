# dMessage

**Escape the surveillance. Own your conversations.**

**Live deployment:** [dmessage.vercel.app](https://dmessage.vercel.app)

## Project Description

dMessage is a decentralized, end-to-end encrypted messaging platform built on the Stellar blockchain — created so you can talk without being listened to, mined, traded, or fed into someone's AI training pipeline.

Big tech companies treat your private conversations as their free data mine. Every message, every contact, every metadata point is scraped, analyzed, and used to train models you'll never control and profits you'll never see. dMessage exists to break that cycle.

Your data is not their product. Your words are not their training set.

Messages are encrypted on your device using X25519 ECDH key exchange + AES-GCM-256 — the same standards militaries and security professionals trust. The encrypted blobs live on IPFS, not on a corporate server. Only cryptographic hashes and metadata touch the Stellar Soroban blockchain, which no single entity controls. No servers to subpoena. No database to breach. No CEO to decide your data is worth more than your privacy.

## Project Vision

A world where:
- Your identity is your wallet — not a login tied to your real name, phone number, or email
- Your messages are private by default — end-to-end encrypted before they leave your device
- Your data stays yours — no one can resell, train on, or monetize your conversations
- Your communication is uncensorable — no intermediary can decide who you're allowed to talk to

## Key Features

- **Stellar Wallet Identity**: Login with Freighter, Albedo, or any Stellar wallet via Wallet Kit
- **End-to-End Encryption**: X25519 ECDH key exchange + AES-GCM-256 symmetric encryption (Web Crypto API)
- **Decentralized Storage**: IPFS for encrypted message content, Soroban for metadata/hashes
- **Real-time Threads**: Live message updates via React Query + Soroban contract queries
- **Media Support**: Text and image sharing with IPFS pinning
- **Wallet Integration**: Native Stellar transaction signing for contract interactions
- **Low Gas Costs**: Optimized Soroban storage patterns using persistent storage
- **Gasless / Fee Sponsorship**: A sponsor/relayer can pay a user's fee via Stellar fee-bump, so new users transact without holding XLM (on-chain sponsorship accounting via `*_sponsored` functions)
- **Open Source**: Fully auditable smart contracts and frontend code
- **Dark Theme**: Modern UI with Tailwind CSS v4, custom OKLCH color system
- **3D Landing Page**: Interactive hero scene with Three.js and Framer Motion

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│   Next.js Frontend  │     │   IPFS (Content)      │
│   (React 19)        │────▶│   Encrypted blobs     │
│                     │     └──────────────────────┘
│  - Wallet Provider  │
│  - E2EE Crypto      │     ┌──────────────────────┐
│  - React Query      │────▶│   Stellar Soroban    │
│  - Tailwind CSS     │     │   (Metadata/Hashes)  │
└─────────────────────┘     │                      │
                            │  - UserRegistry      │
                            │  - SocialGraph       │
                            │  - MessageContract   │
                            └──────────────────────┘
```

### Smart Contracts

| Contract | Description |
|----------|-------------|
| **UserRegistry** | Stores user profiles: usernames, ECDH public keys, IPFS metadata links |
| **SocialGraph** | Creates deterministic conversation references, maintains per-user conversation lists |
| **MessageContract** | Inbox-per-recipient message storage with paginated retrieval and read receipts |

## Contract Details

![Account creation flow](images/account.png)
![Message sending flow](images/messages.png)
![Social graph visualization](images/social_graph.png)
![Test suite results](images/test.png)
![User registry contract](images/user_registry.png)

### UI Screenshots

![Landing page](images/landing.png)
![Dashboard](images/dashboard-1.png)
![Dashboard contacts](images/dashboard-2.png)
![Dashboard messages](images/dashboard-3.png)
![Dashboard profile](images/dashboard-4.png)
![UI screenshot 2](images/ui-2.png)
![UI screenshot 3](images/ui-3.png)
![UI screenshot 4](images/ui-4.png)
![UI screenshot 5](images/ui-5.png)
![UI screenshot 6](images/ui-6.png)

### Proof of Users — On-Chain Activity

Users registered and interacting via the deployed Soroban contracts on testnet:

![User registry usage](images/proof_of_users/user_registry.png)
![Social graph usage](images/proof_of_users/social_graph.png)
![Message contract usage](images/proof_of_users/message_contract.png)

### Vercel Analytics

![Vercel analytics](images/vercel_analystics.png)

- **User Feedback Folder:** `user_feedback/` ([Excel export](user_feedback/dMessage%20FeedBack%20%28Responses%29.xlsx))

**Demo video:** [Watch on Google Drive](https://drive.google.com/file/d/1q4tBQcAu1VbC3sjbPo7HwJt_wO5Mg772/view?usp=sharing)

### Presentation

View the dMessage pitch deck:

- **Interactive:** [Gamma Presentation](https://gamma.app/docs/dMessage-dq4tl7fbm2p9cxk?mode=doc)
- **PDF:** [`ppt/dMessage.pdf`](ppt/dMessage.pdf)

#### Current — Gasless / Fee-Sponsored (in use)

These contracts add **Fee Sponsorship**: a sponsor/relayer account can pay a user's
transaction fee via a Stellar fee-bump transaction, so users transact without holding
XLM. Each state-changing function has a `*_sponsored` variant that records on-chain
sponsorship (`get_sponsored_count`, `Sponsored` event). Source lives in
[`contracts/gasless/`](contracts/gasless).

| Contract | Address | WASM Hash (SHA256) |
|----------|---------|-------------------|
| UserRegistry (gasless) | `CD3SG54U3XKT4SOK2T25HZRF244Q5KWSXCKTNCIQH44ZPBB2OZ4F6YZG` | `1565c6a47be7c5a04496764d56348e98e0f9f243046e42442a788cd13460cf4c` |
| SocialGraph (gasless) | `CCEOAERFEEVPFRVKMIXYBWQGS5H5N7ZYNY2JJ37TG4AI4V2W5XGFGB2Q` | `2eebe3418e6e78b2c471d88e6136d77cf2a4f957c7221b4e15b2575b0a6a5724` |
| MessageContract (gasless) | `CDK2AI4JMCD6I53TCYKL5WISQADKE6VHQKHRWK7NTFJ2TQOSM2RIIYY3` | `64194f4ea00d6970a4819d1977c700163f2d9df75f242ad139e7e49e15baa995` |

Explorer: [UserRegistry](https://stellar.expert/explorer/testnet/contract/CD3SG54U3XKT4SOK2T25HZRF244Q5KWSXCKTNCIQH44ZPBB2OZ4F6YZG) · [SocialGraph](https://stellar.expert/explorer/testnet/contract/CCEOAERFEEVPFRVKMIXYBWQGS5H5N7ZYNY2JJ37TG4AI4V2W5XGFGB2Q) · [Messages](https://stellar.expert/explorer/testnet/contract/CDK2AI4JMCD6I53TCYKL5WISQADKE6VHQKHRWK7NTFJ2TQOSM2RIIYY3)

The gasless contracts were deployed by account [`GDTPJE3COWLAYGDQ4GOGZF64CLHME6HJ5AVDO2ZC44HZXCHJZUXCEPAM`](https://stellar.expert/explorer/testnet/account/GDTPJE3COWLAYGDQ4GOGZF64CLHME6HJ5AVDO2ZC44HZXCHJZUXCEPAM).

#### Deprecated Contracts (kept for reference, no longer used)

The previous non-gasless contracts remain on-chain and in the repo for history and
verification, but the frontend no longer points to them.

| Contract | Address | WASM Hash (SHA256) | Status |
|----------|---------|-------------------|--------|
| UserRegistry | `CAFHDYYSSR7A5MRMTNY457HDDBBWYJZAQNZ22NT7TOMMBRSNC2OOBYHA` | `000a21be277fa53e1e91b5cbea85b20d8638dfac07396c157b2894b6f3742964` | deprecated |
| SocialGraph | `CCI7DBNILBDTLR2KF24I7647H5JGUSMEJDHXS6D7H6GPSQ3WEBJMUPM7` | `2f1eaee677be5dbd9124a715efb47c432c496681f0145f9e27d3c3153a48401c` | deprecated |
| MessageContract (v2) | `CATLF3WXUG3GMD2J4XIOIYVE3ND7PBFYYXHPS4632ZXEPJPNGYNAEZK7` | `98221de14f435ac68060c3e7494da96819563467ed46ce78ce8d1e618e1bb51d` | deprecated |
| MessageContract (v1) | `CAXNXU2GV45Y7TXDLDJNOVQQ74P4LSX2D5PWRAN52GH3GPVLR423E3TK` | `8a17841a2e9ad82147154ff43d57d0a9f82bddea4880922208803d546b10bf6e` | deprecated |

Explorer (deprecated): [UserRegistry](https://stellar.expert/explorer/testnet/contract/CAFHDYYSSR7A5MRMTNY457HDDBBWYJZAQNZ22NT7TOMMBRSNC2OOBYHA) · [SocialGraph](https://stellar.expert/explorer/testnet/contract/CCI7DBNILBDTLR2KF24I7647H5JGUSMEJDHXS6D7H6GPSQ3WEBJMUPM7) · [Messages v2](https://stellar.expert/explorer/testnet/contract/CATLF3WXUG3GMD2J4XIOIYVE3ND7PBFYYXHPS4632ZXEPJPNGYNAEZK7) · [Messages v1](https://stellar.expert/explorer/testnet/contract/CAXNXU2GV45Y7TXDLDJNOVQQ74P4LSX2D5PWRAN52GH3GPVLR423E3TK)

The deprecated contracts were deployed by [`GDTPJE3COWLAYGDQ4GOGZF64CLHME6HJ5AVDO2ZC44HZXCHJZUXCEPAM`](https://stellar.expert/explorer/testnet/account/GDTPJE3COWLAYGDQ4GOGZF64CLHME6HJ5AVDO2ZC44HZXCHJZUXCEPAM) (v1) and [`GDHP5PPKFRCC23E6MSNDKC7UCHYNTV74DJI7UYR7EDR4YMSGCL3KTZQH`](https://stellar.expert/explorer/testnet/account/GDHP5PPKFRCC23E6MSNDKC7UCHYNTV74DJI7UYR7EDR4YMSGCL3KTZQH) (v2).

### Source Verification

Anyone can verify the **current (gasless)** contracts by rebuilding from source:

```bash
# 1. Clone the repo at the deployment commit
git checkout 50cbb46

# 2. Build each gasless contract (wasm32v1-none)
cd contracts/gasless/user_registry_gasless && stellar contract build && cd -
cd contracts/gasless/social_graph_gasless && stellar contract build && cd -
cd contracts/gasless/messages_gasless && stellar contract build && cd -

# 3. Compare SHA256 hashes
sha256sum contracts/gasless/target/wasm32v1-none/release/*.wasm
# The output should match the gasless WASM hashes in the table above
```

The deprecated (non-gasless) contracts can still be verified by building
`contracts/user_registry`, `contracts/social_graph`, and `contracts/messages`.

The deployment manifest with full metadata (current + deprecated) is at
[`deployment.json`](deployment.json).

*Mainnet addresses to be announced post-audit.*

## Getting Started

### Prerequisites
- Node.js 20+
- Rust 1.75+ (with `wasm32-unknown-unknown` target)
- Stellar Freighter browser extension (for wallet connection)

### Setup

```bash
# Clone and install
git clone https://github.com/rylsherdamz-rgb/dMessage.git
cd dMessage

# Install frontend dependencies
cd frontend && npm install && cd ..

# Build smart contracts
cd contracts/user_registry && cargo build --release && cd ../..
cd contracts/social_graph && cargo build --release && cd ../..
cd contracts/messages && cargo build --release && cd ../..
```

### Environment

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp frontend/.env.example frontend/.env.local
```

Required variables:
- `NEXT_PUBLIC_SOROBAN_RPC` — Soroban RPC endpoint (defaults to Stellar Testnet)
- `NEXT_PUBLIC_CONTRACT_USER_REGISTRY` — Deployed UserRegistry contract ID
- `NEXT_PUBLIC_CONTRACT_SOCIAL_GRAPH` — Deployed SocialGraph contract ID
- `NEXT_PUBLIC_CONTRACT_MESSAGES` — Deployed MessageContract contract ID
- `NEXT_PUBLIC_IPFS_PIN_API` — IPFS pinning service API endpoint

### Run Development Server

```bash
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Smart Contract API

### UserRegistry
- `register_user(caller, username, encryption_pubkey, metadata_ipfs)` — Register or update your profile
- `register_user_sponsored(sponsor, caller, …)` — Gasless register; `sponsor` pays the fee (fee-bump) and is recorded on-chain
- `get_user(addr)` — Get a user's profile by their Stellar address
- `get_sponsored_count(sponsor)` — How many actions a sponsor has paid for

### SocialGraph
- `ensure_conversation(caller, user_a, user_b)` — Create or get a deterministic conversation between two users
- `ensure_conversation_sponsored(sponsor, caller, user_a, user_b)` — Gasless variant; `sponsor` pays via fee-bump
- `get_user_conversations(user_addr)` — Get all conversation references for a user
- `get_sponsored_count(sponsor)` — How many actions a sponsor has paid for

### MessageContract
- `send_message(sender, recipient, content)` — Store a message in the recipient's inbox
- `send_message_sponsored(sponsor, sender, recipient, content)` — Gasless send; `sponsor` pays via fee-bump
- `get_messages(user, page, page_size)` — Paginated inbox retrieval
- `mark_as_read(caller, index)` — Mark a message as read
- `mark_as_read_sponsored(sponsor, caller, index)` — Gasless mark-as-read; `sponsor` pays via fee-bump
- `my_message_count(user)` — Get the total message count for a user
- `get_sponsored_count(sponsor)` — How many actions a sponsor has paid for

## Advanced Features

### Fee Sponsorship — Gasless Transactions via Fee-Bump

The current contracts (see [`contracts/gasless/`](contracts/gasless)) let a
**sponsor/relayer pay a user's transaction fee**, so a brand-new user with **no
XLM** can register, send messages, and mark them read — a fully gasless
experience.

**How fee-bump works on Stellar.** A fee-bump is a transaction-envelope feature,
not contract logic. One transaction is wrapped inside another:

```
┌─────────────────────────────────────────────┐
│  FeeBumpTransaction (OUTER)                   │
│  • feeSource  = SPONSOR account               │  ← pays the XLM fee
│  • signatures = [ sponsor's signature ]        │
│   ┌─────────────────────────────────────────┐ │
│   │  Transaction (INNER)                      │ │
│   │  • source     = USER account              │ │  ← the real action
│   │  • operation  = InvokeHostFunction(...)   │ │     (calls the contract)
│   │  • Soroban auth signed by USER            │ │
│   └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

1. The user signs the Soroban auth entries of the inner transaction (this is what
   satisfies `caller.require_auth()` / `sender.require_auth()` in the contract).
2. A sponsor account wraps it in a `FeeBumpTransaction` (fee source = sponsor),
   signs the outer envelope, and submits it.
3. The network charges the **sponsor**; the user spends nothing.

**Security.** The user's signature covers the inner transaction, and the sponsor
**cannot alter it** — any change invalidates the user's signature and the Soroban
auth entries. The sponsor controls *whether* the action is paid for, never *what*
the action does.

**On-chain accountability (what the contracts add).** Fee-bump alone leaves no
contract-level record of who sponsored whom. Each state-changing function gains a
`*_sponsored` variant that:

- requires `sponsor.require_auth()` (the sponsor cryptographically consents, so the
  tally cannot be forged) **and** the user's own `require_auth()`;
- increments a per-sponsor counter readable via `get_sponsored_count(sponsor)`;
- emits a `Sponsored` event with `(sponsor, user)` topics.

This enables relayer analytics, rate-limiting, and abuse prevention (e.g. "this
sponsor has funded N actions this month — stop relaying"). The original,
self-paid functions are kept intact and still work — including transparently
under a fee-bump.

### Migration Note — New Contracts & Deprecations

This release **redeployed all three contracts** as gasless / fee-sponsored
versions (addresses in the [Current — Gasless](#current--gasless--fee-sponsored-in-use)
table) and repointed the frontend, `.env.example`, and `deployment.json` to them.

The previous non-gasless contracts are **deprecated** — kept on-chain and in the
repo (`contracts/user_registry`, `contracts/social_graph`, `contracts/messages`)
for history and verification, but no longer used by the app. See the
[Deprecated Contracts](#deprecated-contracts-kept-for-reference-no-longer-used)
table for their addresses and WASM hashes.

## Future Scope

- **Group Chats**: Multi-party conversations with shared symmetric keys
- **Verified Identities**: Keybase-style identity proofs via Stellar assets
- **Message Reactions**: Emoji reactions stored as contract events
- **Read Receipts**: Optional delivery and read tracking flags
- **Communities**: Topic-based public channels with membership management
- **Moderation Tools**: User-controlled muting, blocking, and reporting
- **Cross-chain Bridges**: Connect to Ethereum/Solana via Stellar Asset Contracts
- **DAO Governance**: Token-weighted voting for protocol upgrades and parameters
- **Accessibility**: WCAG 2.1 AA compliance with full screen reader support
- **Performance**: IPFS Cluster pinning and CDN gateways for media delivery
- **Mobile**: React Native app with shared crypto/IPFS primitives

## Security

- All smart contracts undergo third-party audit before mainnet deployment
- Client-side E2EE using standards-compliant Web Crypto API (ECDH + AES-GCM)
- Bug bounty program via Immunefi (post-launch)
- Regular dependency updates with Dependabot
- Formal verification of critical contract functions (in progress)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Stellar Soroban (Rust smart contracts) |
| Frontend | Next.js 16, React 19, TypeScript 5 |
| Styling | Tailwind CSS v4, OKLCH color system |
| 3D Graphics | Three.js, React Three Fiber, Drei |
| Animation | Framer Motion 12 |
| State/Data | TanStack React Query 5 |
| Wallet | Stellar Wallet Kit 2 |
| Crypto | Web Crypto API (ECDH P-256, AES-GCM-256) |
| Storage | IPFS (pinning service + gateway) |
| CI/CD | GitHub Actions (Soroban deploy + Vercel) |

## License

MIT

---

Built with ☯️ on Stellar Soroban
