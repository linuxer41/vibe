// WebSocket server — native WS (no Socket.IO)
// Binary frames on port WS_PORT (default 3001)

use std::sync::Arc;
use tokio::net::TcpListener;
use tokio_tungstenite::{tungstenite::Message, accept_async};
use tracing::{error, info, warn};
use futures_util::StreamExt;

use crate::connection_manager::ConnectionManager;
use crate::protocol::{self, Frame, decode_frame, json_payload};
use crate::protocol::msg_type;
use crate::protocol::flags;
use crate::handler_registry::HandlerRegistry;

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
    let (mut write, mut read) = ws_stream.split();

    let mut user: Option<crate::types::User> = None;
    let mut user_id: i64 = 0;
    let mut session_id: Option<crate::connection_manager::SessionId> = None;

    let send_fn: crate::connection_manager::SendFn = Arc::new({
        let mut w = write;
        move |buf: Vec<u8>| {
            let w = &mut w;
            let msg = Message::Binary(buf.into());
            if let Err(e) = futures_util::SinkExt::send(w, msg).now_or_never() {
                // If send fails, the connection is probably closed
            }
        }
    });

    loop {
        let msg = match read.next().await {
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
                let _ = write.send(Message::Pong(p)).await;
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

        // Handle Ping
        if frame.msg_type == msg_type::PING {
            let pong = protocol::create_pong_frame();
            let _ = write.send(Message::Binary(pong.into())).await;
            continue;
        }

        // Handle auth
        if user.is_none() {
            if frame.msg_type == msg_type::AUTH_RESTORE || frame.msg_type == msg_type::AUTH_VERIFY_CODE {
                handle_auth(&frame, &mut user, &mut user_id, &mut session_id, &conn_mgr, &write, &registry).await;
            }
            continue;
        }

        // Dispatch to handler
        if let Some(u) = &user {
            registry.dispatch(&conn_mgr, u, &frame, &write, |w, buf| {
                Box::pin(async move {
                    let _ = w.send(Message::Binary(buf.into())).await;
                })
            }).await;
        }
    }

    // Cleanup
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
    write: &futures_util::stream::SplitSink<tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>, Message>,
    registry: &Arc<HandlerRegistry>,
) {
    // For auth, we need to handle the response specially
    // to extract user info from the response and register in conn_mgr
    // This is a simplified version — full implementation mirrors server-tcp.js logic
    registry.dispatch(conn_mgr, &crate::types::User::default(), frame, write, |w, buf| {
        Box::pin(async move {
            let _ = w.send(Message::Binary(buf.into())).await;
        })
    }).await;
}
