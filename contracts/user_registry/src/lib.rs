#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, BytesN, Env, String};

#[derive(Clone)]
#[contracttype]
pub struct UserProfile {
    pub username: String,
    pub encryption_pubkey: Bytes,
    pub metadata_ipfs: Option<BytesN<32>>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contract]
pub struct UserRegistry;

#[contractimpl]
impl UserRegistry {
    pub fn register_user(
        env: Env,
        username: String,
        encryption_pubkey: Bytes,
        metadata_ipfs: Option<BytesN<32>>,
    ) {
        let addr = env.caller();
        let timestamp = env.ledger().timestamp();
        let profile = UserProfile {
            username,
            encryption_pubkey,
            metadata_ipfs,
            created_at: timestamp,
            updated_at: timestamp,
        };
        env.storage().persistent().set(&addr, &profile);
    }

    pub fn get_user(env: Env, addr: Address) -> Option<UserProfile> {
        env.storage().persistent().get(&addr)
    }
}
