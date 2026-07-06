use std::sync::atomic::{AtomicI64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

// 53-bit Snowflake ID (safe for JS Number)
// 31 bits timestamp (seconds since 2024-01-01) | 10 bits node | 12 bits sequence
const CUSTOM_EPOCH: i64 = 1704067200; // 2024-01-01T00:00:00Z
const NODE_SHIFT: i64 = 12;
const SEQ_MASK: i64 = 0xFFF;

static LAST_TIME: AtomicI64 = AtomicI64::new(-1);
static SEQUENCE: AtomicI64 = AtomicI64::new(0);

fn node_id() -> i64 {
    std::env::var("SNOWFLAKE_NODE_ID")
        .ok()
        .and_then(|v| v.parse().ok())
        .map(|n: i64| n.min(1023).max(0))
        .unwrap_or(0)
}

pub fn generate() -> i64 {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Clock went backwards")
        .as_secs() as i64;
    let timestamp = now - CUSTOM_EPOCH;

    if timestamp < 0 {
        panic!("Clock moved backwards");
    }

    let last = LAST_TIME.load(Ordering::SeqCst);
    if timestamp == last {
        let seq = SEQUENCE.fetch_add(1, Ordering::SeqCst);
        let seq = (seq + 1) & SEQ_MASK;
        if seq == 0 {
            // Wait for next second
            let mut current = now;
            while current == last {
                current = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs() as i64;
            }
            LAST_TIME.store(current - CUSTOM_EPOCH, Ordering::SeqCst);
            SEQUENCE.store(0, Ordering::SeqCst);
        } else {
            SEQUENCE.store(seq, Ordering::SeqCst);
        }
    } else {
        LAST_TIME.store(timestamp, Ordering::SeqCst);
        SEQUENCE.store(0, Ordering::SeqCst);
    }

    (timestamp << 22) | (node_id() << NODE_SHIFT) | SEQUENCE.load(Ordering::SeqCst)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_snowflake() {
        let id = generate();
        assert!(id > 0);
        assert!(id < (1i64 << 53)); // fits in JS safe integer
    }

    #[test]
    fn test_uniqueness() {
        let ids: std::collections::HashSet<i64> = (0..1000).map(|_| generate()).collect();
        assert_eq!(ids.len(), 1000);
    }
}
