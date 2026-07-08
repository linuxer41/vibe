// Vibe Backend (Rust) — Binary Protocol
// WS server (port 3001) + TCP server (port 5000)
// Kafka for events, Valkey for gateway state

pub mod generated {
    #![allow(unused, dead_code)]
    include!("generated/vibe_generated.rs");
}

mod db;
mod format;
mod handlers;
mod push;
mod snowflake;
mod types;
mod valkey;
mod protocol;
mod connection_manager;
mod kafka;
mod handler_registry;
mod ws_server;
mod tcp_server;

use std::sync::Arc;
use axum::{Router, response::Json, routing::post};
use deadpool_postgres::{Config, Runtime};
use tower_http::cors::CorsLayer;
use tracing::info;

use crate::connection_manager::ConnectionManager;
use crate::handler_registry::HandlerRegistry;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .with_target(false)
        .compact()
        .with_ansi(true)
        .init();

    dotenvy::dotenv().ok();

    // DB
    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://linuxer:12345678@localhost:5432/vibe".to_string());
    let storage_url = std::env::var("STORAGE_URL")
        .unwrap_or_else(|_| "http://localhost:3002".to_string());

    let mut cfg = Config::new();
    cfg.url = Some(db_url);
    let pool = cfg.create_pool(Some(Runtime::Tokio1), tokio_postgres::NoTls)?;

    db::init_db(&pool).await?;
    info!("Database connected");

    // Keepalive
    let keepalive_pool = pool.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            interval.tick().await;
            db::keepalive_ping(&keepalive_pool).await;
        }
    });

    // Valkey gateway (connection state)
    valkey::connect().await;
    info!("Valkey (gateway) connected");

    // Kafka
    let mut kafka_bus = crate::kafka::KafkaBus::new();
    kafka_bus.connect_producer().await;
    let kafka = Arc::new(kafka_bus);

    // Connection manager
    let conn_mgr = ConnectionManager::new(pool.clone());

    // Handler registry
    let registry = HandlerRegistry::new();

    // Register ALL handlers
    handlers::register_handlers(&registry, conn_mgr.clone(), kafka.clone()).await;

    // Start Kafka consumer (cross-instance delivery)
    let topics = vec!["chat-messages", "chat-new", "chat-events", "user-presence"];
    kafka.start_consumer("vibe-rust-group", &topics, conn_mgr.clone()).await;

    // Start servers
    let ws_port: u16 = std::env::var("WS_PORT")
        .unwrap_or_else(|_| "3001".to_string())
        .parse()
        .unwrap_or(3001);
    let tcp_port: u16 = std::env::var("TCP_PORT")
        .unwrap_or_else(|_| "5000".to_string())
        .parse()
        .unwrap_or(5000);

    let cm_ws = conn_mgr.clone();
    let reg_ws = registry.clone();
    tokio::spawn(async move {
        ws_server::start_ws_server(ws_port, cm_ws, reg_ws).await;
    });

    let cm_tcp = conn_mgr.clone();
    let reg_tcp = registry.clone();
    let kafka_tcp = kafka.clone();
    tokio::spawn(async move {
        tcp_server::start_tcp_server(tcp_port, cm_tcp, reg_tcp, Some(kafka_tcp)).await;
    });

    // HTTP Auth server (port 2001) — separate from storage/upload server
    {
        let pool = pool.clone();
        tokio::spawn(async move {
            use axum::{routing::post, Json};
            let pool_clone = pool.clone();
            let app = Router::new()
                .route("/auth/send-code", post(move |body: Json<serde_json::Value>| {
                    let pool = pool_clone.clone();
                    async move {
                        let phone = body.get("phone").and_then(|v| v.as_str()).unwrap_or("");
                        if phone.len() < 10 {
                            return Json(serde_json::json!({"ok": false, "error": "Teléfono inválido"}));
                        }
                        match crate::db::send_code(&pool, phone).await {
                            Ok(code) => Json(serde_json::json!({"ok": true, "code": code})),
                            Err(e) => Json(serde_json::json!({"ok": false, "error": e.to_string()})),
                        }
                    }
                }))
                .route("/auth/verify-code", post({
                    let pool = pool.clone();
                    move |body: Json<serde_json::Value>| {
                        let pool = pool.clone();
                        async move {
                            let phone = body.get("phone").and_then(|v| v.as_str()).unwrap_or("");
                            let code = body.get("code").and_then(|v| v.as_str()).unwrap_or("");
                            if phone.is_empty() || code.is_empty() {
                                return Json(serde_json::json!({"ok": false, "error": "Datos incompletos"}));
                            }
                            match crate::db::verify_code(&pool, phone, code).await {
                                Ok(true) => {
                                    let username = body.get("username").and_then(|v| v.as_str()).unwrap_or("");
                                    let display_name = body.get("displayName").and_then(|v| v.as_str()).unwrap_or(phone);
                                    let country_code = body.get("countryCode").and_then(|v| v.as_str()).unwrap_or("");
                                    match crate::db::find_or_create_user(&pool, phone, username, display_name, country_code).await {
                                        Ok((user, is_new)) => {
                                            match crate::db::create_session(&pool, user.id, "").await {
                                                Ok(token) => Json(serde_json::json!({
                                                    "ok": true,
                                                    "token": token,
                                                    "userId": user.id,
                                                    "displayName": user.display_name,
                                                    "avatar": user.avatar,
                                                    "isNew": is_new,
                                                })),
                                                Err(e) => Json(serde_json::json!({"ok": false, "error": e.to_string()})),
                                            }
                                        }
                                        Err(e) => Json(serde_json::json!({"ok": false, "error": e.to_string()})),
                                    }
                                }
                                Ok(false) => Json(serde_json::json!({"ok": false, "error": "Código incorrecto"})),
                                Err(e) => Json(serde_json::json!({"ok": false, "error": e.to_string()})),
                            }
                        }
                    }
                }))
                .route("/auth/restore", post({
                    let pool = pool.clone();
                    move |body: Json<serde_json::Value>| {
                        let pool = pool.clone();
                        async move {
                            let token = body.get("token").and_then(|v| v.as_str()).unwrap_or("");
                            if token.is_empty() {
                                return Json(serde_json::json!({"ok": false, "error": "Token requerido"}));
                            }
                            match crate::db::get_session(&pool, token).await {
                                Ok(Some(user)) => Json(serde_json::json!({"ok": true, "user": user})),
                                Ok(None) => Json(serde_json::json!({"ok": false, "error": "Sesión inválida"})),
                                Err(e) => Json(serde_json::json!({"ok": false, "error": e.to_string()})),
                            }
                        }
                    }
                }))
                .route("/health", axum::routing::get(|| async {
                    Json(serde_json::json!({"ok": true, "server": "http-auth"}))
                }))
                .layer(CorsLayer::permissive());
            let auth_port: u16 = std::env::var("HTTP_AUTH_PORT").unwrap_or_else(|_| "2001".to_string()).parse().unwrap_or(2001);
            let addr = format!("0.0.0.0:{}", auth_port);
            info!("HTTP Auth server on {}", addr);
            if let Ok(listener) = tokio::net::TcpListener::bind(&addr).await {
                let _ = axum::serve(listener, app).await;
            }
        });
    }

    // Push manager
    let push_mgr = crate::push::PushManager::new();
    push_mgr.load_from_db(&pool).await;
    let push_mgr = Arc::new(push_mgr);

    // HTTP routes (upload, push, etc.)
    let app = Router::new()
        .route("/upload", post(upload_handler))
        .route("/vapid-public-key", axum::routing::get(|| async {
            Json(serde_json::json!({"key": ""}))
        }))
        .route("/push/subscribe", post(push_subscribe_handler))
        .route("/push/unsubscribe", post(push_unsubscribe_handler))
        .nest_service("/uploads", tower_http::services::ServeDir::new("../storage-server/media"))
        .layer(CorsLayer::permissive());

    let http_port = std::env::var("HTTP_PORT").unwrap_or_else(|_| "3002".to_string());
    let addr = format!("0.0.0.0:{}", http_port);
    info!("HTTP server on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn upload_handler(mut multipart: axum::extract::Multipart) -> Json<serde_json::Value> {
    use tokio::io::AsyncWriteExt;
    let field = match multipart.next_field().await {
        Ok(Some(f)) => f,
        _ => return Json(serde_json::json!({"ok": false, "error": "No file"})),
    };
    let filename = format!("{}_{}", chrono::Utc::now().timestamp_millis(), uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("x"));
    let ext = field.file_name().and_then(|n| std::path::Path::new(n).extension().and_then(|e| e.to_str())).unwrap_or("jpg");
    let fullname = format!("{}.{}", filename, ext);
    let data = match field.bytes().await {
        Ok(d) => d,
        Err(_) => return Json(serde_json::json!({"ok": false, "error": "Read error"})),
    };
    let storage_url = std::env::var("STORAGE_URL").unwrap_or_else(|_| "http://localhost:3002".to_string());
    let upload_dir = std::path::PathBuf::from("../storage-server/media");
    let _ = tokio::fs::create_dir_all(&upload_dir).await;
    let filepath = upload_dir.join(&fullname);
    match tokio::fs::File::create(&filepath).await {
        Ok(mut f) => {
            if f.write_all(&data).await.is_ok() {
                info!(filename = %fullname, bytes = data.len(), action = "upload", "File uploaded");
                Json(serde_json::json!({"ok": true, "url": format!("{}/media/{}", storage_url, fullname)}))
            } else {
                Json(serde_json::json!({"ok": false, "error": "Write error"}))
            }
        }
        Err(_) => Json(serde_json::json!({"ok": false, "error": "Create error"})),
    }
}

async fn push_subscribe_handler(axum::Json(body): axum::Json<serde_json::Value>) -> Json<serde_json::Value> {
    let user_id = body.get("userId").and_then(|v| v.as_i64()).unwrap_or(0);
    let endpoint = body.get("endpoint").and_then(|v| v.as_str()).unwrap_or("");
    let keys = body.get("keys").cloned().unwrap_or(serde_json::Value::Null);
    if user_id == 0 || endpoint.is_empty() {
        return Json(serde_json::json!({"ok": false, "error": "Missing userId or endpoint"}));
    }
    Json(serde_json::json!({"ok": true}))
}

async fn push_unsubscribe_handler(axum::Json(body): axum::Json<serde_json::Value>) -> Json<serde_json::Value> {
    let user_id = body.get("userId").and_then(|v| v.as_i64()).unwrap_or(0);
    let endpoint = body.get("endpoint").and_then(|v| v.as_str()).unwrap_or("");
    if user_id == 0 || endpoint.is_empty() {
        return Json(serde_json::json!({"ok": false, "error": "Missing userId or endpoint"}));
    }
    Json(serde_json::json!({"ok": true}))
}
