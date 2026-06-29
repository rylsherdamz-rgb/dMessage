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

use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, Vec};

#[derive(Clone)]
#[contracttype]
pub struct InboxMessage {
    pub sender: Address,
    pub content: Bytes,
    pub timestamp: u64,
    pub read: bool,
}

/// Namespaced storage keys. A bare `Address` is reused as both an inbox owner and
/// a sponsor counter, so the two must be distinguished.
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Inbox(Address),
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
        let inbox: Vec<InboxMessage> = env
            .storage()
            .persistent()
            .get(&DataKey::Inbox(user))
            .unwrap_or_else(|| Vec::new(&env));

        let total = inbox.len() as u32;
        let start = page * page_size;
        let end = if start + page_size > total {
            total
        } else {
            start + page_size
        };

        if start >= total {
            return Vec::new(&env);
        }

        let mut result = Vec::new(&env);
        let mut i = start;
        while i < end {
            result.push_back(inbox.get(i).unwrap());
            i += 1;
        }
        result
    }

    pub fn my_message_count(env: Env, user: Address) -> u32 {
        let inbox: Vec<InboxMessage> = env
            .storage()
            .persistent()
            .get(&DataKey::Inbox(user))
            .unwrap_or_else(|| Vec::new(&env));
        inbox.len() as u32
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

    fn write_message(env: &Env, sender: &Address, recipient: &Address, content: Bytes) {
        let timestamp = env.ledger().timestamp();
        let key = DataKey::Inbox(recipient.clone());

        let mut inbox: Vec<InboxMessage> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(env));

        inbox.push_back(InboxMessage {
            sender: sender.clone(),
            content,
            timestamp,
            read: false,
        });

        env.storage().persistent().set(&key, &inbox);

        env.events().publish(
            ("MessageSent", sender.clone(), recipient.clone()),
            timestamp,
        );
    }

    fn set_read(env: &Env, caller: &Address, index: u32) {
        let key = DataKey::Inbox(caller.clone());
        let mut inbox: Vec<InboxMessage> = env.storage().persistent().get(&key).unwrap();
        let mut msg = inbox.get(index).unwrap();
        msg.read = true;
        inbox.set(index, msg);
        env.storage().persistent().set(&key, &inbox);
    }

    fn record_sponsorship(env: &Env, sponsor: &Address, user: &Address) {
        let key = DataKey::SponsoredCount(sponsor.clone());
        let count: u32 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(count + 1));

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
