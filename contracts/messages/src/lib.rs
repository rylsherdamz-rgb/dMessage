#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, BytesN, Env, Vec};
use soroban_sdk::xdr::ToXdr;

#[derive(Clone)]
#[contracttype]
pub struct Message {
    pub sender: Address,
    pub timestamp: u64,
    pub content_hash: BytesN<32>,
    pub content_type: u32,
}

#[contract]
pub struct MessageContract;

#[contractimpl]
impl MessageContract {
    pub fn send_message(
        env: Env,
        sender: Address,
        conversation_id: BytesN<32>,
        content_hash: BytesN<32>,
        content_type: u32,
    ) -> BytesN<32> {
        sender.require_auth();
        let timestamp = env.ledger().timestamp();

        let mut preimage = Bytes::new(&env);
        for b in conversation_id.to_array().iter() {
            preimage.push_back(*b);
        }
        for b in sender.clone().to_xdr(&env).iter() {
            preimage.push_back(b);
        }
        for b in timestamp.to_be_bytes().iter() {
            preimage.push_back(*b);
        }
        for b in content_hash.to_array().iter() {
            preimage.push_back(*b);
        }
        let message_id: BytesN<32> = env.crypto().sha256(&preimage).into();

        env.storage()
            .persistent()
            .set::<BytesN<32>, Message>(&message_id, &Message {
                sender,
                timestamp,
                content_hash,
                content_type,
            });

        let mut conv_messages: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get::<BytesN<32>, Vec<BytesN<32>>>(&conversation_id)
            .unwrap_or_else(|| Vec::new(&env));
        conv_messages.push_back(message_id.clone());
        env.storage()
            .persistent()
            .set::<BytesN<32>, Vec<BytesN<32>>>(&conversation_id, &conv_messages);

        message_id
    }

    pub fn get_messages(
        env: Env,
        conversation_id: BytesN<32>,
        page: u32,
        page_size: u32,
    ) -> Vec<Message> {
        let conv_messages: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get::<BytesN<32>, Vec<BytesN<32>>>(&conversation_id)
            .unwrap_or_else(|| Vec::new(&env));

        let total = conv_messages.len();
        let start = page * page_size;
        let end = if start + page_size > total { total } else { start + page_size };

        if start >= total {
            return Vec::new(&env);
        }

        let mut result = Vec::new(&env);
        let mut i = start;
        while i < end {
            let msg: Message = env
                .storage()
                .persistent()
                .get::<BytesN<32>, Message>(&conv_messages.get(i).unwrap())
                .unwrap();
            result.push_back(msg);
            i += 1;
        }
        result
    }
}
