use serde_json::Value;

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

pub fn encode_event(event: &str, data: &Value, _format: &WireFormat) -> Vec<u8> {
    let payload = serde_json::json!({"event": event, "data": data});
    serde_json::to_vec(&payload).unwrap_or_default()
}

pub fn decode_event(buf: &[u8]) -> (String, Value) {
    if let Ok(parsed) = serde_json::from_slice::<Value>(buf) {
        let event = parsed.get("event").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let data = parsed.get("data").cloned().unwrap_or(Value::Null);
        return (event, data);
    }
    (String::new(), Value::Null)
}

pub fn encode_valkey(channel: &str, target: Option<&str>, event: &str, data: &Value, _format: &WireFormat) -> Vec<u8> {
    let payload = serde_json::json!({
        "channel": channel,
        "format": "json",
        "target": target,
        "event": event,
        "data": data,
    });
    serde_json::to_vec(&payload).unwrap_or_default()
}

pub fn decode_valkey(buf: &[u8]) -> (String, Option<String>, String, Value) {
    if let Ok(parsed) = serde_json::from_slice::<Value>(buf) {
        let channel = parsed.get("channel").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let target = parsed.get("target").and_then(|v| v.as_str()).map(|s| s.to_string());
        let event = parsed.get("event").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let data = parsed.get("data").cloned().unwrap_or(Value::Null);
        return (channel, target, event, data);
    }
    (String::new(), None, String::new(), Value::Null)
}
