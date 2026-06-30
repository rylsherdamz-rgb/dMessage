# Security Audit — dMessage Gasless / Fee-Sponsored Contracts

**Scope:** `contracts/gasless/{user_registry_gasless, social_graph_gasless, messages_gasless}/src/lib.rs`
**SDK:** `soroban-sdk` 21.7.7 · release profile has `overflow-checks = true`
**Method:** manual source review, structural inspection, full test-suite run, and diff against the original (deprecated) non-gasless contracts.
**Date:** 2026-06-30

This is a first-party internal audit. It is **not** a substitute for the third-party
audit referenced in the project README prior to mainnet deployment.

---

## Summary of Findings

| ID | Severity | Contract | Issue | Status |
|----|----------|----------|-------|--------|
| H-1 | High | messages | Unbounded inbox `Vec` → permanent inbox DoS via spam | ✅ Fixed |
| H-2 | High | social_graph | Unsolicited + unbounded conversation-list growth (no participant check) | ✅ Fixed |
| M-1 | Medium | all three | No persistent-storage TTL bumping → entries can be archived (liveness) | ✅ Fixed |
| M-2 | Medium | user_registry | `encryption_pubkey` not validated (empty/wrong length breaks E2EE) | ✅ Fixed |
| M-3 | Medium | user_registry | No username uniqueness → impersonation | ✅ Fixed |
| L-1 | Low | user_registry | `created_at` reset to `now` on every profile update | ✅ Fixed |
| L-2 | Low | messages | `mark_as_read` panics on missing inbox / out-of-range index | ✅ Fixed |
| L-3 | Low | messages | `get_messages` page arithmetic can overflow-panic | ✅ Fixed |
| L-4 | Low | messages | No message content size cap (amplifies H-1) | ✅ Fixed |
| I-1 | Info | all three | Sponsorship counter ≠ verified fee payment (semantic gap) | 📝 Documented |

> **Deployment note:** H-1 and the storage-layout changes alter the on-chain
> storage schema. The fixed contracts must be **rebuilt and redeployed**, and the
> frontend/`deployment.json` repointed. Existing testnet data does not migrate
> automatically.

---

## High

### H-1 — Unbounded inbox growth bricks a recipient's inbox (messages_gasless)

**Original behavior.** `send_message` stored the entire inbox as one
`Vec<InboxMessage>` under `DataKey::Inbox(recipient)`. Every send loaded the whole
vector, appended, and wrote it back — O(n) in both compute and entry size — with no
rate limit, no sender allowlist, no message cap, and no content-size cap.

**Impact.** Anyone could send unlimited messages to any address. As the single
storage entry grew, it would eventually exceed Soroban's per-entry / per-transaction
resource limits, after which **both `send_message` and `get_messages` fail**,
permanently denying the victim the ability to receive or read messages. Cheap,
externally triggerable, and effectively irreversible — the most serious finding.

**Fix.** Migrated to indexed per-entry storage:

```
DataKey::MsgCount(Address)        // recipient -> u32 message count
DataKey::Msg(Address, u32)        // (recipient, index) -> InboxMessage
```

`send_message` is now O(1): it reads the count, writes a single new `Msg` entry, and
increments the count. `get_messages` reads only the requested page. `mark_as_read`
updates a single entry. No single entry grows without bound, so the spam-to-brick
vector is closed. A per-message content cap (`MAX_CONTENT_LEN = 256` bytes — enough
for an IPFS CID) was also added (see L-4).

### H-2 — Anyone can inject unbounded entries into any user's conversation list (social_graph_gasless)

**Original behavior.** `ensure_conversation` checked only `caller.require_auth()`,
but `caller` was never required to be one of `user_a` / `user_b`. `ensure_internal`
then appended a `ConversationRef` to **both** participants' lists.

**Impact.** An attacker could call `ensure_conversation(attacker, victim, attacker_addr_i)`
with unlimited freshly generated peer addresses, each adding a new ref to the
victim's `UserConvs` list. This (a) forced unsolicited conversations into any user's
list (spam/privacy) and (b) grew the victim's entry without bound → the same
entry-size DoS as H-1, plus an O(n) dedup scan per call.

**Fix.** `ensure_conversation` and `ensure_conversation_sponsored` now require
`caller == user_a || caller == user_b`, so only a participant can create a
conversation. This closes the third-party griefing/DoS vector. As defense in depth,
a `MAX_CONVERSATIONS` cap (1024) bounds the per-user list, and TTL is bumped on
write.

---

## Medium

### M-1 — No persistent-storage TTL management (all three)

**Original behavior.** No contract called `extend_ttl()`, despite the README
advertising "persistent bumpable storage." Soroban archives persistent entries whose
TTL lapses, making profiles, conversations, and inboxes inaccessible until a costly
restore.

**Fix.** Added TTL bumping (`extend_ttl`) on every write to long-lived entries in all
three contracts, using a 30-day extension window
(`BUMP_AMOUNT = 30 * DAY_IN_LEDGERS`, `LIFETIME_THRESHOLD = BUMP_AMOUNT - DAY_IN_LEDGERS`).

### M-2 — `encryption_pubkey` not validated (user_registry_gasless)

**Original behavior.** `register_user[_sponsored]` accepted any `Bytes`, including
empty, for `encryption_pubkey`. X25519 public keys must be exactly 32 bytes; a
malformed or empty key silently breaks E2EE for anyone messaging that user.

**Fix.** Enforce `encryption_pubkey.len() == 32`; otherwise the call panics.

### M-3 — No username uniqueness → impersonation (user_registry_gasless)

**Original behavior.** Profiles were keyed only by `Address`; there was no
username→address index, so multiple addresses could claim the same username,
enabling impersonation in any username-displaying UI.

**Fix.** Added a `DataKey::Username(String) -> Address` index. Registration rejects a
username already owned by a different address. When a user changes their own
username, the previous username is released. Usernames are also validated as
non-empty and `<= MAX_USERNAME_LEN` (64 bytes); `metadata_ipfs <= MAX_METADATA_LEN`
(128 bytes).

---

## Low

### L-1 — `created_at` reset on update (user_registry_gasless)
**Original:** `write_profile` unconditionally set `created_at = now`, so editing a
profile destroyed the original creation timestamp.
**Fix:** On update, the existing profile's `created_at` is loaded and preserved;
only `updated_at` advances.

### L-2 — `mark_as_read` panics ungracefully (messages_gasless)
**Original:** `set_read` did `get(&key).unwrap()` then `inbox.get(index).unwrap()`,
panicking on a missing inbox or out-of-range index.
**Fix:** With indexed storage, `set_read` bounds-checks `index` against `MsgCount`
and reads the specific `Msg` entry; an out-of-range index panics with a clear guard
rather than an unwrap on absent data.

### L-3 — `get_messages` overflow (messages_gasless)
**Original:** `start = page * page_size` and `start + page_size` could overflow
`u32`; with `overflow-checks = true` this panics (caller-supplied, read-only →
self-DoS only).
**Fix:** Pagination uses `saturating_mul` / `saturating_add`.

### L-4 — No content size cap (messages_gasless)
**Original:** `content` was unbounded; the on-chain payload should only be an IPFS
CID.
**Fix:** Reject `content.len() > MAX_CONTENT_LEN` (256 bytes). This also limits H-1
amplification.

---

## Informational

### I-1 — Sponsorship counter semantics (all three)
`get_sponsored_count` counts `*_sponsored` calls that the sponsor *authorized*, not
XLM actually paid. Fee-bump happens at the transaction-envelope layer and is
invisible to contract code, so a sponsor's inner-auth signature does not prove they
paid the fee (the inner tx could be submitted self-paid or fee-bumped by a different
account). The counter therefore measures **consent to be counted**, not settled
spend — fine for analytics/rate-limiting, but it must not be used for financial
reconciliation. No code change; documented here and worth a README clarification.

---

## Positive Observations (unchanged, confirmed sound)

- All state-changing functions enforce `require_auth`. The sponsor co-authorization
  design correctly prevents forged sponsorship attribution; Soroban auth entries are
  nonce/expiry-scoped, so replay is not possible.
- `overflow-checks = true` in the release profile → arithmetic panics rather than
  silently wrapping.
- The namespaced `DataKey` enums fix a latent collision bug present in the original
  `messages` / `user_registry`, which keyed storage by a bare `Address` (would
  collide once the same address is also used as a sponsor counter).
- No external contract calls → no reentrancy surface.
- Conversation-id derivation `sha256(xdr(min) || xdr(max))` is deterministic and
  order-independent.

---

## Verification

All three crates: `cargo test` passes and `cargo build` succeeds after the fixes.
Regression tests were added for each finding (participant-auth rejection, pubkey
length, username uniqueness, `created_at` preservation, content cap, out-of-range
`mark_as_read`, and pagination edge cases). See the `#[cfg(test)]` module in each
contract.
