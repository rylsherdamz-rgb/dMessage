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

#[cfg(test)]
extern crate std;

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger as _};
    use soroban_sdk::{Bytes, BytesN, Env};

    fn setup_env() -> (Env, MessageContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, MessageContract);
        let client = MessageContractClient::new(&env, &contract_id);
        (env, client)
    }

    fn make_conversation_id(env: &Env, alice: &Address, bob: &Address) -> BytesN<32> {
        let mut preimage = Bytes::new(env);
        for b in alice.to_xdr(env).iter() {
            preimage.push_back(b);
        }
        for b in bob.to_xdr(env).iter() {
            preimage.push_back(b);
        }
        env.crypto().sha256(&preimage).into()
    }

    fn make_content_hash(env: &Env, val: &[u8; 32]) -> BytesN<32> {
        BytesN::from_array(env, val)
    }

    #[test]
    fn test_send_and_get_messages() {
        let (env, client) = setup_env();
        let sender = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let conv_id = make_conversation_id(&env, &alice, &bob);
        let content_hash = make_content_hash(&env, &[1u8; 32]);

        let _message_id = client.send_message(&sender, &conv_id, &content_hash, &0u32);
        let messages = client.get_messages(&conv_id, &0u32, &10u32);

        assert_eq!(messages.len(), 1, "should have 1 message");
        let msg = messages.get(0).unwrap();
        assert_eq!(msg.sender, sender);
        assert_eq!(msg.content_hash, content_hash);
        assert_eq!(msg.content_type, 0u32);
    }

    #[test]
    fn test_send_message_deterministic_id() {
        let (env, client) = setup_env();
        let sender = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let conv_id = make_conversation_id(&env, &alice, &bob);
        let content_hash = make_content_hash(&env, &[1u8; 32]);

        let id1 = client.send_message(&sender, &conv_id, &content_hash, &0u32);

        // Advance ledger so next message gets a different timestamp
        env.ledger().set_timestamp(env.ledger().timestamp() + 1);

        let id2 = client.send_message(&sender, &conv_id, &content_hash, &0u32);

        assert_ne!(id1, id2, "different timestamps should produce different message IDs");
    }

    #[test]
    fn test_get_messages_pagination() {
        let (env, client) = setup_env();
        let sender = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let conv_id = make_conversation_id(&env, &alice, &bob);

        // Send 5 messages
        for i in 0u8..5u8 {
            let ch = make_content_hash(&env, &[i; 32]);
            client.send_message(&sender, &conv_id, &ch, &(i as u32));
        }

        // Page 0, size 2 → messages 0,1
        let page0 = client.get_messages(&conv_id, &0u32, &2u32);
        assert_eq!(page0.len(), 2, "page 0 should have 2 messages");

        // Page 1, size 2 → messages 2,3
        let page1 = client.get_messages(&conv_id, &1u32, &2u32);
        assert_eq!(page1.len(), 2, "page 1 should have 2 messages");

        // Page 2, size 2 → message 4
        let page2 = client.get_messages(&conv_id, &2u32, &2u32);
        assert_eq!(page2.len(), 1, "page 2 should have 1 message");

        // Page 3, size 2 → empty
        let page3 = client.get_messages(&conv_id, &3u32, &2u32);
        assert!(page3.is_empty(), "page 3 should be empty");
    }

    #[test]
    fn test_get_messages_ordering() {
        let (env, client) = setup_env();
        let sender = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let conv_id = make_conversation_id(&env, &alice, &bob);

        // Send messages with content_type 0,1,2 marking order
        for i in 0u8..3u8 {
            let ch = make_content_hash(&env, &[i; 32]);
            client.send_message(&sender, &conv_id, &ch, &(i as u32));
        }

        let messages = client.get_messages(&conv_id, &0u32, &10u32);
        assert_eq!(messages.len(), 3);
        // Content types should be in order 0,1,2 (FIFO)
        assert_eq!(messages.get(0).unwrap().content_type, 0u32);
        assert_eq!(messages.get(1).unwrap().content_type, 1u32);
        assert_eq!(messages.get(2).unwrap().content_type, 2u32);
    }

    #[test]
    fn test_get_messages_unknown_conversation() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let conv_id = make_conversation_id(&env, &alice, &bob);

        let messages = client.get_messages(&conv_id, &0u32, &10u32);
        assert!(messages.is_empty(), "unknown conversation should return empty messages");
    }

    #[test]
    fn test_multiple_conversations_isolation() {
        let (env, client) = setup_env();
        let sender = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let charlie = Address::generate(&env);

        let conv_ab = make_conversation_id(&env, &alice, &bob);
        let conv_ac = make_conversation_id(&env, &alice, &charlie);

        client.send_message(&sender, &conv_ab, &make_content_hash(&env, &[1u8; 32]), &0u32);
        client.send_message(&sender, &conv_ac, &make_content_hash(&env, &[2u8; 32]), &0u32);

        let msgs_ab = client.get_messages(&conv_ab, &0u32, &10u32);
        let msgs_ac = client.get_messages(&conv_ac, &0u32, &10u32);

        assert_eq!(msgs_ab.len(), 1, "conversation AB should have 1 message");
        assert_eq!(msgs_ac.len(), 1, "conversation AC should have 1 message");
        assert_ne!(msgs_ab.get(0).unwrap().content_hash, msgs_ac.get(0).unwrap().content_hash, "different conversations should have different messages");
    }

    #[test]
    fn test_send_message_multiple_types() {
        let (env, client) = setup_env();
        let sender = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let conv_id = make_conversation_id(&env, &alice, &bob);

        client.send_message(&sender, &conv_id, &make_content_hash(&env, &[1u8; 32]), &0u32); // text
        client.send_message(&sender, &conv_id, &make_content_hash(&env, &[2u8; 32]), &1u32); // image
        client.send_message(&sender, &conv_id, &make_content_hash(&env, &[3u8; 32]), &2u32); // file
        client.send_message(&sender, &conv_id, &make_content_hash(&env, &[4u8; 32]), &u32::MAX); // max

        let messages = client.get_messages(&conv_id, &0u32, &10u32);
        assert_eq!(messages.len(), 4);
        assert_eq!(messages.get(0).unwrap().content_type, 0u32);
        assert_eq!(messages.get(1).unwrap().content_type, 1u32);
        assert_eq!(messages.get(2).unwrap().content_type, 2u32);
        assert_eq!(messages.get(3).unwrap().content_type, u32::MAX);
    }

    #[test]
    fn test_large_page_size() {
        let (env, client) = setup_env();
        let sender = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let conv_id = make_conversation_id(&env, &alice, &bob);

        for i in 0u8..3u8 {
            let ch = make_content_hash(&env, &[i; 32]);
            client.send_message(&sender, &conv_id, &ch, &0u32);
        }

        // Page size larger than total
        let messages = client.get_messages(&conv_id, &0u32, &100u32);
        assert_eq!(messages.len(), 3, "should return all messages when page size > total");
    }

    #[test]
    fn test_send_message_panics_without_auth() {
        let env = Env::default();
        let contract_id = env.register_contract(None, MessageContract);
        let client = MessageContractClient::new(&env, &contract_id);

        let _sender = Address::generate(&env);
        let other = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let conv_id = make_conversation_id(&env, &alice, &bob);
        let ch = make_content_hash(&env, &[1u8; 32]);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            // Pass `other` as sender — auth should fail
            client.send_message(&other, &conv_id, &ch, &0u32);
        }));
        assert!(result.is_err(), "send_message should panic when wrong sender used");
    }
}
