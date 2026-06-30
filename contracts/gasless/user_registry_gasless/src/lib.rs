#![no_std]
//! # UserRegistry (Gasless / Fee-Sponsored edition)
//!
//! This is a fee-sponsorship–aware copy of the original `user_registry` contract.
//!
//! ## How "gasless" works on Stellar
//!
//! Stellar pays transaction fees in XLM. A brand-new user usually has **no XLM**,
//! so they cannot submit a transaction on their own. Stellar solves this at the
//! *transaction-envelope* layer with a **fee-bump transaction**:
//!
//! 1. The user builds the inner transaction that invokes this contract and signs
//!    the Soroban authorization entries (proving `caller.require_auth()`).
//! 2. A **sponsor / relayer** account wraps that signed inner transaction in a
//!    `FeeBumpTransaction` whose *fee source* is the sponsor.
//! 3. The sponsor signs the outer envelope and submits it. The **sponsor pays the
//!    XLM fee**; the user pays nothing — a gasless experience.
//!
//! Because fee-bump is transparent to contract code, the original `register_user`
//! already works under a fee-bump. What a contract *can* add is **on-chain
//! accountability**: who sponsored which action and how many actions a sponsor
//! has paid for. The `*_sponsored` functions below capture exactly that — the
//! sponsor co-authorizes (so a relayer cannot attribute spend to a sponsor that
//! never agreed), the sponsorship is counted, and a `Sponsored` event is emitted.

use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String};

/// X25519 public keys are exactly 32 bytes (M-2). Empty/wrong-length keys would
/// silently break end-to-end encryption for anyone messaging this user.
const PUBKEY_LEN: u32 = 32;
/// Bounds on user-supplied strings/blobs to keep entries small.
const MAX_USERNAME_LEN: u32 = 64;
const MAX_METADATA_LEN: u32 = 128;

// --- persistent-entry TTL management (M-1) ---
const DAY_IN_LEDGERS: u32 = 17_280; // ~5s ledgers
const BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const LIFETIME_THRESHOLD: u32 = BUMP_AMOUNT - DAY_IN_LEDGERS;

#[derive(Clone)]
#[contracttype]
pub struct UserProfile {
    pub username: String,
    pub encryption_pubkey: Bytes,
    pub metadata_ipfs: Bytes,
    pub created_at: u64,
    pub updated_at: u64,
}

/// Namespaced storage keys. Needed because the same `Address` can appear both as
/// a registered user (Profile) and as a fee sponsor (SponsoredCount); keying both
/// by a bare `Address` would collide. `Username` is a reverse index enforcing
/// global username uniqueness (M-3).
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Profile(Address),
    SponsoredCount(Address),
    Username(String),
}

#[contract]
pub struct UserRegistry;

#[contractimpl]
impl UserRegistry {
    /// Standard self-paid registration. The caller submits and pays for their own
    /// transaction (or it can still be fee-bumped transparently by a sponsor).
    pub fn register_user(
        env: Env,
        caller: Address,
        username: String,
        encryption_pubkey: Bytes,
        metadata_ipfs: Bytes,
    ) {
        caller.require_auth();
        Self::write_profile(&env, &caller, username, encryption_pubkey, metadata_ipfs);
    }

    /// Fee-sponsored ("gasless") registration.
    ///
    /// Intended to be submitted inside a Stellar **fee-bump transaction** whose
    /// fee source is `sponsor`, so the new user spends no XLM.
    ///
    /// - `sponsor.require_auth()` — the sponsor explicitly consents to backing this
    ///   action, so on-chain sponsorship accounting cannot be forged.
    /// - `caller.require_auth()` — the user still authorizes their own profile write.
    pub fn register_user_sponsored(
        env: Env,
        sponsor: Address,
        caller: Address,
        username: String,
        encryption_pubkey: Bytes,
        metadata_ipfs: Bytes,
    ) {
        sponsor.require_auth();
        caller.require_auth();

        Self::write_profile(&env, &caller, username, encryption_pubkey, metadata_ipfs);
        Self::record_sponsorship(&env, &sponsor, &caller);
    }

    pub fn get_user(env: Env, addr: Address) -> Option<UserProfile> {
        env.storage().persistent().get(&DataKey::Profile(addr))
    }

    /// Number of actions a sponsor has paid for through this contract.
    pub fn get_sponsored_count(env: Env, sponsor: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::SponsoredCount(sponsor))
            .unwrap_or(0)
    }

    // --- internal helpers ---

    fn write_profile(
        env: &Env,
        caller: &Address,
        username: String,
        encryption_pubkey: Bytes,
        metadata_ipfs: Bytes,
    ) {
        // M-2: enforce a valid X25519 public key length.
        if encryption_pubkey.len() != PUBKEY_LEN {
            panic!("encryption_pubkey must be 32 bytes");
        }
        // Bound user-supplied fields.
        let uname_len = username.len();
        if uname_len == 0 || uname_len > MAX_USERNAME_LEN {
            panic!("username must be 1..=64 bytes");
        }
        if metadata_ipfs.len() > MAX_METADATA_LEN {
            panic!("metadata_ipfs too large");
        }

        // M-3: usernames are globally unique. Reject if the name is owned by a
        // different address.
        let uname_key = DataKey::Username(username.clone());
        if let Some(owner) = env
            .storage()
            .persistent()
            .get::<DataKey, Address>(&uname_key)
        {
            if owner != *caller {
                panic!("username already taken");
            }
        }

        // L-1: preserve the original created_at on update; release a prior
        // username if the user is changing it.
        let profile_key = DataKey::Profile(caller.clone());
        let now = env.ledger().timestamp();
        let created_at = match env
            .storage()
            .persistent()
            .get::<DataKey, UserProfile>(&profile_key)
        {
            Some(existing) => {
                if existing.username != username {
                    env.storage()
                        .persistent()
                        .remove(&DataKey::Username(existing.username));
                }
                existing.created_at
            }
            None => now,
        };

        // Claim the username for this address.
        env.storage().persistent().set(&uname_key, caller);
        env.storage()
            .persistent()
            .extend_ttl(&uname_key, LIFETIME_THRESHOLD, BUMP_AMOUNT);

        let profile = UserProfile {
            username,
            encryption_pubkey,
            metadata_ipfs,
            created_at,
            updated_at: now,
        };
        env.storage().persistent().set(&profile_key, &profile);
        env.storage()
            .persistent()
            .extend_ttl(&profile_key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
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
    use soroban_sdk::{Bytes, Env, String, TryFromVal};

    #[test]
    fn test_register_and_get_user() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let caller = Address::generate(&env);
        let username = String::from_str(&env, "alice");
        let pubkey = Bytes::from_array(&env, &[1u8; 32]);

        client.register_user(&caller, &username, &pubkey, &Bytes::new(&env));

        let profile = client.get_user(&caller).unwrap();
        assert_eq!(profile.username, String::from_str(&env, "alice"));
        assert_eq!(profile.encryption_pubkey, Bytes::from_array(&env, &[1u8; 32]));
        assert!(profile.metadata_ipfs.is_empty());
        assert_eq!(profile.created_at, profile.updated_at);
    }

    #[test]
    fn test_get_user_nonexistent() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let addr = Address::generate(&env);
        assert!(client.get_user(&addr).is_none());
    }

    #[test]
    fn test_register_user_panics_without_auth() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let other = Address::generate(&env);
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.register_user(
                &other,
                &String::from_str(&env, "unauthorized"),
                &Bytes::from_array(&env, &[0u8; 32]),
                &Bytes::new(&env),
            );
        }));
        assert!(result.is_err(), "register_user should panic without auth");
    }

    // --- security hardening regression tests ---

    // M-2: a non-32-byte encryption pubkey is rejected.
    #[test]
    fn test_register_rejects_invalid_pubkey() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let caller = Address::generate(&env);

        let empty = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.register_user(
                &caller,
                &String::from_str(&env, "alice"),
                &Bytes::new(&env),
                &Bytes::new(&env),
            );
        }));
        assert!(empty.is_err(), "empty pubkey must be rejected");

        let short = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.register_user(
                &caller,
                &String::from_str(&env, "alice"),
                &Bytes::from_array(&env, &[1u8; 16]),
                &Bytes::new(&env),
            );
        }));
        assert!(short.is_err(), "short pubkey must be rejected");
    }

    // M-2: empty username is rejected.
    #[test]
    fn test_register_rejects_empty_username() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let caller = Address::generate(&env);
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.register_user(
                &caller,
                &String::from_str(&env, ""),
                &Bytes::from_array(&env, &[1u8; 32]),
                &Bytes::new(&env),
            );
        }));
        assert!(result.is_err(), "empty username must be rejected");
    }

    // M-3: a second address cannot claim a username already taken.
    #[test]
    fn test_username_uniqueness() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let alice = Address::generate(&env);
        let mallory = Address::generate(&env);

        client.register_user(
            &alice,
            &String::from_str(&env, "alice"),
            &Bytes::from_array(&env, &[1u8; 32]),
            &Bytes::new(&env),
        );

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.register_user(
                &mallory,
                &String::from_str(&env, "alice"),
                &Bytes::from_array(&env, &[2u8; 32]),
                &Bytes::new(&env),
            );
        }));
        assert!(result.is_err(), "duplicate username must be rejected");
    }

    // M-3: the same address may re-register / update with its own username, and
    // changing the username frees the old one for others.
    #[test]
    fn test_username_update_and_release() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.register_user(
            &alice,
            &String::from_str(&env, "alice"),
            &Bytes::from_array(&env, &[1u8; 32]),
            &Bytes::new(&env),
        );
        // Same address keeps its own name (no false "taken" error).
        client.register_user(
            &alice,
            &String::from_str(&env, "alice"),
            &Bytes::from_array(&env, &[9u8; 32]),
            &Bytes::new(&env),
        );
        // Alice renames; "alice" is released.
        client.register_user(
            &alice,
            &String::from_str(&env, "alice2"),
            &Bytes::from_array(&env, &[9u8; 32]),
            &Bytes::new(&env),
        );
        // Bob can now take the freed "alice".
        client.register_user(
            &bob,
            &String::from_str(&env, "alice"),
            &Bytes::from_array(&env, &[2u8; 32]),
            &Bytes::new(&env),
        );
        assert_eq!(client.get_user(&bob).unwrap().username, String::from_str(&env, "alice"));
        assert_eq!(client.get_user(&alice).unwrap().username, String::from_str(&env, "alice2"));
    }

    // L-1: created_at is preserved across updates; only updated_at advances.
    #[test]
    fn test_created_at_preserved_on_update() {
        use soroban_sdk::testutils::Ledger as _;
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let alice = Address::generate(&env);
        env.ledger().set_timestamp(100);
        client.register_user(
            &alice,
            &String::from_str(&env, "alice"),
            &Bytes::from_array(&env, &[1u8; 32]),
            &Bytes::new(&env),
        );
        let first = client.get_user(&alice).unwrap();
        assert_eq!(first.created_at, 100);
        assert_eq!(first.updated_at, 100);

        env.ledger().set_timestamp(500);
        client.register_user(
            &alice,
            &String::from_str(&env, "alice"),
            &Bytes::from_array(&env, &[2u8; 32]),
            &Bytes::new(&env),
        );
        let second = client.get_user(&alice).unwrap();
        assert_eq!(second.created_at, 100, "created_at must be preserved");
        assert_eq!(second.updated_at, 500, "updated_at must advance");
    }

    // --- gasless / fee-sponsorship tests ---

    #[test]
    fn test_register_user_sponsored() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let sponsor = Address::generate(&env);
        let alice = Address::generate(&env);

        client.register_user_sponsored(
            &sponsor,
            &alice,
            &String::from_str(&env, "alice"),
            &Bytes::from_array(&env, &[1u8; 32]),
            &Bytes::new(&env),
        );

        // The user's profile is written exactly as in the non-sponsored path.
        let profile = client.get_user(&alice).unwrap();
        assert_eq!(profile.username, String::from_str(&env, "alice"));

        // The sponsor's on-chain action count is incremented.
        assert_eq!(client.get_sponsored_count(&sponsor), 1);
        // A user who never sponsored anything has a zero count.
        assert_eq!(client.get_sponsored_count(&alice), 0);
    }

    #[test]
    fn test_sponsored_count_accumulates() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let sponsor = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.register_user_sponsored(
            &sponsor,
            &alice,
            &String::from_str(&env, "alice"),
            &Bytes::from_array(&env, &[1u8; 32]),
            &Bytes::new(&env),
        );
        client.register_user_sponsored(
            &sponsor,
            &bob,
            &String::from_str(&env, "bob"),
            &Bytes::from_array(&env, &[2u8; 32]),
            &Bytes::new(&env),
        );

        assert_eq!(client.get_sponsored_count(&sponsor), 2);
    }

    #[test]
    fn test_register_user_sponsored_emits_event() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let sponsor = Address::generate(&env);
        let alice = Address::generate(&env);

        client.register_user_sponsored(
            &sponsor,
            &alice,
            &String::from_str(&env, "alice"),
            &Bytes::from_array(&env, &[1u8; 32]),
            &Bytes::new(&env),
        );

        let events = env.events().all();
        assert!(events.len() > 0, "should fire a Sponsored event");
        let (_c, topics, _d) = events.get(events.len() - 1).unwrap();
        assert_eq!(topics.len(), 3, "Sponsored event should have 3 topics");
        let sponsor_topic = Address::try_from_val(&env, &topics.get(1).unwrap()).unwrap();
        let user_topic = Address::try_from_val(&env, &topics.get(2).unwrap()).unwrap();
        assert_eq!(sponsor_topic, sponsor);
        assert_eq!(user_topic, alice);
    }

    #[test]
    fn test_register_user_sponsored_panics_without_sponsor_auth() {
        let env = Env::default();
        // No mock_all_auths(): neither sponsor nor caller is authorized.
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let sponsor = Address::generate(&env);
        let alice = Address::generate(&env);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.register_user_sponsored(
                &sponsor,
                &alice,
                &String::from_str(&env, "alice"),
                &Bytes::new(&env),
                &Bytes::new(&env),
            );
        }));
        assert!(result.is_err(), "sponsored register should panic without auth");
    }
}
