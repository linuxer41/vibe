use flatbuffers::{FlatBufferBuilder, root};
use serde_json::Value;

use crate::generated::vibe;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WireFormat {
    Json,
    FlatBuffers,
}

impl WireFormat {
    pub fn from_str(s: &str) -> Self {
        match s {
            "flatbuffers" | "fb" | "flatbuffer" => Self::FlatBuffers,
            _ => Self::Json,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Json => "json",
            Self::FlatBuffers => "flatbuffers",
        }
    }
}

/// Encode a socket event into bytes for the wire.
pub fn encode_event(event: &str, data: &Value, format: &WireFormat) -> Vec<u8> {
    match format {
        WireFormat::Json => {
            let payload = serde_json::json!({"event": event, "data": data});
            serde_json::to_vec(&payload).unwrap_or_default()
        }
        WireFormat::FlatBuffers => {
            let mut fbb = FlatBufferBuilder::new();
            let event_off = fbb.create_string(event);
            let data_str = serde_json::to_string(data).unwrap_or_default();
            let data_vec = fbb.create_vector(data_str.as_bytes());
            let payload = vibe::SocketPayload::create(
                &mut fbb,
                &vibe::SocketPayloadArgs {
                    event: Some(event_off),
                    data: Some(data_vec),
                },
            );
            fbb.finish(payload, None);
            fbb.finished_data().to_vec()
        }
    }
}

/// Decode socket event bytes back into event name and data.
pub fn decode_event(buf: &[u8]) -> (String, Value) {
    if let Ok(envelope) = root::<vibe::SocketPayload>(buf) {
        let event = envelope.event().unwrap_or("").to_string();
        let data = envelope.data().map(|v| v.bytes()).unwrap_or_default();
        let data: Value = serde_json::from_slice(data).unwrap_or(Value::Null);
        return (event, data);
    }
    if let Ok(parsed) = serde_json::from_slice::<Value>(buf) {
        let event = parsed.get("event").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let data = parsed.get("data").cloned().unwrap_or(Value::Null);
        return (event, data);
    }
    (String::new(), Value::Null)
}

/// Encode a Valkey pub/sub message.
pub fn encode_valkey(
    channel: &str,
    target: Option<&str>,
    event: &str,
    data: &Value,
    format: &WireFormat,
) -> Vec<u8> {
    match format {
        WireFormat::Json => {
            let payload = serde_json::json!({
                "channel": channel,
                "format": "json",
                "target": target,
                "event": event,
                "data": data,
            });
            serde_json::to_vec(&payload).unwrap_or_default()
        }
        WireFormat::FlatBuffers => {
            let mut fbb = FlatBufferBuilder::new();
            let ch = fbb.create_string(channel);
            let fmt = fbb.create_string(format.as_str());
            let tgt = target.map(|t| fbb.create_string(t));
            let ev = fbb.create_string(event);
            let data_str = serde_json::to_string(data).unwrap_or_default();
            let d = fbb.create_vector(data_str.as_bytes());
            let envelope = vibe::ValkeyEnvelope::create(
                &mut fbb,
                &vibe::ValkeyEnvelopeArgs {
                    channel: Some(ch),
                    format: Some(fmt),
                    target: tgt,
                    event: Some(ev),
                    data: Some(d),
                },
            );
            fbb.finish(envelope, None);
            fbb.finished_data().to_vec()
        }
    }
}

/// Decode a Valkey message into (channel, target, event, data).
pub fn decode_valkey(buf: &[u8]) -> (String, Option<String>, String, Value) {
    if let Ok(envelope) = root::<vibe::ValkeyEnvelope>(buf) {
        let channel = envelope.channel().unwrap_or("").to_string();
        let event = envelope.event().unwrap_or("").to_string();
        let target = envelope.target().map(|s| s.to_string());
        let data_raw = envelope.data().map(|v| v.bytes()).unwrap_or_default();
        let data: Value = serde_json::from_slice(data_raw).unwrap_or(Value::Null);
        return (channel, target, event, data);
    }
    if let Ok(parsed) = serde_json::from_slice::<Value>(buf) {
        let channel = parsed.get("channel").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let target = parsed.get("target").and_then(|v| v.as_str()).map(|s| s.to_string());
        let event = parsed.get("event").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let data = parsed.get("data").cloned().unwrap_or(Value::Null);
        return (channel, target, event, data);
    }
    (String::new(), None, String::new(), Value::Null)
}
