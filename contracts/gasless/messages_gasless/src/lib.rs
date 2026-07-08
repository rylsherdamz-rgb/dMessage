#![no_std]
//! # MessageContract (Gasless / Fee-Sponsored edition)
//!
//! Fee-sponsorship–aware copy of the original `messages` contract.
//!
//! ## How "gasless" works on Stellar
//!
//! Transaction fees are paid in XLM. A user with no XLM cannot self-submit, so
//! Stellar's **fee-bump transaction** lets a sponsor/relayer pay the fee:
//!
//! 1. The user signs the Soroban auth entries of the inner transaction that
//!    invokes this contract (satisfying `sender`/`caller` `require_auth()`).
//! 2. A sponsor account wraps it in a `FeeBumpTransaction` (fee source = sponsor),
//!    signs the outer envelope, and submits it.
//! 3. The sponsor pays the XLM fee; the user sends messages for free.
//!
//! Fee-bump is invisible to contract code, so the original `send_message` /
//! `mark_as_read` already work under it. The `*_sponsored` variants add on-chain
//! sponsorship accounting: the sponsor co-authorizes, each action is counted per
//! sponsor, and a `Sponsored` event is emitted.
//!
//! ## Security hardening (see contracts/gasless/SECURITY_AUDIT.md)
//!
//! - **H-1 / L-2:** the inbox is stored as indexed per-message entries
//!   (`MsgCount` + `Msg(addr, index)`) instead of one growing `Vec`. Sends,
//!   reads, and mark-as-read are O(1)/O(page) and no single entry grows without
//!   bound, closing the "spam until the inbox bricks" DoS.
//! - **L-3:** pagination uses saturating arithmetic.
//! - **L-4:** message content is capped (on-chain payload is only an IPFS CID).
//! - **M-1:** persistent entries have their TTL bumped on write.

use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, Vec};

/// Maximum on-chain message payload. The contract only stores an IPFS CID, which
/// is well under this; the cap prevents storage griefing / oversized entries.
const MAX_CONTENT_LEN: u32 = 256;

// --- persistent-entry TTL management (M-1) ---
const DAY_IN_LEDGERS: u32 = 17_280; // ~5s ledgers
const BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const LIFETIME_THRESHOLD: u32 = BUMP_AMOUNT - DAY_IN_LEDGERS;

#[derive(Clone)]
#[contracttype]
pub struct InboxMessage {
    pub sender: Address,
    pub content: Bytes,
    pub timestamp: u64,
    pub read: bool,
}

/// Namespaced storage keys.
///
/// The inbox is intentionally **not** a single `Vec`: each message lives under its
/// own `Msg(owner, index)` key and `MsgCount(owner)` tracks the length. This keeps
/// every write O(1) and bounds the size of any single ledger entry (H-1).
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    MsgCount(Address),
    Msg(Address, u32),
    SponsoredCount(Address),
}

#[contract]
pub struct MessageContract;

#[contractimpl]
impl MessageContract {
    /// Standard self-paid send (or transparently fee-bumped).
    pub fn send_message(env: Env, sender: Address, recipient: Address, content: Bytes) {
        sender.require_auth();
        Self::write_message(&env, &sender, &recipient, content);
    }

    /// Fee-sponsored ("gasless") send.
    ///
    /// Designed to ride inside a Stellar fee-bump transaction whose fee source is
    /// `sponsor`. The sponsor co-authorizes (trustworthy accounting); the sender
    /// still authorizes their own message.
    pub fn send_message_sponsored(
        env: Env,
        sponsor: Address,
        sender: Address,
        recipient: Address,
        content: Bytes,
    ) {
        sponsor.require_auth();
        sender.require_auth();

        Self::write_message(&env, &sender, &recipient, content);
        Self::record_sponsorship(&env, &sponsor, &sender);
    }

    pub fn get_messages(env: Env, user: Address, page: u32, page_size: u32) -> Vec<InboxMessage> {
        let total = Self::count(&env, &user);

        // L-3: saturating arithmetic so attacker-supplied page/page_size cannot
        // overflow-panic.
        let start = page.saturating_mul(page_size);
        if start >= total {
            return Vec::new(&env);
        }
        let end = core::cmp::min(start.saturating_add(page_size), total);

        let mut result = Vec::new(&env);
        let mut i = start;
        while i < end {
            if let Some(msg) = env
                .storage()
                .persistent()
                .get::<DataKey, InboxMessage>(&DataKey::Msg(user.clone(), i))
            {
                result.push_back(msg);
            }
            i += 1;
        }
        result
    }

    pub fn my_message_count(env: Env, user: Address) -> u32 {
        Self::count(&env, &user)
    }

    /// Standard self-paid mark-as-read (or transparently fee-bumped).
    pub fn mark_as_read(env: Env, caller: Address, index: u32) {
        caller.require_auth();
        Self::set_read(&env, &caller, index);
    }

    /// Fee-sponsored ("gasless") mark-as-read.
    pub fn mark_as_read_sponsored(env: Env, sponsor: Address, caller: Address, index: u32) {
        sponsor.require_auth();
        caller.require_auth();

        Self::set_read(&env, &caller, index);
        Self::record_sponsorship(&env, &sponsor, &caller);
    }

    /// Number of actions a sponsor has paid for through this contract.
    pub fn get_sponsored_count(env: Env, sponsor: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::SponsoredCount(sponsor))
            .unwrap_or(0)
    }

    // --- internal helpers ---

    fn count(env: &Env, owner: &Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::MsgCount(owner.clone()))
            .unwrap_or(0)
    }

    fn write_message(env: &Env, sender: &Address, recipient: &Address, content: Bytes) {
        // L-4: bound the on-chain payload (it is only an IPFS CID).
        if content.len() > MAX_CONTENT_LEN {
            panic!("content exceeds maximum length");
        }

        let timestamp = env.ledger().timestamp();
        let index = Self::count(env, recipient);

        let msg_key = DataKey::Msg(recipient.clone(), index);
        env.storage().persistent().set(
            &msg_key,
            &InboxMessage {
                sender: sender.clone(),
                content,
                timestamp,
                read: false,
            },
        );
        env.storage()
            .persistent()
            .extend_ttl(&msg_key, LIFETIME_THRESHOLD, BUMP_AMOUNT);

        let count_key = DataKey::MsgCount(recipient.clone());
        // index + 1 cannot overflow before storage limits are hit; overflow-checks
        // would panic safely regardless.
        env.storage().persistent().set(&count_key, &(index + 1));
        env.storage()
            .persistent()
            .extend_ttl(&count_key, LIFETIME_THRESHOLD, BUMP_AMOUNT);

        env.events().publish(
            ("MessageSent", sender.clone(), recipient.clone()),
            timestamp,
        );
    }

    fn set_read(env: &Env, caller: &Address, index: u32) {
        // L-2: bounds-check against the count instead of unwrapping absent data.
        let total = Self::count(env, caller);
        if index >= total {
            panic!("message index out of range");
        }

        let msg_key = DataKey::Msg(caller.clone(), index);
        let mut msg: InboxMessage = env.storage().persistent().get(&msg_key).unwrap();
        msg.read = true;
        env.storage().persistent().set(&msg_key, &msg);
        env.storage()
            .persistent()
            .extend_ttl(&msg_key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
    }

    fn record_sponsorship(env: &Env, sponsor: &Address, user: &Address) {
        let key = DataKey::SponsoredCount(sponsor.clone());
        let count: u32 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(count + 1));
        env.storage()
            .persistent()
            .extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);

        env.events().publish(
            ("Sponsored", sponsor.clone(), user.clone()),
            env.ledger().timestamp(),
        );
    }
}

#[cfg(test)]
extern crate std;

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Events as _};
    use soroban_sdk::{Bytes, Env, TryFromVal};

    fn setup_env() -> (Env, MessageContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, MessageContract);
        let client = MessageContractClient::new(&env, &contract_id);
        (env, client)
    }

    fn make_content(env: &Env, val: &[u8]) -> Bytes {
        Bytes::from_slice(env, val)
    }

    #[test]
    fn test_send_and_get_messages() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let content = make_content(&env, b"hello bob");

        client.send_message(&alice, &bob, &content);
        let msgs = client.get_messages(&bob, &0u32, &10u32);

        assert_eq!(msgs.len(), 1);
        let msg = msgs.get(0).unwrap();
        assert_eq!(msg.sender, alice);
        assert_eq!(msg.content, content);
        assert!(!msg.read);
    }

    #[test]
    fn test_mark_as_read() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.send_message(&alice, &bob, &make_content(&env, b"hello"));
        client.mark_as_read(&bob, &0u32);

        let msgs = client.get_messages(&bob, &0u32, &10u32);
        assert!(msgs.get(0).unwrap().read);
    }

    #[test]
    fn test_my_message_count() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        assert_eq!(client.my_message_count(&bob), 0);
        client.send_message(&alice, &bob, &make_content(&env, b"msg1"));
        assert_eq!(client.my_message_count(&bob), 1);
    }

    #[test]
    fn test_send_message_panics_without_auth() {
        let env = Env::default();
        let contract_id = env.register_contract(None, MessageContract);
        let client = MessageContractClient::new(&env, &contract_id);

        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.send_message(&alice, &bob, &make_content(&env, b"no auth"));
        }));
        assert!(result.is_err());
    }

    // --- ordering / pagination / isolation regression tests ---

    #[test]
    fn test_get_messages_ordering_and_pagination() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.send_message(&alice, &bob, &make_content(&env, b"m0"));
        client.send_message(&alice, &bob, &make_content(&env, b"m1"));
        client.send_message(&alice, &bob, &make_content(&env, b"m2"));
        client.send_message(&alice, &bob, &make_content(&env, b"m3"));

        // First page preserves insertion order.
        let page0 = client.get_messages(&bob, &0u32, &2u32);
        assert_eq!(page0.len(), 2);
        assert_eq!(page0.get(0).unwrap().content, make_content(&env, b"m0"));
        assert_eq!(page0.get(1).unwrap().content, make_content(&env, b"m1"));

        // Second page continues from where the first ended.
        let page1 = client.get_messages(&bob, &1u32, &2u32);
        assert_eq!(page1.len(), 2);
        assert_eq!(page1.get(0).unwrap().content, make_content(&env, b"m2"));
        assert_eq!(page1.get(1).unwrap().content, make_content(&env, b"m3"));

        // Page past the end is empty, not a panic.
        assert_eq!(client.get_messages(&bob, &5u32, &2u32).len(), 0);
    }

    #[test]
    fn test_inbox_isolation() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let carol = Address::generate(&env);

        client.send_message(&alice, &bob, &make_content(&env, b"to bob"));
        assert_eq!(client.my_message_count(&bob), 1);
        assert_eq!(client.my_message_count(&carol), 0);
        assert_eq!(client.get_messages(&carol, &0u32, &10u32).len(), 0);
    }

    // L-3: huge page/page_size must not overflow-panic, just return empty.
    #[test]
    fn test_get_messages_pagination_no_overflow() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        client.send_message(&alice, &bob, &make_content(&env, b"hi"));

        let msgs = client.get_messages(&bob, &u32::MAX, &u32::MAX);
        assert_eq!(msgs.len(), 0);
    }

    // L-4: oversized content is rejected.
    #[test]
    fn test_send_message_rejects_oversized_content() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let big = Bytes::from_slice(&env, &[0u8; (MAX_CONTENT_LEN + 1) as usize]);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.send_message(&alice, &bob, &big);
        }));
        assert!(result.is_err(), "oversized content should be rejected");

        // A payload exactly at the cap is accepted.
        let at_cap = Bytes::from_slice(&env, &[0u8; MAX_CONTENT_LEN as usize]);
        client.send_message(&alice, &bob, &at_cap);
        assert_eq!(client.my_message_count(&bob), 1);
    }

    // L-2: marking a non-existent index must panic with a guard, not unwrap garbage.
    #[test]
    fn test_mark_as_read_out_of_range_panics() {
        let (env, client) = setup_env();
        let bob = Address::generate(&env);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.mark_as_read(&bob, &0u32); // empty inbox
        }));
        assert!(result.is_err(), "mark_as_read on empty inbox should panic");
    }

    // --- gasless / fee-sponsorship tests ---

    #[test]
    fn test_send_message_sponsored() {
        let (env, client) = setup_env();
        let sponsor = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.send_message_sponsored(&sponsor, &alice, &bob, &make_content(&env, b"gasless hi"));

        let msgs = client.get_messages(&bob, &0u32, &10u32);
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs.get(0).unwrap().sender, alice);

        assert_eq!(client.get_sponsored_count(&sponsor), 1);
        assert_eq!(client.get_sponsored_count(&alice), 0);
    }

    #[test]
    fn test_mark_as_read_sponsored() {
        let (env, client) = setup_env();
        let sponsor = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        // Bob receives a sponsored message, then marks it read via a sponsor too.
        client.send_message_sponsored(&sponsor, &alice, &bob, &make_content(&env, b"hi"));
        client.mark_as_read_sponsored(&sponsor, &bob, &0u32);

        let msgs = client.get_messages(&bob, &0u32, &10u32);
        assert!(msgs.get(0).unwrap().read);

        // Two sponsored actions: the send and the mark-as-read.
        assert_eq!(client.get_sponsored_count(&sponsor), 2);
    }

    #[test]
    fn test_sponsored_count_accumulates() {
        let (env, client) = setup_env();
        let sponsor = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.send_message_sponsored(&sponsor, &alice, &bob, &make_content(&env, b"m1"));
        client.send_message_sponsored(&sponsor, &alice, &bob, &make_content(&env, b"m2"));
        client.send_message_sponsored(&sponsor, &alice, &bob, &make_content(&env, b"m3"));

        assert_eq!(client.get_sponsored_count(&sponsor), 3);
        assert_eq!(client.my_message_count(&bob), 3);
    }

    #[test]
    fn test_send_message_sponsored_emits_events() {
        let (env, client) = setup_env();
        let sponsor = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.send_message_sponsored(&sponsor, &alice, &bob, &make_content(&env, b"hi"));

        // Last event should be the Sponsored event with (sponsor, sender) topics.
        let events = env.events().all();
        assert!(events.len() >= 2, "should fire MessageSent and Sponsored");
        let (_c, topics, _d) = events.get(events.len() - 1).unwrap();
        assert_eq!(topics.len(), 3);
        let sponsor_topic = Address::try_from_val(&env, &topics.get(1).unwrap()).unwrap();
        let user_topic = Address::try_from_val(&env, &topics.get(2).unwrap()).unwrap();
        assert_eq!(sponsor_topic, sponsor);
        assert_eq!(user_topic, alice);
    }

    #[test]
    fn test_send_message_sponsored_panics_without_auth() {
        let env = Env::default();
        let contract_id = env.register_contract(None, MessageContract);
        let client = MessageContractClient::new(&env, &contract_id);

        let sponsor = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.send_message_sponsored(&sponsor, &alice, &bob, &make_content(&env, b"x"));
        }));
        assert!(result.is_err());
    }
}
