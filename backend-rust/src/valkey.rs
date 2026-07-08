// Valkey (Redis) — TCP socket gateway state only
// Pub/sub replaced by Kafka (see kafka.rs)

use tracing::info;

fn get_valkey_url() -> String {
    std::env::var("VALKEY_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string())
}

pub async fn connect() {
    let url = get_valkey_url();
    info!(url = %url, "Valkey gateway state initialized");
    // Connection management for gateway state will be added when scaling horizontally
}

pub async fn set_online(_user_id: i64) {
    // Gateway state — registers user as connected on this instance
    // Used for cross-instance routing (future)
}

pub async fn set_offline(_user_id: i64) {
}
