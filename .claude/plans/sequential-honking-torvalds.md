# Plan: dMessage - Decentralized Messaging Platform on Stellar

## Context
dMessage is a decentralized, E2EE messaging platform built on the Stellar blockchain using Soroban smart contracts. It addresses the need for censorship-resistant, user-owned communication. The platform uses a hybrid storage approach: encrypted message content is stored on IPFS, while metadata, user profiles, and message hashes are stored on-chain via Soroban for authenticity and discoverability.

## Recommended Approach

### Phase 1: Project Scaffolding & Environment
- Initialize the project root with two main directories: `/contracts` (Rust/Soroban) and `/frontend` (Next.js).
- Setup Soroban development environment and project structure for three separate contracts.
- Initialize Next.js 14+ project with Tailwind CSS and TypeScript.

### Phase 2: Smart Contract Implementation (Soroban/Rust)
Implement three interconnected contracts focused on a read-heavy, low-gas pattern:
1. **UserRegistry**: Manages user profiles, usernames, and X25519 public keys for E2EE.
   - Key file: `contracts/user_registry/src/lib.rs`
2. **SocialGraph**: Manages deterministic conversation IDs and user conversation lists.
   - Key file: `contracts/social_graph/src/lib.rs`
3. **MessageContract**: Stores message hashes, timestamps, and orders messages within conversations.
   - Key file: `contracts/messages/src/lib.rs`

### Phase 3: Frontend Foundation & Wallet Integration
- Implement Stellar Wallet connection using **Stellar Wallet Kit** for a standardized, multi-wallet experience.
- Create the UI shell following intentional design principles (avoiding templates, focusing on hierarchy and motion).
- Build the `useWallet` hook powered by Wallet Kit.
- Key files: `frontend/hooks/useWallet.ts`, `frontend/components/wallet/WalletConnector.tsx`.

### Phase 4: Messaging Core Logic
- Implement the end-to-end encrypted messaging flow:
  - Client-side encryption using X25519.
  - Integration with IPFS (via web3.storage or similar) for encrypted blob storage.
  - Contract interaction layers for sending and fetching messages.
- Build the conversation list and thread views.
- Key files: `frontend/lib/crypto.ts`, `frontend/lib/ipfs.ts`, `frontend/lib/stellar.ts`, `frontend/app/conversation/[id]/page.tsx`.

### Phase 5: CI/CD & Infrastructure
- **Contract Pipeline**: GitHub Actions to build WASM, run tests, and deploy to Stellar Testnet. Add contract verification steps.
  - Key file: `.github/workflows/soroban.yml`
- **Frontend Pipeline**: Vercel integration for automatic deployments from the `main` branch.
  - Key file: `.github/workflows/frontend.yml`

### Phase 6: Documentation & Finalization
- Create a comprehensive `README.md` containing Project Title, Description, Vision, Key Features, Deployed Contract Details, and Future Scope.
- Verify that all contracts are deployed and the frontend is successfully connecting to them on Testnet.

## Critical Files
- `contracts/user_registry/src/lib.rs`
- `contracts/social_graph/src/lib.rs`
- `contracts/messages/src/lib.rs`
- `frontend/lib/stellar.ts`
- `frontend/hooks/useWallet.ts`
- `.github/workflows/soroban.yml`
- `.github/workflows/frontend.yml`
- `README.md`

## Verification Plan
1. **Contract Testing**: Run `cargo test` for all three contracts to ensure logic correctness.
2. **Deployment**: Deploy to Stellar Testnet and verify via Stellar Explorer.
3. **E2E Flow**:
   - Connect User A and User B wallets.
   - Register profiles.
   - User A sends encrypted message to User B.
   - User B receives, decrypts, and views message.
4. **CI/CD**: Push to `main` and verify GH Actions pass and Vercel deploy is successful.
