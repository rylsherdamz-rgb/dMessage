#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String};

#[derive(Clone)]
#[contracttype]
pub struct UserProfile {
    pub username: String,
    pub encryption_pubkey: Bytes,
    pub metadata_ipfs: Bytes,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contract]
pub struct UserRegistry;

#[contractimpl]
impl UserRegistry {
    pub fn register_user(
        env: Env,
        caller: Address,
        username: String,
        encryption_pubkey: Bytes,
        metadata_ipfs: Bytes,
    ) {
        caller.require_auth();
        let timestamp = env.ledger().timestamp();
        let profile = UserProfile {
            username,
            encryption_pubkey,
            metadata_ipfs,
            created_at: timestamp,
            updated_at: timestamp,
        };
        env.storage().persistent().set(&caller, &profile);
    }

    pub fn get_user(env: Env, addr: Address) -> Option<UserProfile> {
        env.storage().persistent().get(&addr)
    }
}

#[cfg(test)]
extern crate std;

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Bytes, Env, String};

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
        let profile = client.get_user(&addr);
        assert!(profile.is_none());
    }

    #[test]
    fn test_register_user_updates_existing() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let caller = Address::generate(&env);

        client.register_user(
            &caller,
            &String::from_str(&env, "alice"),
            &Bytes::from_array(&env, &[1u8; 32]),
            &Bytes::new(&env),
        );

        let ipfs = Bytes::from_array(&env, &[2u8; 32]);
        client.register_user(
            &caller,
            &String::from_str(&env, "alice_updated"),
            &Bytes::from_array(&env, &[3u8; 32]),
            &ipfs,
        );

        let profile = client.get_user(&caller).unwrap();
        assert_eq!(profile.username, String::from_str(&env, "alice_updated"));
        assert_eq!(profile.encryption_pubkey, Bytes::from_array(&env, &[3u8; 32]));
        assert_eq!(profile.metadata_ipfs, Bytes::from_array(&env, &[2u8; 32]));
        assert_eq!(profile.updated_at, profile.created_at);
    }

    #[test]
    fn test_register_user_panics_without_auth() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let _caller = Address::generate(&env);
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

    #[test]
    fn test_register_user_empty_username() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let caller = Address::generate(&env);
        let empty = String::from_str(&env, "");

        client.register_user(&caller, &empty, &Bytes::from_array(&env, &[1u8; 32]), &Bytes::new(&env));

        let profile = client.get_user(&caller).unwrap();
        assert_eq!(profile.username, String::from_str(&env, ""));
    }

    #[test]
    fn test_register_user_empty_pubkey() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let caller = Address::generate(&env);

        client.register_user(
            &caller,
            &String::from_str(&env, "bob"),
            &Bytes::new(&env),
            &Bytes::new(&env),
        );

        let profile = client.get_user(&caller).unwrap();
        assert_eq!(profile.encryption_pubkey.len(), 0);
    }

    #[test]
    fn test_multiple_users() {
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
        client.register_user(
            &bob,
            &String::from_str(&env, "bob"),
            &Bytes::from_array(&env, &[2u8; 32]),
            &Bytes::new(&env),
        );

        let alice_profile = client.get_user(&alice).unwrap();
        let bob_profile = client.get_user(&bob).unwrap();

        assert_eq!(alice_profile.username, String::from_str(&env, "alice"));
        assert_eq!(bob_profile.username, String::from_str(&env, "bob"));
    }

    #[test]
    fn test_register_user_with_ipfs_metadata() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let caller = Address::generate(&env);
        let ipfs = Bytes::from_array(&env, &[0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18]);

        client.register_user(
            &caller,
            &String::from_str(&env, "ipfs_user"),
            &Bytes::from_array(&env, &[1u8; 32]),
            &ipfs,
        );

        let profile = client.get_user(&caller).unwrap();
        assert_eq!(profile.metadata_ipfs, Bytes::from_array(&env, &[0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18]));
    }
}
