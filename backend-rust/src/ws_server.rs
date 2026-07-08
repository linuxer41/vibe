// WebSocket server — native WS (no Socket.IO)
// Binary frames on port WS_PORT (default 3001)

use std::sync::Arc;
use tokio::net::TcpListener;
use tokio_tungstenite::{tungstenite::Message, accept_async};
use tracing::{error, info, warn};
use futures_util::{StreamExt, SinkExt, FutureExt};

use crate::connection_manager::{ConnectionManager, SendFn};
use crate::protocol::{self, Frame, decode_frame};
use crate::protocol::msg_type;
use crate::handler_registry::{HandlerRegistry, HandlerCtx};
use crate::tracer;

pub async fn start_ws_server(
    port: u16,
    conn_mgr: Arc<ConnectionManager>,
    registry: Arc<HandlerRegistry>,
) {
    let addr = format!("0.0.0.0:{}", port);
    let listener = match TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            error!(err = %e, port = %port, "Failed to bind WS server");
            return;
        }
    };
    info!(port = %port, action = "startup", "WS server listening");

    loop {
        let (stream, peer) = match listener.accept().await {
            Ok(s) => s,
            Err(e) => {
                warn!(err = %e, "WS accept error");
                continue;
            }
        };
        let conn_mgr = conn_mgr.clone();
        let registry = registry.clone();
        tokio::spawn(async move {
            handle_ws_connection(stream, peer, conn_mgr, registry).await;
        });
    }
}

async fn handle_ws_connection(
    stream: tokio::net::TcpStream,
    peer: std::net::SocketAddr,
    conn_mgr: Arc<ConnectionManager>,
    registry: Arc<HandlerRegistry>,
) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            warn!(peer = %peer, err = %e, "WS handshake failed");
            return;
        }
    };
    let (ws_write, mut ws_read) = ws_stream.split();

    let peer_str = peer.to_string();
    tracer::conn_connect("ws", 0, &peer_str);

    let mut user: Option<crate::types::User> = None;
    let mut user_id: i64 = 0;
    let mut session_id: Option<crate::connection_manager::SessionId> = None;

    let write = Arc::new(tokio::sync::Mutex::new(ws_write));
    let send_fn: SendFn = {
        let w = write.clone();
        Arc::new(move |buf: Vec<u8>| {
            let w = w.clone();
            tokio::spawn(async move {
                let mut guard = w.lock().await;
                let msg = Message::Binary(buf.into());
                let _ = guard.send(msg).await;
            });
        })
    };

    loop {
        let msg = match ws_read.next().await {
            Some(Ok(m)) => m,
            Some(Err(e)) => {
                warn!(peer = %peer, err = %e, "WS read error");
                break;
            }
            None => break,
        };

        let data = match msg {
            Message::Binary(b) => b.to_vec(),
            Message::Close(_) => break,
            Message::Ping(p) => {
                let w = write.clone();
                tokio::spawn(async move {
                    let mut guard = w.lock().await;
                    let _ = guard.send(Message::Pong(p)).await;
                });
                continue;
            }
            Message::Pong(_) => continue,
            Message::Text(t) => t.into_bytes(),
            _ => continue,
        };

        let frame = match decode_frame(&data) {
            Some(f) => f,
            None => continue,
        };

        let msg_type_val = frame.msg_type;
        let payload_size = frame.payload.len();
        tracer::msg_received("ws", user_id, msg_type_val, payload_size);

        if frame.msg_type == msg_type::PING {
            let pong = protocol::create_pong_frame();
            let w = write.clone();
            tokio::spawn(async move {
                let mut guard = w.lock().await;
                let _ = guard.send(Message::Binary(pong.into())).await;
            });
            continue;
        }

        if user.is_none() {
            if frame.msg_type == msg_type::AUTH_RESTORE || frame.msg_type == msg_type::AUTH_VERIFY_CODE {
                handle_auth(&frame, &mut user, &mut user_id, &mut session_id, &conn_mgr, &send_fn, &registry).await;
            }
            continue;
        }

        if let Some(u) = &user {
            let ctx = HandlerCtx {
                user: u.clone(),
                conn_mgr: conn_mgr.clone(),
                send: send_fn.clone(),
                kafka: None,
            };
            registry.dispatch(ctx, &frame).await;
        }
    }

    tracer::conn_disconnect("ws", user_id, &peer_str);

    if let Some(sid) = session_id {
        conn_mgr.remove_connection(user_id, sid).await;
        crate::valkey::set_offline(user_id).await;
    }
}

async fn handle_auth(
    frame: &Frame,
    user: &mut Option<crate::types::User>,
    user_id: &mut i64,
    session_id: &mut Option<crate::connection_manager::SessionId>,
    conn_mgr: &Arc<ConnectionManager>,
    send_fn: &SendFn,
    registry: &Arc<HandlerRegistry>,
) {
    let handler = registry.get(frame.msg_type).await;
    if handler.is_none() { return; }

    let orig_send = send_fn.clone();
    let first_send = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
    let first_send_c = first_send.clone();
    let conn_mgr_clone = conn_mgr.clone();
    let user_clone: std::sync::Arc<tokio::sync::Mutex<Option<crate::types::User>>> = std::sync::Arc::new(tokio::sync::Mutex::new(None));
    let user_clone2 = user_clone.clone();
    let uid_clone: std::sync::Arc<tokio::sync::Mutex<i64>> = std::sync::Arc::new(tokio::sync::Mutex::new(0));
    let uid_clone2 = uid_clone.clone();
    let sid_clone: std::sync::Arc<tokio::sync::Mutex<Option<crate::connection_manager::SessionId>>> = std::sync::Arc::new(tokio::sync::Mutex::new(None));
    let sid_clone2 = sid_clone.clone();

    let send_wrapper: SendFn = Arc::new(move |data: Vec<u8>| {
        let first = first_send_c.swap(false, std::sync::atomic::Ordering::SeqCst);
        if first {
            let f = decode_frame(&data);
            if let Some(ref f) = f {
                if f.flags & protocol::flags::RESPONSE != 0 {
                    let text = String::from_utf8_lossy(&f.payload);
                    if let Ok(resp) = serde_json::from_str::<serde_json::Value>(&text) {
                        if resp.get("ok").and_then(|v| v.as_bool()).unwrap_or(false) {
                            let uid = resp.get("userId").and_then(|v| v.as_i64())
                                .or_else(|| resp.get("user").and_then(|v| v.get("id")).and_then(|v| v.as_i64()))
                                .unwrap_or(0);
                            if uid > 0 {
                                let u = crate::types::User {
                                    id: uid,
                                    display_name: resp.get("displayName").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                    avatar: resp.get("avatar").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                    ..Default::default()
                                };
                                let cm = conn_mgr_clone.clone();
                                let os = orig_send.clone();
                                let uc2 = user_clone2.clone();
                                let ucid2 = uid_clone2.clone();
                                let sc2 = sid_clone2.clone();
                                tokio::spawn(async move {
                                    let sid = cm.add_connection(uid, os, "ws").await;
                                    *uc2.try_lock().unwrap() = Some(u);
                                    *ucid2.try_lock().unwrap() = uid;
                                    *sc2.try_lock().unwrap() = Some(sid);
                                });
                            }
                        }
                    }
                }
            }
        }
        (orig_send)(data);
    });

    let ctx = HandlerCtx {
        user: crate::types::User::default(),
        conn_mgr: conn_mgr.clone(),
        send: send_wrapper,
        kafka: None,
    };
    registry.dispatch(ctx, frame).await;

    if let Ok(mut u) = user_clone.try_lock() {
        if let Some(u2) = u.take() {
            *user = Some(u2.clone());
            crate::valkey::set_online(u2.id).await;
        }
    }
    if let Ok(uid) = uid_clone.try_lock() {
        *user_id = *uid;
    };
    if let Ok(mut sid) = sid_clone.try_lock() {
        *session_id = sid.take();
    };
}
