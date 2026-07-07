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

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, OnceLock};

use axum::{Router, routing::post, response::Json};
use deadpool_postgres::{Config, Runtime};
use serde_json::{json, Value};
use socketioxide::{SocketIo, extract::{Data, SocketRef}};
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tracing::info;
use std::path::PathBuf;

use handlers::{register_handlers, AppState};
use push::PushManager;

static STATE: OnceLock<Arc<AppState>> = OnceLock::new();

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .with_target(false)
        .with_thread_ids(false)
        .with_file(false)
        .with_line_number(false)
        .compact()
        .with_ansi(true)
        .init();

    dotenvy::dotenv().ok();

    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://linuxer:12345678@localhost:5432/vibe".to_string());
    let storage_url = std::env::var("STORAGE_URL")
        .unwrap_or_else(|_| "http://localhost:3002".to_string());

    let mut cfg = Config::new();
    cfg.url = Some(db_url);
    let pool = cfg.create_pool(Some(Runtime::Tokio1), tokio_postgres::NoTls)?;

    // Test connection
    db::init_db(&pool).await?;
    info!("Database connected");

    // Keep DB connection alive with periodic ping
    let keepalive_pool = pool.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            interval.tick().await;
            db::keepalive_ping(&keepalive_pool).await;
        }
    });

    let (layer, io) = SocketIo::builder().build_layer();

    let push_mgr = PushManager::new();
    push_mgr.load_from_db(&pool).await;

    let state = Arc::new(AppState {
        db: pool,
        io: io.clone(),
        online_users: RwLock::new(HashSet::new()),
        socket_user_map: RwLock::new(HashMap::new()),
        user_socket_map: RwLock::new(HashMap::new()),
        socket_formats: RwLock::new(HashMap::new()),
        socket_tokens: RwLock::new(HashMap::new()),
        push: push_mgr,
        storage_url: storage_url.clone(),
    });

    STATE.set(state.clone()).map_err(|_| "State already set")?;

    io.ns("/", async move |socket: SocketRef, auth: Data<Value>| {
        register_handlers(socket, state, auth.0);
    });

    valkey::start_subscriber(
        io.clone(),
        &[
            "chat:messages",
            "posts:new",
            "posts:interactions",
            "stories:new",
            "videos:new",
            "videos:interactions",
            "lives:new",
            "contacts:status",
            "calls:signaling",
            "broadcasts:signaling",
            "games:signaling",
            "notifications:user",
            "channels:updates",
            "memes:new",
            "polls:updates",
            "watch:sync",
            "global:events",
        ],
    )?;
    info!("Valkey subscriber started");

    async fn upload_handler(mut multipart: axum::extract::Multipart) -> Json<Value> {
        use tokio::io::AsyncWriteExt;
        let field = match multipart.next_field().await {
            Ok(Some(f)) => f,
            _ => return Json(json!({"ok": false, "error": "No file"})),
        };
        let filename = format!("{}_{}", chrono::Utc::now().timestamp_millis(), uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("x"));
        let ext = field.file_name().and_then(|n| std::path::Path::new(n).extension().and_then(|e| e.to_str())).unwrap_or("jpg");
        let fullname = format!("{}.{}", filename, ext);
        let data = match field.bytes().await {
            Ok(d) => d,
            Err(_) => return Json(json!({"ok": false, "error": "Read error"})),
        };
        let upload_dir = PathBuf::from("../storage-server/media");
        let _ = tokio::fs::create_dir_all(&upload_dir).await;
        let filepath = upload_dir.join(&fullname);
        match tokio::fs::File::create(&filepath).await {
            Ok(mut f) => {
                if f.write_all(&data).await.is_ok() {
                    info!(filename = %fullname, bytes = data.len(), action = "upload", "File uploaded");
                    let st = crate::STATE.get().expect("State not initialized");
                    Json(json!({"ok": true, "url": format!("{}/media/{}", st.storage_url, fullname)}))
                } else {
                    Json(json!({"ok": false, "error": "Write error"}))
                }
            }
            Err(_) => Json(json!({"ok": false, "error": "Create error"})),
        }
    }

    async fn push_subscribe_handler(axum::Json(body): axum::Json<Value>) -> Json<Value> {
        let state = crate::STATE.get().expect("State not initialized");
        let user_id = body.get("userId").and_then(|v| v.as_i64()).unwrap_or(0);
        let endpoint = body.get("endpoint").and_then(|v| v.as_str()).unwrap_or("");
        let keys = body.get("keys").cloned().unwrap_or(Value::Null);
        if user_id == 0 || endpoint.is_empty() {
            return Json(json!({"ok": false, "error": "Missing userId or endpoint"}));
        }
        // Persist to DB
        let _ = db::add_push_subscription(&state.db, user_id, endpoint, &keys).await;
        // Cache in memory
        state.push.add_subscription(user_id, endpoint, &keys).await;
        Json(json!({"ok": true}))
    }

    async fn push_unsubscribe_handler(axum::Json(body): axum::Json<Value>) -> Json<Value> {
        let state = crate::STATE.get().expect("State not initialized");
        let user_id = body.get("userId").and_then(|v| v.as_i64()).unwrap_or(0);
        let endpoint = body.get("endpoint").and_then(|v| v.as_str()).unwrap_or("");
        if user_id == 0 || endpoint.is_empty() {
            return Json(json!({"ok": false, "error": "Missing userId or endpoint"}));
        }
        // Remove from DB
        let _ = db::remove_push_subscription(&state.db, user_id, endpoint).await;
        // Remove from cache
        state.push.remove_subscription(user_id, endpoint).await;
        Json(json!({"ok": true}))
    }

    let app = Router::new()
        .route("/upload", post(upload_handler))
        .route("/vapid-public-key", axum::routing::get(|| async { Json(json!({"key": crate::STATE.get().map(|s| s.push.vapid_public_key.clone()).unwrap_or_default()})) }))
        .route("/push/subscribe", axum::routing::post(push_subscribe_handler))
        .route("/push/unsubscribe", axum::routing::post(push_unsubscribe_handler))
        .nest_service("/uploads", tower_http::services::ServeDir::new("../storage-server/media"))
        .layer(layer)
        .layer(CorsLayer::permissive());

    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("0.0.0.0:{}", port);
    info!("Servidor en http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
