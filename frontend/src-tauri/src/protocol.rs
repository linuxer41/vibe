// Binary frame protocol (same as backend-rust)
// Used by Tauri TCP client to communicate with backend

pub const HEADER_SIZE: usize = 14;
pub const MAGIC: u16 = 0xEB01;

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

pub fn decode_frame(buf: &[u8]) -> Option<(u16, u16, u32, Vec<u8>)> {
    if buf.len() < HEADER_SIZE {
        return None;
    }
    let magic = u16::from_be_bytes([buf[0], buf[1]]);
    if magic != MAGIC {
        return None;
    }
    let msg_type = u16::from_be_bytes([buf[2], buf[3]]);
    let flags = u16::from_be_bytes([buf[4], buf[5]]);
    let stream_id = u32::from_be_bytes([buf[6], buf[7], buf[8], buf[9]]);
    let length = u32::from_be_bytes([buf[10], buf[11], buf[12], buf[13]]) as usize;
    if buf.len() < HEADER_SIZE + length {
        return None;
    }
    let payload = buf[HEADER_SIZE..HEADER_SIZE + length].to_vec();
    Some((msg_type, flags, stream_id, payload))
}

pub mod msg_type {
    pub const AUTH_RESTORE: u16 = 261;
    pub const AUTH_RESTORE_RESP: u16 = 262;
    pub const AUTH_SEND_CODE: u16 = 257;
    pub const AUTH_SEND_CODE_RESP: u16 = 258;
    pub const AUTH_VERIFY_CODE: u16 = 259;
    pub const AUTH_VERIFY_CODE_RESP: u16 = 260;
    pub const PING: u16 = 65533;
    pub const PONG: u16 = 65534;
    pub const CHAT_NEW_MESSAGE: u16 = 515;
    pub const CHAT_MESSAGE_STATUS: u16 = 524;
    pub const PRESENCE_STATUS: u16 = 769;
    pub const NOTIF_NEW: u16 = 2817;
}

pub mod flags {
    pub const NONE: u16 = 0;
    pub const REQUEST: u16 = 0x0001;
    pub const RESPONSE: u16 = 0x0002;
    pub const ERROR: u16 = 0x0004;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_decode_roundtrip() {
        let payload = b"hello world";
        let buf = encode_frame(257, flags::REQUEST, 42, payload);
        let (msg_type, flags, stream_id, decoded) = decode_frame(&buf).unwrap();
        assert_eq!(msg_type, 257);
        assert_eq!(flags, flags::REQUEST);
        assert_eq!(stream_id, 42);
        assert_eq!(decoded, payload);
    }

    #[test]
    fn test_decode_empty_payload() {
        let buf = encode_frame(513, flags::NONE, 0, &[]);
        let (msg_type, flags, stream_id, decoded) = decode_frame(&buf).unwrap();
        assert_eq!(msg_type, 513);
        assert_eq!(flags, 0);
        assert_eq!(stream_id, 0);
        assert!(decoded.is_empty());
    }

    #[test]
    fn test_decode_buffer_too_short() {
        assert!(decode_frame(&[0xEB, 0x01, 0x00]).is_none());
    }

    #[test]
    fn test_decode_wrong_magic() {
        assert!(decode_frame(&[0x00u8; 14]).is_none());
    }

    #[test]
    fn test_decode_truncated_payload() {
        let mut buf = encode_frame(257, flags::REQUEST, 1, b"data");
        buf.truncate(16);
        assert!(decode_frame(&buf).is_none());
    }

    #[test]
    fn test_large_payload() {
        let payload = vec![0xABu8; 65535];
        let buf = encode_frame(513, flags::NONE, 0, &payload);
        let (_, _, _, decoded) = decode_frame(&buf).unwrap();
        assert_eq!(decoded.len(), 65535);
        assert_eq!(decoded[..100], payload[..100]);
    }

    #[test]
    fn test_max_stream_id() {
        let buf = encode_frame(257, flags::REQUEST, u32::MAX, b"test");
        let (_, _, stream_id, _) = decode_frame(&buf).unwrap();
        assert_eq!(stream_id, u32::MAX);
    }

    #[test]
    fn test_multiple_frames() {
        let f1 = encode_frame(257, flags::REQUEST, 1, b"msg1");
        let f2 = encode_frame(258, flags::RESPONSE, 0, b"msg2");
        let mut combined = Vec::new();
        combined.extend_from_slice(&f1);
        combined.extend_from_slice(&f2);

        let (t1, f, s1, p1) = decode_frame(&combined).unwrap();
        assert_eq!(t1, 257);
        assert_eq!(f, flags::REQUEST);
        assert_eq!(s1, 1);
        assert_eq!(p1, b"msg1");

        let remaining = combined[HEADER_SIZE + 4..].to_vec();
        let (t2, _, s2, p2) = decode_frame(&remaining).unwrap();
        assert_eq!(t2, 258);
        assert_eq!(s2, 0);
        assert_eq!(p2, b"msg2");
    }

    #[test]
    fn test_msg_type_constants() {
        assert_eq!(msg_type::AUTH_RESTORE, 261);
        assert_eq!(msg_type::CHAT_NEW_MESSAGE, 515);
        assert_eq!(msg_type::PING, 65533);
        assert_eq!(msg_type::PONG, 65534);
    }
}
