// Kafka producer/consumer — replaces Valkey pub/sub for cross-instance delivery

use std::sync::Arc;
use std::time::Duration;
use rdkafka::config::ClientConfig;
use rdkafka::producer::{FutureProducer, FutureRecord};
use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::Message;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use crate::protocol;
use crate::connection_manager::ConnectionManager;

fn get_brokers() -> String {
    std::env::var("KAFKA_BROKER").unwrap_or_else(|_| "localhost:9092".to_string())
}

pub struct KafkaBus {
    producer: Option<Arc<FutureProducer>>,
}

impl KafkaBus {
    pub fn new() -> Self {
        Self { producer: None }
    }

    pub async fn connect_producer(&mut self) {
        let brokers = get_brokers();
        match ClientConfig::new()
            .set("bootstrap.servers", &brokers)
            .set("message.timeout.ms", "5000")
            .create::<FutureProducer>()
        {
            Ok(p) => {
                self.producer = Some(Arc::new(p));
                info!(brokers = %brokers, "Kafka producer connected");
            }
            Err(e) => {
                warn!(err = %e, brokers = %brokers, "Kafka producer failed — events disabled");
            }
        }
    }

    pub async fn produce(&self, topic: &str, key: &str, value: &str) {
        let producer = match &self.producer {
            Some(p) => p,
            None => return,
        };
        let record = FutureRecord::to(topic)
            .key(key)
            .payload(value);
        match producer.send(record, Duration::from_secs(5)).await {
            Ok(_) => {}
            Err((e, _)) => warn!(err = %e, topic = %topic, "Kafka produce failed"),
        }
    }

    pub async fn start_consumer(
        &self,
        group_id: &str,
        topics: &[&str],
        conn_mgr: Arc<ConnectionManager>,
    ) {
        let brokers = get_brokers();
        let consumer: StreamConsumer = match ClientConfig::new()
            .set("bootstrap.servers", &brokers)
            .set("group.id", group_id)
            .set("auto.offset.reset", "latest")
            .set("enable.auto.commit", "true")
            .set("session.timeout.ms", "30000")
            .set("heartbeat.interval.ms", "3000")
            .create()
        {
            Ok(c) => c,
            Err(e) => {
                warn!(err = %e, "Kafka consumer failed to create");
                return;
            }
        };

        let topics_ref: Vec<&str> = topics.iter().map(|s| *s).collect();
        if let Err(e) = consumer.subscribe(&topics_ref) {
            warn!(err = %e, "Kafka consumer subscribe failed");
            return;
        }

        info!(group = %group_id, topics = ?topics, "Kafka consumer started");

        tokio::spawn(async move {
            loop {
                match consumer.recv().await {
                    Ok(msg) => {
                        let topic = msg.topic().to_string();
                        let key = msg.key().map(|k| String::from_utf8_lossy(k).to_string()).unwrap_or_default();
                        let value = msg.payload().map(|p| String::from_utf8_lossy(p).to_string()).unwrap_or_default();
                        handle_kafka_message(&topic, &key, &value, &conn_mgr).await;
                    }
                    Err(e) => {
                        warn!(err = %e, "Kafka consumer error");
                        tokio::time::sleep(Duration::from_secs(3)).await;
                    }
                }
            }
        });
    }
}

async fn handle_kafka_message(topic: &str, _key: &str, value: &str, conn_mgr: &ConnectionManager) {
    match topic {
        "chat-messages" => {
            let parsed: serde_json::Value = match serde_json::from_str(value) {
                Ok(v) => v,
                Err(_) => return,
            };
            let chat_id = parsed.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            let msg = parsed.get("msg");
            let sender_id = parsed.get("senderId").and_then(|v| v.as_i64()).unwrap_or(0);
            if chat_id == 0 || msg.is_none() { return; }

            if let Ok(members) = crate::db::get_chat_members_flat(&conn_mgr.db, chat_id).await {
                for m in members {
                    let payload = serde_json::json!({ "message": msg, "chat_id": chat_id });
                    let frame = protocol::encode_frame(
                        protocol::msg_type::CHAT_NEW_MESSAGE,
                        protocol::flags::NONE, 0,
                        &serde_json::to_vec(&payload).unwrap_or_default(),
                    );
                    conn_mgr.send_to_user(m, &frame).await;

                    if m != sender_id {
                        if let Ok(n) = crate::db::add_smart_notification(
                            &conn_mgr.db, m, "new_message",
                            &format!("Nuevo mensaje de {}", msg.get("sender_name").and_then(|v| v.as_str()).unwrap_or("")),
                            "normal",
                        ).await {
                            let n_frame = protocol::encode_frame(
                                protocol::msg_type::NOTIF_NEW,
                                protocol::flags::NONE, 0,
                                &serde_json::to_vec(&n).unwrap_or_default(),
                            );
                            conn_mgr.send_to_user(m, &n_frame).await;
                        }
                    }
                }
            }
        }
        "chat-new" => {
            let parsed: serde_json::Value = match serde_json::from_str(value) {
                Ok(v) => v,
                Err(_) => return,
            };
            let chat_id = parsed.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            let user_id = parsed.get("userId").and_then(|v| v.as_i64()).unwrap_or(0);
            if user_id == 0 { return; }
            // Deliver new chat to user
            if let Ok(chat_data) = crate::db::get_user_chat(&conn_mgr.db, chat_id, user_id).await {
                let payload = serde_json::json!({ "chat_data": chat_data, "message": null });
                let frame = protocol::encode_frame(
                    protocol::msg_type::CHAT_NEW_MESSAGE,
                    protocol::flags::NONE, 0,
                    &serde_json::to_vec(&payload).unwrap_or_default(),
                );
                conn_mgr.send_to_user(user_id, &frame).await;
            }
        }
        "chat-events" => {
            let parsed: serde_json::Value = match serde_json::from_str(value) {
                Ok(v) => v,
                Err(_) => return,
            };
            if let Some(frame_b64) = parsed.get("frameBase64").and_then(|v| v.as_str()) {
                use base64::Engine;
                let bytes = base64::engine::general_purpose::STANDARD.decode(frame_b64).unwrap_or_default();
                let target_user = parsed.get("targetUserId").and_then(|v| v.as_i64());
                let chat_id = parsed.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);

                if let Some(uid) = target_user {
                    conn_mgr.send_to_user(uid, &bytes).await;
                } else if chat_id > 0 {
                    let sender = parsed.get("senderId").and_then(|v| v.as_i64()).unwrap_or(0);
                    if let Ok(members) = crate::db::get_chat_members_flat(&conn_mgr.db, chat_id).await {
                        for m in members {
                            if m != sender {
                                conn_mgr.send_to_user(m, &bytes).await;
                            }
                        }
                    }
                }
            }
        }
        "user-presence" => {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(value) {
                if let Some(user_id) = parsed.get("userId").and_then(|v| v.as_i64()) {
                    let payload = serde_json::to_vec(&parsed).unwrap_or_default();
                    let frame = protocol::encode_frame(
                        protocol::msg_type::PRESENCE_STATUS,
                        protocol::flags::NONE, 0, &payload,
                    );
                    conn_mgr.send_to_user(user_id, &frame).await;
                }
            }
        }
        _ => {}
    }
}
