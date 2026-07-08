// Binary frame protocol — shared between WS and TCP transports
// Header: MAGIC(2) + type(2) + flags(2) + stream_id(4) + length(4) = 14 bytes

use std::io::{Cursor, Read, Write};

pub const HEADER_SIZE: usize = 14;
pub const MAGIC: u16 = 0xEB01;

pub mod flags {
    pub const NONE: u16 = 0;
    pub const REQUEST: u16 = 0x0001;
    pub const RESPONSE: u16 = 0x0002;
    pub const ERROR: u16 = 0x0004;
    pub const MORE: u16 = 0x0008;
}

pub mod msg_type {
    // Auth (0x0100–0x01FF)
    pub const AUTH_SEND_CODE: u16 = 257;
    pub const AUTH_SEND_CODE_RESP: u16 = 258;
    pub const AUTH_VERIFY_CODE: u16 = 259;
    pub const AUTH_VERIFY_CODE_RESP: u16 = 260;
    pub const AUTH_RESTORE: u16 = 261;
    pub const AUTH_RESTORE_RESP: u16 = 262;

    // Chat (0x0200–0x02FF)
    pub const CHAT_SEND: u16 = 513;
    pub const CHAT_SEND_RESP: u16 = 514;
    pub const CHAT_NEW_MESSAGE: u16 = 515;
    pub const CHAT_GET_CHATS: u16 = 516;
    pub const CHAT_GET_CHATS_RESP: u16 = 517;
    pub const CHAT_GET_MESSAGES: u16 = 518;
    pub const CHAT_GET_MESSAGES_RESP: u16 = 519;
    pub const CHAT_MARK_READ: u16 = 520;
    pub const CHAT_TYPING: u16 = 521;
    pub const CHAT_STOP_TYPING: u16 = 522;
    pub const CHAT_MESSAGE_DELIVERED: u16 = 523;
    pub const CHAT_MESSAGE_STATUS: u16 = 524;

    // Presence (0x0300–0x03FF)
    pub const PRESENCE_STATUS: u16 = 769;

    // Upload (0x0400–0x04FF)
    pub const UPLOAD_START: u16 = 1025;
    pub const UPLOAD_START_RESP: u16 = 1026;
    pub const UPLOAD_CHUNK: u16 = 1027;
    pub const UPLOAD_CHUNK_RESP: u16 = 1028;
    pub const UPLOAD_CANCEL: u16 = 1029;

    // Call (0x0500–0x05FF)
    pub const CALL_START: u16 = 1281;
    pub const CALL_START_RESP: u16 = 1282;
    pub const CALL_ACCEPT: u16 = 1283;
    pub const CALL_REJECT: u16 = 1284;
    pub const CALL_END: u16 = 1285;
    pub const CALL_GET_HISTORY: u16 = 1286;
    pub const CALL_GET_HISTORY_RESP: u16 = 1287;
    pub const CALL_LOG: u16 = 1288;

    // Post (0x0600–0x06FF)
    pub const POST_CREATE: u16 = 1537;
    pub const POST_CREATE_RESP: u16 = 1538;
    pub const POST_GET: u16 = 1539;
    pub const POST_GET_RESP: u16 = 1540;
    pub const POST_LIKE: u16 = 1541;
    pub const POST_COMMENT: u16 = 1542;

    // Live (0x0700–0x07FF)
    pub const LIVE_START: u16 = 1793;
    pub const LIVE_END: u16 = 1794;
    pub const LIVE_GET_ACTIVE: u16 = 1795;

    // Notification (0x0B00–0x0BFF)
    pub const NOTIF_NEW: u16 = 2817;
    pub const NOTIF_GET_LIST: u16 = 2818;
    pub const NOTIF_MARK_READ: u16 = 2819;

    // Profile (0x0C00–0x0CFF)
    pub const PROFILE_UPDATE: u16 = 3073;
    pub const PROFILE_GET: u16 = 3075;

    // Contact (0x0D00–0x0DFF)
    pub const CONTACT_GET: u16 = 3329;
    pub const CONTACT_ADD: u16 = 3330;
    pub const CONTACT_STATUS: u16 = 3333;
    pub const CONTACT_SEARCH: u16 = 3334;

    // Vibe Balance
    pub const VIBE_BALANCE_GET: u16 = 6657;
    pub const RECORD_INTERACTION: u16 = 6659;

    // Ping/Pong
    pub const PING: u16 = 65533;
    pub const PONG: u16 = 65534;
}

#[derive(Debug, Clone)]
pub struct Frame {
    pub magic: u16,
    pub msg_type: u16,
    pub flags: u16,
    pub stream_id: u32,
    pub length: u32,
    pub payload: Vec<u8>,
}

pub fn encode_frame(msg_type: u16, flags: u16, stream_id: u32, payload: &[u8]) -> Vec<u8> {
    let len = payload.len() as u32;
    let mut buf = Vec::with_capacity(HEADER_SIZE + payload.len());
    buf.extend_from_slice(&MAGIC.to_be_bytes());
    buf.extend_from_slice(&msg_type.to_be_bytes());
    buf.extend_from_slice(&flags.to_be_bytes());
    buf.extend_from_slice(&stream_id.to_be_bytes());
    buf.extend_from_slice(&len.to_be_bytes());
    buf.extend_from_slice(payload);
    buf
}

pub fn encode_response(frame: &Frame, payload: &[u8]) -> Vec<u8> {
    encode_frame(frame.msg_type, flags::RESPONSE, frame.stream_id, payload)
}

pub fn encode_error(frame: &Frame, error_msg: &str) -> Vec<u8> {
    encode_frame(frame.msg_type, flags::RESPONSE | flags::ERROR, frame.stream_id, error_msg.as_bytes())
}

pub fn decode_frame(buf: &[u8]) -> Option<Frame> {
    if buf.len() < HEADER_SIZE {
        return None;
    }
    let mut cursor = Cursor::new(buf);
    let mut magic_b = [0u8; 2];
    cursor.read_exact(&mut magic_b).ok()?;
    let magic = u16::from_be_bytes(magic_b);
    if magic != MAGIC {
        return None;
    }
    let mut type_b = [0u8; 2];
    cursor.read_exact(&mut type_b).ok()?;
    let msg_type = u16::from_be_bytes(type_b);
    let mut flags_b = [0u8; 2];
    cursor.read_exact(&mut flags_b).ok()?;
    let flags = u16::from_be_bytes(flags_b);
    let mut sid_b = [0u8; 4];
    cursor.read_exact(&mut sid_b).ok()?;
    let stream_id = u32::from_be_bytes(sid_b);
    let mut len_b = [0u8; 4];
    cursor.read_exact(&mut len_b).ok()?;
    let length = u32::from_be_bytes(len_b);
    let payload_len = length as usize;
    if buf.len() < HEADER_SIZE + payload_len {
        return None;
    }
    let payload = buf[HEADER_SIZE..HEADER_SIZE + payload_len].to_vec();
    Some(Frame { magic, msg_type, flags, stream_id, length, payload })
}

pub fn json_payload(frame: &Frame) -> serde_json::Value {
    if frame.payload.is_empty() {
        return serde_json::Value::Null;
    }
    serde_json::from_slice(&frame.payload).unwrap_or(serde_json::Value::Null)
}

pub fn create_pong_frame() -> Vec<u8> {
    encode_frame(msg_type::PONG, flags::NONE, 0, &[])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_decode_roundtrip() {
        let payload = b"hello world";
        let frame = encode_frame(257, flags::REQUEST, 42, payload);
        let decoded = decode_frame(&frame).unwrap();
        assert_eq!(decoded.magic, MAGIC);
        assert_eq!(decoded.msg_type, 257);
        assert_eq!(decoded.flags, flags::REQUEST);
        assert_eq!(decoded.stream_id, 42);
        assert_eq!(decoded.length, 11);
        assert_eq!(decoded.payload, payload);
    }

    #[test]
    fn test_decode_empty_payload() {
        let frame = encode_frame(513, flags::NONE, 0, &[]);
        let decoded = decode_frame(&frame).unwrap();
        assert_eq!(decoded.msg_type, 513);
        assert_eq!(decoded.flags, 0);
        assert_eq!(decoded.stream_id, 0);
        assert_eq!(decoded.length, 0);
        assert!(decoded.payload.is_empty());
    }

    #[test]
    fn test_decode_buffer_too_short() {
        let result = decode_frame(&[0xEB, 0x01, 0x00]);
        assert!(result.is_none());
    }

    #[test]
    fn test_decode_wrong_magic() {
        let buf = [0x00u8; 14];
        let result = decode_frame(&buf);
        assert!(result.is_none());
    }

    #[test]
    fn test_decode_truncated_payload() {
        let mut frame = encode_frame(257, flags::REQUEST, 1, b"data");
        frame.truncate(16); // cut payload
        let result = decode_frame(&frame);
        assert!(result.is_none());
    }

    #[test]
    fn test_encode_response() {
        let incoming = encode_frame(257, flags::REQUEST, 7, b"ping");
        let incoming_frame = decode_frame(&incoming).unwrap();
        let resp = encode_response(&incoming_frame, b"pong");
        let decoded = decode_frame(&resp).unwrap();
        assert_eq!(decoded.msg_type, 257);
        assert_eq!(decoded.flags, flags::RESPONSE);
        assert_eq!(decoded.stream_id, 7);
        assert_eq!(decoded.payload, b"pong");
    }

    #[test]
    fn test_encode_error() {
        let incoming = encode_frame(257, flags::REQUEST, 5, b"data");
        let incoming_frame = decode_frame(&incoming).unwrap();
        let err = encode_error(&incoming_frame, "something broke");
        let decoded = decode_frame(&err).unwrap();
        assert_eq!(decoded.msg_type, 257);
        assert_eq!(decoded.flags, flags::RESPONSE | flags::ERROR);
        assert_eq!(decoded.stream_id, 5);
        assert_eq!(String::from_utf8_lossy(&decoded.payload), "something broke");
    }

    #[test]
    fn test_large_payload() {
        let payload = vec![0xABu8; 65535];
        let frame = encode_frame(513, flags::NONE, 0, &payload);
        let decoded = decode_frame(&frame).unwrap();
        assert_eq!(decoded.length, 65535);
        assert_eq!(decoded.payload.len(), 65535);
        assert_eq!(decoded.payload[..100], payload[..100]);
        assert_eq!(decoded.payload[65000..], payload[65000..]);
    }

    #[test]
    fn test_max_stream_id() {
        let payload = b"test";
        let frame = encode_frame(257, flags::REQUEST, u32::MAX, payload);
        let decoded = decode_frame(&frame).unwrap();
        assert_eq!(decoded.stream_id, u32::MAX);
    }

    #[test]
    fn test_multiple_frames_stream() {
        let payloads = vec![b"msg1", b"msg2", b"msg3"];
        let frames: Vec<Vec<u8>> = payloads.iter().map(|p| encode_frame(257, flags::REQUEST, 1, p)).collect();
        let mut combined = Vec::new();
        for f in &frames {
            combined.extend_from_slice(f);
        }
        let mut offset = 0;
        for expected in &payloads {
            let decoded = decode_frame(&combined[offset..]).unwrap();
            assert_eq!(decoded.payload, expected);
            offset += HEADER_SIZE + expected.len();
        }
    }

    #[test]
    fn test_json_payload() {
        let data = serde_json::json!({"ok": true, "value": 42});
        let bytes = serde_json::to_vec(&data).unwrap();
        let frame_buf = encode_frame(257, flags::RESPONSE, 0, &bytes);
        let frame = decode_frame(&frame_buf).unwrap();
        let parsed = json_payload(&frame);
        assert_eq!(parsed["ok"], true);
        assert_eq!(parsed["value"], 42);
    }

    #[test]
    fn test_json_payload_empty() {
        let frame_buf = encode_frame(257, flags::RESPONSE, 0, &[]);
        let frame = decode_frame(&frame_buf).unwrap();
        let parsed = json_payload(&frame);
        assert_eq!(parsed, serde_json::Value::Null);
    }

    #[test]
    fn test_create_pong_frame() {
        let pong = create_pong_frame();
        let decoded = decode_frame(&pong).unwrap();
        assert_eq!(decoded.msg_type, msg_type::PONG);
        assert_eq!(decoded.flags, flags::NONE);
        assert_eq!(decoded.stream_id, 0);
        assert!(decoded.payload.is_empty());
    }
}
