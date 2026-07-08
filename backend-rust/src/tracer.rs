// Centralized event tracer — single place for all debug logs
// Format: [category] direction event_type key_fields

use tracing::{info, warn};

pub enum Direction {
    Inbound,
    Outbound,
}

impl Direction {
    fn arrow(&self) -> &'static str {
        match self {
            Direction::Inbound => "\u{2190}",
            Direction::Outbound => "\u{2192}",
        }
    }
}

pub fn kafka_produce(topic: &str, key: &str, payload: &[u8]) {
    let summary = summarize_msgpack(payload);
    info!(
        target: "kafka",
        topic = topic,
        key = key,
        summary = summary,
        "KAFKA {} {} key={} {}",
        Direction::Outbound.arrow(),
        topic,
        key,
        summary,
    );
}

pub fn kafka_consume(topic: &str, key: &[u8], payload: &[u8]) {
    let key_str = String::from_utf8_lossy(key);
    let summary = summarize_msgpack(payload);
    info!(
        target: "kafka",
        topic = topic,
        key = key_str.as_ref(),
        summary = summary,
        "KAFKA {} {} key={} {}",
        Direction::Inbound.arrow(),
        topic,
        key_str,
        summary,
    );
}

pub fn conn_connect(transport: &str, user_id: i64, peer: &str) {
    info!(
        target: "conn",
        transport = transport,
        user_id = user_id,
        peer = peer,
        "{} {} user={} from {}",
        transport.to_uppercase(),
        Direction::Inbound.arrow(),
        user_id,
        peer,
    );
}

pub fn conn_disconnect(transport: &str, user_id: i64, peer: &str) {
    info!(
        target: "conn",
        transport = transport,
        user_id = user_id,
        peer = peer,
        "{} {} user={} disconnected from {}",
        transport.to_uppercase(),
        Direction::Outbound.arrow(),
        user_id,
        peer,
    );
}

pub fn msg_received(transport: &str, user_id: i64, msg_type: u16, size: usize) {
    info!(
        target: "msg",
        transport = transport,
        user_id = user_id,
        msg_type = msg_type,
        size = size,
        "{} {} user={} type={} size={}",
        transport.to_uppercase(),
        Direction::Inbound.arrow(),
        user_id,
        msg_type,
        size,
    );
}

pub fn msg_sent(transport: &str, user_id: i64, msg_type: u16, size: usize) {
    info!(
        target: "msg",
        transport = transport,
        user_id = user_id,
        msg_type = msg_type,
        size = size,
        "{} {} user={} type={} size={}",
        transport.to_uppercase(),
        Direction::Outbound.arrow(),
        user_id,
        msg_type,
        size,
    );
}

pub fn auth_event(transport: &str, user_id: i64, peer: &str, success: bool) {
    if success {
        info!(
            target: "auth",
            transport = transport,
            user_id = user_id,
            peer = peer,
            "AUTH OK {} {} via {}",
            user_id,
            peer,
            transport,
        );
    } else {
        warn!(
            target: "auth",
            transport = transport,
            peer = peer,
            "AUTH FAIL from {} via {}",
            peer,
            transport,
        );
    }
}

fn summarize_msgpack(data: &[u8]) -> String {
    if data.is_empty() {
        return "(empty)".into();
    }
    match rmp_serde::from_slice::<serde_json::Value>(data) {
        Ok(val) => {
            let mut parts: Vec<String> = Vec::new();
            if let Some(obj) = val.as_object() {
                for key in ["chatId", "userId", "senderId", "messageId", "type", "online"] {
                    if let Some(v) = obj.get(key) {
                        parts.push(format!("{}:{}", key, v));
                    }
                }
                if parts.is_empty() {
                    let keys: Vec<&str> = obj.keys().map(|k| k.as_str()).take(4).collect();
                    parts = keys.iter().map(|k| format!("{}", k)).collect();
                }
            } else {
                return format!("{:?}", val);
            }
            if parts.is_empty() { "{...}".into() } else { format!("{{{}}}", parts.join(" ")) }
        }
        Err(_) => format!("raw[{}b]", data.len()),
    }
}
