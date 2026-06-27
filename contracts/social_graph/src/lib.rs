#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Vec};
use soroban_sdk::xdr::ToXdr;

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

#[contract]
pub struct SocialGraph;

#[contractimpl]
impl SocialGraph {
    pub fn ensure_conversation(
        env: Env,
        caller: Address,
        user_a: Address,
        user_b: Address,
    ) -> BytesN<32> {
        caller.require_auth();

        let (addr1, addr2) = if user_a < user_b {
            (user_a.clone(), user_b.clone())
        } else {
            (user_b.clone(), user_a.clone())
        };

        let xdr_a = addr1.clone().to_xdr(&env);
        let xdr_b = addr2.clone().to_xdr(&env);
        let mut preimage = soroban_sdk::Bytes::new(&env);
        for b in xdr_a.iter() {
            preimage.push_back(b);
        }
        for b in xdr_b.iter() {
            preimage.push_back(b);
        }
        let conversation_id: BytesN<32> = env.crypto().sha256(&preimage).into();

        let timestamp = env.ledger().timestamp();

        if !env
            .storage()
            .persistent()
            .has::<BytesN<32>>(&conversation_id)
        {
            env.storage()
                .persistent()
                .set::<BytesN<32>, Conversation>(
                    &conversation_id,
                    &Conversation {
                        participant_a: addr1,
                        participant_b: addr2,
                        created_at: timestamp,
                        last_updated: timestamp,
                    },
                );
        } else {
            let mut conv = env
                .storage()
                .persistent()
                .get::<BytesN<32>, Conversation>(&conversation_id)
                .unwrap();
            conv.last_updated = timestamp;
            env.storage()
                .persistent()
                .set::<BytesN<32>, Conversation>(&conversation_id, &conv);
        }

        Self::add_user_conversation(&env, &user_a, &user_b, &conversation_id, timestamp);
        Self::add_user_conversation(&env, &user_b, &user_a, &conversation_id, timestamp);

        conversation_id
    }

    fn add_user_conversation(
        env: &Env,
        user: &Address,
        peer: &Address,
        conv_id: &BytesN<32>,
        timestamp: u64,
    ) {
        let mut convs: Vec<ConversationRef> = env
            .storage()
            .persistent()
            .get::<Address, Vec<ConversationRef>>(user)
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

        env.storage()
            .persistent()
            .set::<Address, Vec<ConversationRef>>(user, &convs);
    }

    pub fn get_user_conversations(env: Env, user_addr: Address) -> Vec<ConversationRef> {
        env.storage()
            .persistent()
            .get::<Address, Vec<ConversationRef>>(&user_addr)
            .unwrap_or_else(|| Vec::new(&env))
    }
}

#[cfg(test)]
extern crate std;

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger as _};
    use soroban_sdk::Env;

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

        // Ensure conversation with alice + bob
        let id1 = client.ensure_conversation(&caller, &alice, &bob);
        // Ensure again — should return same ID
        let id2 = client.ensure_conversation(&caller, &alice, &bob);
        assert_eq!(id1, id2, "same participants should yield same conversation ID");

        // Ensure with participants in reverse order — should yield same ID
        let id3 = client.ensure_conversation(&caller, &bob, &alice);
        assert_eq!(id1, id3, "reversed participants should yield same conversation ID");
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

        assert_eq!(alice_convs.len(), 1, "alice should have 1 conversation ref");
        assert_eq!(bob_convs.len(), 1, "bob should have 1 conversation ref");
        assert_eq!(alice_convs.get(0).unwrap().conversation_id, bob_convs.get(0).unwrap().conversation_id, "both participants should see same conversation ID");
    }

    #[test]
    fn test_get_user_conversations_empty() {
        let (env, client) = setup_env();
        let user = Address::generate(&env);

        let convs = client.get_user_conversations(&user);
        assert!(convs.is_empty(), "user with no conversations should get empty list");
    }

    #[test]
    fn test_ensure_conversation_updates_timestamp() {
        let (env, client) = setup_env();
        let caller = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        // First ensure with default timestamp
        let _id = client.ensure_conversation(&caller, &alice, &bob);
        let alice_convs = client.get_user_conversations(&alice);
        let first_ts = alice_convs.get(0).unwrap().last_updated;

        // Jump time forward
        env.ledger().set_timestamp(1000000);

        // Re-ensure
        client.ensure_conversation(&caller, &alice, &bob);
        let alice_convs2 = client.get_user_conversations(&alice);
        let second_ts = alice_convs2.get(0).unwrap().last_updated;

        assert!(second_ts > first_ts, "last_updated should increase on re-ensure ({} ≯ {})", second_ts, first_ts);
    }

    #[test]
    fn test_ensure_conversation_no_duplicate_refs() {
        let (env, client) = setup_env();
        let caller = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        // Ensure the same conversation multiple times
        client.ensure_conversation(&caller, &alice, &bob);
        client.ensure_conversation(&caller, &alice, &bob);
        client.ensure_conversation(&caller, &alice, &bob);

        let alice_convs = client.get_user_conversations(&alice);
        assert_eq!(alice_convs.len(), 1, "duplicate ensures should not create duplicate refs");
    }

    #[test]
    fn test_multiple_conversations_per_user() {
        let (env, client) = setup_env();
        let caller = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let charlie = Address::generate(&env);

        client.ensure_conversation(&caller, &alice, &bob);
        client.ensure_conversation(&caller, &alice, &charlie);

        let alice_convs = client.get_user_conversations(&alice);
        assert_eq!(alice_convs.len(), 2, "alice should have 2 conversations");

        // Verify both peers are correct
        let peers = alice_convs.iter().map(|c| c.peer_address);
        let mut found_bob = false;
        let mut found_charlie = false;
        for p in peers {
            if p == bob { found_bob = true; }
            if p == charlie { found_charlie = true; }
        }
        assert!(found_bob, "should contain bob as peer");
        assert!(found_charlie, "should contain charlie as peer");

        // Bob should only have 1 conversation (with alice)
        let bob_convs = client.get_user_conversations(&bob);
        assert_eq!(bob_convs.len(), 1, "bob should have 1 conversation");
        assert_eq!(bob_convs.get(0).unwrap().peer_address, alice);
    }

    #[test]
    fn test_ensure_conversation_self_conversation() {
        let (env, client) = setup_env();
        let caller = Address::generate(&env);

        // Same address for both participants — edge case
        let _id = client.ensure_conversation(&caller, &caller, &caller);
        let convs = client.get_user_conversations(&caller);
        assert_eq!(convs.len(), 1, "self-conversation should be created");
        assert_eq!(convs.get(0).unwrap().peer_address, caller);
    }

    #[test]
    fn test_ensure_conversation_panics_without_auth() {
        let env = Env::default();
        let contract_id = env.register_contract(None, SocialGraph);
        let client = SocialGraphClient::new(&env, &contract_id);

        let caller = Address::generate(&env);
        let other = Address::generate(&env);
        let bob = Address::generate(&env);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            // Use `other` as caller — not the same as the address authorized
            client.ensure_conversation(&other, &caller, &bob);
        }));
        assert!(result.is_err(), "ensure_conversation should panic without auth");
    }

    #[test]
    fn test_ensure_conversation_different_callers_same_participants() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let charlie = Address::generate(&env);

        // Alice ensures a conversation with Bob
        let id1 = client.ensure_conversation(&alice, &alice, &bob);

        // Charlie ensures the same conversation (alice + bob)
        let id2 = client.ensure_conversation(&charlie, &alice, &bob);

        // Should be the same conversation ID
        assert_eq!(id1, id2, "same participants should yield same ID regardless of who calls");
    }
}
