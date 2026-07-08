// Handler registry — maps MessageType to handler functions
// Central dispatch for both WS and TCP transports

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, warn};

use crate::connection_manager::ConnectionManager;
use crate::protocol::{self, Frame, msg_type, json_payload, encode_response, encode_error, flags};

pub type HandlerFn = Arc<dyn Fn(HandlerCtx, Frame) -> Box<dyn std::future::Future<Output = ()> + Send + Unpin> + Send + Sync>;

pub struct HandlerCtx {
    pub user: crate::types::User,
    pub conn_mgr: Arc<ConnectionManager>,
    pub send: Arc<dyn Fn(Vec<u8>) + Send + Sync>,
    pub kafka: Option<Arc<crate::kafka::KafkaBus>>,
}

impl HandlerCtx {
    pub fn respond(&self, frame: &Frame, payload: &[u8]) {
        let resp = encode_response(frame, payload);
        (self.send)(resp);
    }

    pub fn respond_json(&self, frame: &Frame, value: &impl serde::Serialize) {
        let bytes = serde_json::to_vec(value).unwrap_or_default();
        self.respond(frame, &bytes);
    }

    pub fn respond_error(&self, frame: &Frame, error_msg: &str) {
        let resp = encode_error(frame, error_msg);
        (self.send)(resp);
    }
}

pub struct HandlerRegistry {
    handlers: RwLock<HashMap<u16, HandlerFn>>,
}

impl HandlerRegistry {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            handlers: RwLock::new(HashMap::new()),
        })
    }

    pub async fn register(&self, msg_type: u16, handler: HandlerFn) {
        self.handlers.write().await.insert(msg_type, handler);
    }

    pub async fn dispatch(&self, ctx: HandlerCtx, frame: &Frame) {
        let handlers = self.handlers.read().await;
        let handler = match handlers.get(&frame.msg_type) {
            Some(h) => h.clone(),
            None => {
                warn!(msg_type = %frame.msg_type, "No handler registered");
                return;
            }
        };
        drop(handlers);
        handler(ctx, frame.clone()).await;
    }

    pub async fn get(&self, msg_type: u16) -> Option<HandlerFn> {
        self.handlers.read().await.get(&msg_type).cloned()
    }
}
