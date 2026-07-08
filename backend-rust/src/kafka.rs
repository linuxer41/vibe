// Kafka producer/consumer — replaces Valkey pub/sub for cross-instance delivery

#[cfg(feature = "kafka")]
mod inner {
    use std::sync::Arc;
    use std::time::Duration;
    use rdkafka::admin::{AdminClient, AdminOptions, NewTopic, TopicReplication};
    use rdkafka::client::DefaultClientContext;
    use rdkafka::config::ClientConfig;
    use rdkafka::producer::{FutureProducer, FutureRecord};
    use rdkafka::consumer::{Consumer, StreamConsumer};
    use rdkafka::Message;
    use tracing::{info, warn};

    use crate::connection_manager::ConnectionManager;
    use crate::protocol;
    use crate::tracer;

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

        pub async fn produce(&self, topic: &str, key: &str, value: &[u8]) {
            let producer = match &self.producer {
                Some(p) => p,
                None => return,
            };
            tracer::kafka_produce(topic, key, value);
            let record = FutureRecord::to(topic).key(key).payload(value);
            match producer.send(record, Duration::from_secs(5)).await {
                Ok(_) => {}
                Err((e, _)) => warn!(err = %e, topic = %topic, "Kafka produce failed"),
            }
        }

        pub async fn ensure_topics(&self) {
            let brokers = get_brokers();
            let admin: AdminClient<DefaultClientContext> = match ClientConfig::new()
                .set("bootstrap.servers", &brokers).create()
            {
                Ok(a) => a,
                Err(e) => { warn!(err = %e, "Kafka admin client failed"); return; }
            };
            let required = vec!["chat-messages", "chat-new", "chat-events", "user-presence"];
            let existing = match admin.list_topics().await {
                Ok(md) => md.topics().keys().cloned().collect::<Vec<_>>(),
                Err(e) => { warn!(err = %e, "Kafka list topics failed"); return; }
            };
            let missing: Vec<&str> = required.into_iter().filter(|t| !existing.contains(&t.to_string())).collect();
            if !missing.is_empty() {
                let new_topics: Vec<NewTopic> = missing.iter().map(|t| NewTopic::new(t, 3, TopicReplication::Fixed(1))).collect();
                match admin.create_topics(&new_topics, &AdminOptions::new()).await {
                    Ok(r) => { for res in r.iter() { if let Err((_, e)) = res { warn!(err = %e, topic = ?res, "Kafka topic create error"); } } info!(topics = ?missing, "Kafka topics created"); }
                    Err(e) => warn!(err = %e, "Kafka create topics failed"),
                }
            } else { info!("Kafka topics already exist"); }
        }

        pub async fn start_consumer(&self, group_id: &str, topics: &[&str], conn_mgr: Arc<ConnectionManager>) {
            self.ensure_topics().await;
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
                Err(e) => { warn!(err = %e, "Kafka consumer failed to create"); return; }
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
                            let key = msg.key().map(|k| k.to_vec()).unwrap_or_default();
                            let value = msg.payload().map(|p| p.to_vec()).unwrap_or_default();
                            tracer::kafka_consume(&topic, &key, &value);
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

    async fn handle_kafka_message(topic: &str, _key: &[u8], value: &[u8], conn_mgr: &ConnectionManager) {
        let parsed: serde_json::Value = match rmp_serde::from_slice(value) { Ok(v) => v, Err(_) => return };
        match topic {
            "chat-messages" => {
                let chat_id = parsed.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
                let msg = parsed.get("msg");
                let sender_id = parsed.get("senderId").and_then(|v| v.as_i64()).unwrap_or(0);
                if chat_id == 0 || msg.is_none() { return; }
                if let Ok(members) = crate::db::get_chat_members_flat(&conn_mgr.db, chat_id).await {
                    for m in members {
                        let payload = serde_json::json!({ "message": msg, "chat_id": chat_id });
                        let frame = protocol::encode_frame(protocol::msg_type::CHAT_NEW_MESSAGE, protocol::flags::NONE, 0, &serde_json::to_vec(&payload).unwrap_or_default());
                        conn_mgr.send_to_user(m, &frame).await;
                        if m != sender_id {
                            if let Ok(n) = crate::db::add_smart_notification(&conn_mgr.db, m, "new_message",
                                &format!("Nuevo mensaje de {}", msg.get("sender_name").and_then(|v| v.as_str()).unwrap_or("")), "normal").await {
                                let n_frame = protocol::encode_frame(protocol::msg_type::NOTIF_NEW, protocol::flags::NONE, 0, &serde_json::to_vec(&n).unwrap_or_default());
                                conn_mgr.send_to_user(m, &n_frame).await;
                            }
                        }
                    }
                }
            }
            "chat-new" => {
                let chat_id = parsed.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
                let user_id = parsed.get("userId").and_then(|v| v.as_i64()).unwrap_or(0);
                if user_id == 0 { return; }
                if let Ok(chat_data) = crate::db::get_user_chat(&conn_mgr.db, chat_id, user_id).await {
                    let payload = serde_json::json!({ "chat_data": chat_data, "message": null });
                    let frame = protocol::encode_frame(protocol::msg_type::CHAT_NEW_MESSAGE, protocol::flags::NONE, 0, &serde_json::to_vec(&payload).unwrap_or_default());
                    conn_mgr.send_to_user(user_id, &frame).await;
                }
            }
            "chat-events" => {
                if let Some(frame_b64) = parsed.get("frameBase64").and_then(|v| v.as_str()) {
                    use base64::Engine;
                    let bytes = base64::engine::general_purpose::STANDARD.decode(frame_b64).unwrap_or_default();
                    let target_user = parsed.get("targetUserId").and_then(|v| v.as_i64());
                    let chat_id = parsed.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
                    if let Some(uid) = target_user { conn_mgr.send_to_user(uid, &bytes).await; }
                    else if chat_id > 0 {
                        let sender = parsed.get("senderId").and_then(|v| v.as_i64()).unwrap_or(0);
                        if let Ok(members) = crate::db::get_chat_members_flat(&conn_mgr.db, chat_id).await {
                            for m in members { if m != sender { conn_mgr.send_to_user(m, &bytes).await; } }
                        }
                    }
                }
            }
            "user-presence" => {
                if let Some(user_id) = parsed.get("userId").and_then(|v| v.as_i64()) {
                    let frame = protocol::encode_frame(protocol::msg_type::PRESENCE_STATUS, protocol::flags::NONE, 0, &serde_json::to_vec(&parsed).unwrap_or_default());
                    conn_mgr.send_to_user(user_id, &frame).await;
                }
            }
            _ => {}
        }
    }
}

#[cfg(not(feature = "kafka"))]
mod inner {
    use std::sync::Arc;
    use tracing::info;

    use crate::connection_manager::ConnectionManager;

    pub struct KafkaBus;

    impl KafkaBus {
        pub fn new() -> Self { Self }
        pub async fn connect_producer(&mut self) {
            info!("Kafka disabled (feature not enabled)");
        }
        pub async fn produce(&self, _topic: &str, _key: &str, _value: &[u8]) {}
        pub async fn ensure_topics(&self) {}
        pub async fn start_consumer(&self, _group_id: &str, _topics: &[&str], _conn_mgr: Arc<ConnectionManager>) {}
    }
}

pub use inner::*;
