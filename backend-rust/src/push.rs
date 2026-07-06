use std::collections::HashMap;

use serde_json::Value;
use tokio::sync::RwLock;
use tracing::{info, warn};
use web_push::*;

use crate::db;

pub struct PushManager {
    pub vapid_public_key: String,
    vapid_private_key: String,
    vapid_subject: String,
    subscriptions: RwLock<HashMap<i64, Vec<PushSub>>>,
    ready: bool,
}

#[derive(Debug, Clone)]
struct PushSub {
    endpoint: String,
    p256dh: String,
    auth: String,
}

impl PushManager {
    pub fn new() -> Self {
        let public_key = std::env::var("VAPID_PUBLIC_KEY").unwrap_or_default();
        let private_key = std::env::var("VAPID_PRIVATE_KEY").unwrap_or_default();
        let subject = std::env::var("VAPID_SUBJECT").unwrap_or_else(|_| "mailto:vibe@app.local".to_string());
        let ready = !public_key.is_empty() && !private_key.is_empty();
        if ready {
            info!(action = "vapid_init", "VAPID push notifications initialized");
        } else {
            info!(action = "vapid_init", "VAPID keys not set, push disabled");
        }
        PushManager {
            vapid_public_key: public_key,
            vapid_private_key: private_key,
            vapid_subject: subject,
            subscriptions: RwLock::new(HashMap::new()),
            ready,
        }
    }

    pub async fn load_from_db(&self, pool: &deadpool_postgres::Pool) {
        if !self.ready { return; }
        match db::get_all_push_subscriptions(pool).await {
            Ok(subs) => {
                let mut map = self.subscriptions.write().await;
                for (user_id, endpoint, keys_val) in subs {
                    let p256dh = keys_val.get("p256dh").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let auth = keys_val.get("auth").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    map.entry(user_id).or_default().push(PushSub { endpoint, p256dh, auth });
                }
                info!(count = map.len(), action = "push_load", "Push subscriptions loaded from DB");
            }
            Err(e) => warn!(err = %e, action = "push_load", "Failed to load push subscriptions"),
        }
    }

    pub async fn add_subscription(&self, user_id: i64, endpoint: &str, keys: &Value) {
        let p256dh = keys.get("p256dh").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let auth = keys.get("auth").and_then(|v| v.as_str()).unwrap_or("").to_string();
        self.subscriptions.write().await
            .entry(user_id).or_default()
            .push(PushSub { endpoint: endpoint.to_string(), p256dh, auth });
    }

    pub async fn remove_subscription(&self, user_id: i64, endpoint: &str) {
        let mut map = self.subscriptions.write().await;
        if let Some(list) = map.get_mut(&user_id) {
            list.retain(|s| s.endpoint != endpoint);
            if list.is_empty() {
                map.remove(&user_id);
            }
        }
    }

    pub async fn send_push(&self, user_id: i64, payload: &Value) {
        if !self.ready { return; }
        let subs = {
            let map = self.subscriptions.read().await;
            map.get(&user_id).cloned().unwrap_or_default()
        };
        if subs.is_empty() { return; }
        let payload_bytes = serde_json::to_string(payload).unwrap_or_default().into_bytes();
        let client = match IsahcWebPushClient::new() {
            Ok(c) => c,
            Err(e) => {
                warn!(err = %e, action = "push_client", "Failed to create push client");
                return;
            }
        };

        // Build partial VAPID signature builder (no subscription info yet)
        let partial = match VapidSignatureBuilder::from_base64_no_sub(
            &self.vapid_private_key,
        ) {
            Ok(b) => b,
            Err(e) => {
                warn!(err = %e, action = "push_sig", "Failed to create VAPID signature builder");
                return;
            }
        };

        for sub in &subs {
            let info = SubscriptionInfo::new(
                sub.endpoint.clone(),
                sub.p256dh.clone(),
                sub.auth.clone(),
            );
            let mut sig_builder = partial.clone().add_sub_info(&info);
            sig_builder.add_claim("sub", self.vapid_subject.as_str());
            let sig = match sig_builder.build() {
                Ok(s) => s,
                Err(e) => {
                    warn!(err = %e, action = "push_sig", "Failed to build VAPID signature");
                    continue;
                }
            };
            let mut builder = WebPushMessageBuilder::new(&info);
            builder.set_payload(ContentEncoding::Aes128Gcm, &payload_bytes);
            builder.set_vapid_signature(sig);
            match builder.build() {
                Ok(msg) => {
                    if let Err(e) = client.send(msg).await {
                        warn!(user_id, err = %e, action = "push_send", "Error sending push");
                        if is_gone(&e) {
                            self.remove_subscription(user_id, &sub.endpoint).await;
                        }
                    }
                }
                Err(e) => warn!(err = %e, action = "push_build", "Error building push message"),
            }
        }
    }
}

fn is_gone(err: &WebPushError) -> bool {
    let msg = err.to_string();
    msg.contains("410") || msg.contains("404") || msg.contains("not found") || msg.contains("gone")
}
