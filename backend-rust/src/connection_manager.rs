// Connection Manager — shared session tracking for WS and TCP transports
// Delivers frames to connected clients

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

pub type SessionId = u64;
pub type SendFn = Arc<dyn Fn(Vec<u8>) + Send + Sync>;

struct Session {
    send: SendFn,
    transport: &'static str,
}

pub struct ConnectionManager {
    sessions: RwLock<HashMap<i64, HashMap<SessionId, Session>>>,
    pub db: deadpool_postgres::Pool,
    counter: RwLock<SessionId>,
}

impl ConnectionManager {
    pub fn new(db: deadpool_postgres::Pool) -> Arc<Self> {
        Arc::new(Self {
            sessions: RwLock::new(HashMap::new()),
            db,
            counter: RwLock::new(0),
        })
    }

    pub async fn add_connection(
        &self,
        user_id: i64,
        send_fn: SendFn,
        transport: &'static str,
    ) -> SessionId {
        let mut counter = self.counter.write().await;
        *counter += 1;
        let session_id = *counter;
        let mut sessions = self.sessions.write().await;
        sessions
            .entry(user_id)
            .or_default()
            .insert(session_id, Session { send: send_fn, transport });
        session_id
    }

    pub async fn remove_connection(&self, user_id: i64, session_id: SessionId) {
        let mut sessions = self.sessions.write().await;
        if let Some(user_sessions) = sessions.get_mut(&user_id) {
            user_sessions.remove(&session_id);
            if user_sessions.is_empty() {
                sessions.remove(&user_id);
            }
        }
    }

    pub async fn send_to_user(&self, user_id: i64, frame: &[u8]) {
        let sessions = self.sessions.read().await;
        if let Some(user_sessions) = sessions.get(&user_id) {
            let buf = frame.to_vec();
            for session in user_sessions.values() {
                (session.send)(buf.clone());
            }
        }
    }

    pub async fn send_to_chat(&self, chat_id: i64, frame: &[u8], exclude_user_id: Option<i64>) {
        if let Ok(members) = crate::db::get_chat_members_flat(&self.db, chat_id).await {
            for m in members {
                if Some(m) != exclude_user_id {
                    self.send_to_user(m, frame).await;
                }
            }
        }
    }

    pub async fn user_count(&self) -> usize {
        self.sessions.read().await.len()
    }

    pub async fn is_user_connected(&self, user_id: i64) -> bool {
        self.sessions.read().await.contains_key(&user_id)
    }

    pub async fn get_connected_users(&self) -> Vec<i64> {
        self.sessions.read().await.keys().copied().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_cm() -> Arc<ConnectionManager> {
        ConnectionManager::new(
            deadpool_postgres::Config::new()
                .create_pool(Some(deadpool_postgres::Runtime::Tokio1), tokio_postgres::NoTls)
                .unwrap(),
        )
    }

    #[tokio::test]
    async fn test_add_and_remove_connection() {
        let cm = make_cm();
        let sent = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let sent_clone = sent.clone();
        let send_fn: SendFn = Arc::new(move |data| {
            sent_clone.lock().unwrap().push(data);
        });

        let sid = cm.add_connection(42, send_fn, "test").await;
        assert!(cm.is_user_connected(42).await);
        assert_eq!(cm.user_count().await, 1);

        cm.remove_connection(42, sid).await;
        assert!(!cm.is_user_connected(42).await);
        assert_eq!(cm.user_count().await, 0);
    }

    #[tokio::test]
    async fn test_send_to_user() {
        let cm = make_cm();
        let sent = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let sent_clone = sent.clone();
        let send_fn: SendFn = Arc::new(move |data| {
            sent_clone.lock().unwrap().push(data);
        });

        cm.add_connection(42, send_fn, "test").await;
        let frame = protocol::encode_frame(257, 1, 0, b"hello");
        cm.send_to_user(42, &frame).await;

        let locked = sent.lock().unwrap();
        assert_eq!(locked.len(), 1);
        assert_eq!(locked[0], frame);
    }

    #[tokio::test]
    async fn test_send_to_user_not_connected() {
        let cm = make_cm();
        let frame = protocol::encode_frame(257, 1, 0, b"hello");
        cm.send_to_user(999, &frame).await; // should not panic
    }

    #[tokio::test]
    async fn test_multiple_sessions_same_user() {
        let cm = make_cm();
        let sent1 = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let sent2 = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let sc1 = sent1.clone();
        let sc2 = sent2.clone();

        let sid1 = cm.add_connection(42, Arc::new(move |data| { sc1.lock().unwrap().push(data); }), "ws").await;
        let sid2 = cm.add_connection(42, Arc::new(move |data| { sc2.lock().unwrap().push(data); }), "tcp").await;

        assert_eq!(cm.user_count().await, 1);

        let frame = protocol::encode_frame(1, 0, 0, &[]);
        cm.send_to_user(42, &frame).await;

        assert_eq!(sent1.lock().unwrap().len(), 1);
        assert_eq!(sent2.lock().unwrap().len(), 1);

        cm.remove_connection(42, sid1).await;
        assert!(cm.is_user_connected(42).await); // still has sid2

        cm.remove_connection(42, sid2).await;
        assert!(!cm.is_user_connected(42).await);
    }

    #[tokio::test]
    async fn test_get_connected_users() {
        let cm = make_cm();
        let send_fn: SendFn = Arc::new(|_| {});

        cm.add_connection(1, send_fn.clone(), "ws").await;
        cm.add_connection(2, send_fn.clone(), "ws").await;
        cm.add_connection(3, send_fn.clone(), "tcp").await;

        let mut users = cm.get_connected_users().await;
        users.sort();
        assert_eq!(users, vec![1, 2, 3]);
    }
}
