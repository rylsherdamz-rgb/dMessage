#![no_std]
//! # SocialGraph (Gasless / Fee-Sponsored edition)
//!
//! Fee-sponsorship–aware copy of the original `social_graph` contract.
//!
//! ## How "gasless" works on Stellar
//!
//! Stellar fees are paid in XLM. A new user with no XLM cannot self-submit a
//! transaction, so Stellar's **fee-bump transaction** lets a sponsor/relayer pay:
//!
//! 1. The user signs the Soroban auth entries for the inner transaction that
//!    invokes this contract (satisfying `caller.require_auth()`).
//! 2. A sponsor account wraps it in a `FeeBumpTransaction` (fee source = sponsor),
//!    signs the outer envelope, and submits it.
//! 3. The sponsor pays the XLM fee; the user pays nothing.
//!
//! Fee-bump is transparent to contract code, so `ensure_conversation` already
//! works under it. The `*_sponsored` variant adds **on-chain sponsorship
//! accounting**: the sponsor co-authorizes, the action is counted per sponsor,
//! and a `Sponsored` event is emitted.

use soroban_sdk::xdr::ToXdr;
use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Vec};

#[derive(Clone)]
#[contracttype]
pub struct ConversationRef {
    pub conversation_id: BytesN<32>,
    pub peer_address: Address,
    pub last_updated: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct Conversation {
    pub participant_a: Address,
    pub participant_b: Address,
    pub created_at: u64,
    pub last_updated: u64,
}

/// Namespaced storage keys. A bare `Address` is reused as both a per-user
/// conversation list and a sponsor counter, so they must be distinguished.
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Conversation(BytesN<32>),
    UserConvs(Address),
    SponsoredCount(Address),
}

#[contract]
pub struct SocialGraph;

#[contractimpl]
impl SocialGraph {
    /// Standard self-paid conversation ensure (or transparently fee-bumped).
    pub fn ensure_conversation(
        env: Env,
        caller: Address,
        user_a: Address,
        user_b: Address,
    ) -> BytesN<32> {
        caller.require_auth();
        Self::ensure_internal(&env, &user_a, &user_b)
    }

    /// Fee-sponsored ("gasless") conversation ensure.
    ///
    /// Designed to ride inside a Stellar fee-bump transaction whose fee source is
    /// `sponsor`. The sponsor co-authorizes so the on-chain sponsorship tally is
    /// trustworthy; `caller` still authorizes the action itself.
    pub fn ensure_conversation_sponsored(
        env: Env,
        sponsor: Address,
        caller: Address,
        user_a: Address,
        user_b: Address,
    ) -> BytesN<32> {
        sponsor.require_auth();
        caller.require_auth();

        let id = Self::ensure_internal(&env, &user_a, &user_b);
        Self::record_sponsorship(&env, &sponsor, &caller);
        id
    }

    pub fn get_user_conversations(env: Env, user_addr: Address) -> Vec<ConversationRef> {
        env.storage()
            .persistent()
            .get(&DataKey::UserConvs(user_addr))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Number of actions a sponsor has paid for through this contract.
    pub fn get_sponsored_count(env: Env, sponsor: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::SponsoredCount(sponsor))
            .unwrap_or(0)
    }

    // --- internal helpers ---

    fn ensure_internal(env: &Env, user_a: &Address, user_b: &Address) -> BytesN<32> {
        let (addr1, addr2) = if user_a < user_b {
            (user_a.clone(), user_b.clone())
        } else {
            (user_b.clone(), user_a.clone())
        };

        let xdr_a = addr1.clone().to_xdr(env);
        let xdr_b = addr2.clone().to_xdr(env);
        let mut preimage = soroban_sdk::Bytes::new(env);
        for b in xdr_a.iter() {
            preimage.push_back(b);
        }
        for b in xdr_b.iter() {
            preimage.push_back(b);
        }
        let conversation_id: BytesN<32> = env.crypto().sha256(&preimage).into();

        let timestamp = env.ledger().timestamp();
        let conv_key = DataKey::Conversation(conversation_id.clone());

        if !env.storage().persistent().has(&conv_key) {
            env.storage().persistent().set(
                &conv_key,
                &Conversation {
                    participant_a: addr1,
                    participant_b: addr2,
                    created_at: timestamp,
                    last_updated: timestamp,
                },
            );
        } else {
            let mut conv: Conversation = env.storage().persistent().get(&conv_key).unwrap();
            conv.last_updated = timestamp;
            env.storage().persistent().set(&conv_key, &conv);
        }

        Self::add_user_conversation(env, user_a, user_b, &conversation_id, timestamp);
        Self::add_user_conversation(env, user_b, user_a, &conversation_id, timestamp);

        conversation_id
    }

    fn add_user_conversation(
        env: &Env,
        user: &Address,
        peer: &Address,
        conv_id: &BytesN<32>,
        timestamp: u64,
    ) {
        let key = DataKey::UserConvs(user.clone());
        let mut convs: Vec<ConversationRef> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(env));

        let mut found = false;
        let mut i = 0;
        while i < convs.len() {
            let mut ref_entry = convs.get(i).unwrap();
            if ref_entry.conversation_id == *conv_id {
                ref_entry.last_updated = timestamp;
                convs.set(i, ref_entry);
                found = true;
                break;
            }
            i += 1;
        }

        if !found {
            convs.push_back(ConversationRef {
                conversation_id: conv_id.clone(),
                peer_address: peer.clone(),
                last_updated: timestamp,
            });
        }

        env.storage().persistent().set(&key, &convs);
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
    use soroban_sdk::testutils::{Address as _, Events as _, Ledger as _};
    use soroban_sdk::{Env, TryFromVal};

    fn setup_env() -> (Env, SocialGraphClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, SocialGraph);
        let client = SocialGraphClient::new(&env, &contract_id);
        (env, client)
    }

    #[test]
    fn test_ensure_conversation_deterministic_id() {
        let (env, client) = setup_env();
        let caller = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        let id1 = client.ensure_conversation(&caller, &alice, &bob);
        let id2 = client.ensure_conversation(&caller, &alice, &bob);
        assert_eq!(id1, id2);
        let id3 = client.ensure_conversation(&caller, &bob, &alice);
        assert_eq!(id1, id3);
    }

    #[test]
    fn test_get_user_conversations_for_participants() {
        let (env, client) = setup_env();
        let caller = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.ensure_conversation(&caller, &alice, &bob);

        let alice_convs = client.get_user_conversations(&alice);
        let bob_convs = client.get_user_conversations(&bob);
        assert_eq!(alice_convs.len(), 1);
        assert_eq!(bob_convs.len(), 1);
        assert_eq!(
            alice_convs.get(0).unwrap().conversation_id,
            bob_convs.get(0).unwrap().conversation_id
        );
    }

    #[test]
    fn test_ensure_conversation_panics_without_auth() {
        let env = Env::default();
        let contract_id = env.register_contract(None, SocialGraph);
        let client = SocialGraphClient::new(&env, &contract_id);

        let other = Address::generate(&env);
        let caller = Address::generate(&env);
        let bob = Address::generate(&env);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.ensure_conversation(&other, &caller, &bob);
        }));
        assert!(result.is_err());
    }

    // --- gasless / fee-sponsorship tests ---

    #[test]
    fn test_ensure_conversation_sponsored() {
        let (env, client) = setup_env();
        let sponsor = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        // Sponsored call yields the same deterministic id as the plain call.
        let sponsored_id = client.ensure_conversation_sponsored(&sponsor, &alice, &alice, &bob);
        let plain_id = client.ensure_conversation(&alice, &alice, &bob);
        assert_eq!(sponsored_id, plain_id);

        // Conversation refs are written for both participants.
        assert_eq!(client.get_user_conversations(&alice).len(), 1);
        assert_eq!(client.get_user_conversations(&bob).len(), 1);

        // Sponsor accounting incremented; a participant has no sponsorship tally.
        assert_eq!(client.get_sponsored_count(&sponsor), 1);
        assert_eq!(client.get_sponsored_count(&alice), 0);
    }

    #[test]
    fn test_sponsored_count_accumulates() {
        let (env, client) = setup_env();
        let sponsor = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let charlie = Address::generate(&env);

        client.ensure_conversation_sponsored(&sponsor, &alice, &alice, &bob);
        client.ensure_conversation_sponsored(&sponsor, &alice, &alice, &charlie);
        assert_eq!(client.get_sponsored_count(&sponsor), 2);
    }

    #[test]
    fn test_ensure_conversation_sponsored_updates_timestamp() {
        let (env, client) = setup_env();
        let sponsor = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.ensure_conversation_sponsored(&sponsor, &alice, &alice, &bob);
        let first_ts = client.get_user_conversations(&alice).get(0).unwrap().last_updated;

        env.ledger().set_timestamp(1_000_000);
        client.ensure_conversation_sponsored(&sponsor, &alice, &alice, &bob);
        let second_ts = client.get_user_conversations(&alice).get(0).unwrap().last_updated;

        assert!(second_ts > first_ts);
        // Still one ref (no duplicate), but two sponsored actions counted.
        assert_eq!(client.get_user_conversations(&alice).len(), 1);
        assert_eq!(client.get_sponsored_count(&sponsor), 2);
    }

    #[test]
    fn test_ensure_conversation_sponsored_emits_event() {
        let (env, client) = setup_env();
        let sponsor = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.ensure_conversation_sponsored(&sponsor, &alice, &alice, &bob);

        let events = env.events().all();
        assert!(events.len() > 0);
        let (_c, topics, _d) = events.get(events.len() - 1).unwrap();
        assert_eq!(topics.len(), 3);
        let sponsor_topic = Address::try_from_val(&env, &topics.get(1).unwrap()).unwrap();
        let user_topic = Address::try_from_val(&env, &topics.get(2).unwrap()).unwrap();
        assert_eq!(sponsor_topic, sponsor);
        assert_eq!(user_topic, alice);
    }

    #[test]
    fn test_ensure_conversation_sponsored_panics_without_auth() {
        let env = Env::default();
        let contract_id = env.register_contract(None, SocialGraph);
        let client = SocialGraphClient::new(&env, &contract_id);

        let sponsor = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.ensure_conversation_sponsored(&sponsor, &alice, &alice, &bob);
        }));
        assert!(result.is_err());
    }
}
