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

        let exists = convs.iter().any(|c| c.conversation_id == *conv_id);
        if !exists {
            convs.push_back(ConversationRef {
                conversation_id: conv_id.clone(),
                peer_address: peer.clone(),
                last_updated: timestamp,
            });
            env.storage()
                .persistent()
                .set::<Address, Vec<ConversationRef>>(user, &convs);
        }
    }

    pub fn get_user_conversations(env: Env, user_addr: Address) -> Vec<ConversationRef> {
        env.storage()
            .persistent()
            .get::<Address, Vec<ConversationRef>>(&user_addr)
            .unwrap_or_else(|| Vec::new(&env))
    }
}
