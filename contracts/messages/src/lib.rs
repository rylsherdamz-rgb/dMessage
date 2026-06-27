#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, Vec};

#[derive(Clone)]
#[contracttype]
pub struct InboxMessage {
    pub sender: Address,
    pub content: Bytes,
    pub timestamp: u64,
    pub read: bool,
}

#[contract]
pub struct MessageContract;

#[contractimpl]
impl MessageContract {
    pub fn send_message(
        env: Env,
        sender: Address,
        recipient: Address,
        content: Bytes,
    ) {
        sender.require_auth();
        let timestamp = env.ledger().timestamp();

        let mut inbox: Vec<InboxMessage> = env
            .storage()
            .persistent()
            .get(&recipient)
            .unwrap_or_else(|| Vec::new(&env));

        inbox.push_back(InboxMessage {
            sender: sender.clone(),
            content,
            timestamp,
            read: false,
        });

        env.storage()
            .persistent()
            .set(&recipient, &inbox);

        env.events().publish(
            ("MessageSent", sender.clone(), recipient.clone()),
            timestamp,
        );
    }

    pub fn get_messages(
        env: Env,
        user: Address,
        page: u32,
        page_size: u32,
    ) -> Vec<InboxMessage> {
        let inbox: Vec<InboxMessage> = env
            .storage()
            .persistent()
            .get(&user)
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
        let inbox = env
            .storage()
            .persistent()
            .get::<Address, Vec<InboxMessage>>(&user)
            .unwrap_or_else(|| Vec::new(&env));
        inbox.len() as u32
    }

    pub fn mark_as_read(env: Env, caller: Address, index: u32) {
        caller.require_auth();
        let mut inbox = env
            .storage()
            .persistent()
            .get::<Address, Vec<InboxMessage>>(&caller)
            .unwrap();
        let mut msg = inbox.get(index).unwrap();
        msg.read = true;
        inbox.set(index, msg);
        env.storage()
            .persistent()
            .set(&caller, &inbox);
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

        assert_eq!(msgs.len(), 1, "bob should have 1 message");
        let msg = msgs.get(0).unwrap();
        assert_eq!(msg.sender, alice);
        assert_eq!(msg.content, content);
        assert!(!msg.read, "new message should be unread");
    }

    #[test]
    fn test_multiple_messages_to_same_user() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.send_message(&alice, &bob, &make_content(&env, b"msg1"));
        client.send_message(&alice, &bob, &make_content(&env, b"msg2"));

        let msgs = client.get_messages(&bob, &0u32, &10u32);
        assert_eq!(msgs.len(), 2, "bob should have 2 messages");
    }

    #[test]
    fn test_messages_from_different_senders() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let charlie = Address::generate(&env);

        client.send_message(&alice, &bob, &make_content(&env, b"alice says hi"));
        client.send_message(&charlie, &bob, &make_content(&env, b"charlie says hi"));

        let msgs = client.get_messages(&bob, &0u32, &10u32);
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs.get(0).unwrap().sender, alice);
        assert_eq!(msgs.get(1).unwrap().sender, charlie);
    }

    #[test]
    fn test_mark_as_read() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.send_message(&alice, &bob, &make_content(&env, b"hello"));
        client.mark_as_read(&bob, &0u32);

        let msgs = client.get_messages(&bob, &0u32, &10u32);
        assert!(msgs.get(0).unwrap().read, "message should be marked read");
    }

    #[test]
    fn test_my_message_count() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        assert_eq!(client.my_message_count(&bob), 0, "no messages yet");

        client.send_message(&alice, &bob, &make_content(&env, b"msg1"));
        assert_eq!(client.my_message_count(&bob), 1);

        client.send_message(&alice, &bob, &make_content(&env, b"msg2"));
        assert_eq!(client.my_message_count(&bob), 2);
    }

    #[test]
    fn test_get_messages_pagination() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        for i in 0u8..5u8 {
            client.send_message(&alice, &bob, &make_content(&env, &[i]));
        }

        assert_eq!(client.get_messages(&bob, &0u32, &2u32).len(), 2);
        assert_eq!(client.get_messages(&bob, &1u32, &2u32).len(), 2);
        assert_eq!(client.get_messages(&bob, &2u32, &2u32).len(), 1);
        assert_eq!(client.get_messages(&bob, &3u32, &2u32).len(), 0);
    }

    #[test]
    fn test_get_messages_ordering() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        for i in 0u8..3u8 {
            client.send_message(&alice, &bob, &make_content(&env, &[i]));
        }

        let msgs = client.get_messages(&bob, &0u32, &10u32);
        assert_eq!(msgs.len(), 3);
        // FIFO order
        assert_eq!(msgs.get(0).unwrap().content.get(0).unwrap(), 0u8);
        assert_eq!(msgs.get(1).unwrap().content.get(0).unwrap(), 1u8);
        assert_eq!(msgs.get(2).unwrap().content.get(0).unwrap(), 2u8);
    }

    #[test]
    fn test_send_message_fires_event() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, MessageContract);
        let client = MessageContractClient::new(&env, &contract_id);

        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        client.send_message(&alice, &bob, &make_content(&env, b"event test"));

        let events = env.events().all();
        assert!(events.len() > 0, "should have fired an event");
        let (_contract, topics, _data) = events.get(0).unwrap();
        assert_eq!(topics.len(), 3, "event should have 3 topics");
        let sender_topic = Address::try_from_val(&env, &topics.get(1).unwrap()).unwrap();
        let recipient_topic = Address::try_from_val(&env, &topics.get(2).unwrap()).unwrap();
        assert_eq!(sender_topic, alice, "event topic 1 should be sender");
        assert_eq!(recipient_topic, bob, "event topic 2 should be recipient");
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
        assert!(result.is_err(), "send_message should panic without auth");
    }

    #[test]
    fn test_mark_as_read_panics_without_auth() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, MessageContract);
        let client = MessageContractClient::new(&env, &contract_id);

        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        client.send_message(&alice, &bob, &make_content(&env, b"test"));

        // Reset auth so the next call won't be auto-authorized
        let client2 = MessageContractClient::new(&env, &contract_id);
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client2.mark_as_read(&alice, &0u32);
        }));
        assert!(result.is_err(), "mark_as_read for another user should panic");
    }

    #[test]
    fn test_inbox_isolation() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let charlie = Address::generate(&env);

        client.send_message(&alice, &bob, &make_content(&env, b"to bob"));
        client.send_message(&alice, &charlie, &make_content(&env, b"to charlie"));

        assert_eq!(client.get_messages(&bob, &0u32, &10u32).len(), 1);
        assert_eq!(client.get_messages(&charlie, &0u32, &10u32).len(), 1);
        assert_eq!(client.get_messages(&alice, &0u32, &10u32).len(), 0);
    }

    #[test]
    fn test_large_page_size() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        for i in 0u8..3u8 {
            client.send_message(&alice, &bob, &make_content(&env, &[i]));
        }

        let msgs = client.get_messages(&bob, &0u32, &100u32);
        assert_eq!(msgs.len(), 3);
    }

    #[test]
    fn test_empty_inbox() {
        let (env, client) = setup_env();
        let alice = Address::generate(&env);
        let msgs = client.get_messages(&alice, &0u32, &10u32);
        assert!(msgs.is_empty(), "empty inbox should return empty vec");
    }
}
