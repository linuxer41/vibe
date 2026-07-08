// Raw TCP server — same binary frame protocol as WS
// Frame parser handles stream-based reads (messages can be split across TCP segments)

use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tracing::{error, info, warn};

use crate::connection_manager::{ConnectionManager, SendFn};
use crate::protocol::{self, Frame, decode_frame, HEADER_SIZE, MAGIC};
use crate::protocol::{msg_type, flags as proto_flags};
use crate::handler_registry::{HandlerRegistry, HandlerCtx};
use crate::tracer;

pub async fn start_tcp_server(
    port: u16,
    conn_mgr: Arc<ConnectionManager>,
    registry: Arc<HandlerRegistry>,
    kafka: Option<Arc<crate::kafka::KafkaBus>>,
) {
    let addr = format!("0.0.0.0:{}", port);
    let listener = match TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            error!(err = %e, port = %port, "Failed to bind TCP server");
            return;
        }
    };
    info!(port = %port, action = "startup", "TCP server listening");

    loop {
        let (stream, peer) = match listener.accept().await {
            Ok(s) => s,
            Err(e) => {
                warn!(err = %e, "TCP accept error");
                continue;
            }
        };
        let conn_mgr = conn_mgr.clone();
        let registry = registry.clone();
        let kafka = kafka.clone();
        tokio::spawn(async move {
            handle_tcp_connection(stream, peer, conn_mgr, registry, kafka).await;
        });
    }
}

struct FrameParser {
    buffer: Vec<u8>,
}

impl FrameParser {
    fn new() -> Self {
        Self { buffer: Vec::new() }
    }

    fn feed(&mut self, data: &[u8]) -> Vec<Frame> {
        self.buffer.extend_from_slice(data);
        let mut frames = Vec::new();

        loop {
            if self.buffer.len() < HEADER_SIZE {
                break;
            }

            let magic = u16::from_be_bytes([self.buffer[0], self.buffer[1]]);
            if magic != MAGIC {
                let pos = self.buffer.windows(2).position(|w| w[0] == (MAGIC >> 8) as u8 && w[1] == (MAGIC & 0xFF) as u8);
                match pos {
                    Some(p) => { self.buffer.drain(..p); }
                    None => { self.buffer.clear(); break; }
                }
                if self.buffer.len() < HEADER_SIZE { break; }
            }

            let payload_len = u32::from_be_bytes([self.buffer[10], self.buffer[11], self.buffer[12], self.buffer[13]]);
            let frame_size = HEADER_SIZE + payload_len as usize;

            if self.buffer.len() < frame_size {
                break;
            }

            let frame_buf = self.buffer[..frame_size].to_vec();
            self.buffer.drain(..frame_size);

            if let Some(frame) = decode_frame(&frame_buf) {
                frames.push(frame);
            }
        }

        frames
    }
}

async fn handle_tcp_connection(
    mut stream: tokio::net::TcpStream,
    peer: std::net::SocketAddr,
    conn_mgr: Arc<ConnectionManager>,
    registry: Arc<HandlerRegistry>,
    kafka: Option<Arc<crate::kafka::KafkaBus>>,
) {
    let _ = stream.set_nodelay(true);
    let mut parser = FrameParser::new();
    let mut buf = [0u8; 65536];

    let mut user: Option<crate::types::User> = None;
    let mut user_id: i64 = 0;
    let mut session_id: Option<crate::connection_manager::SessionId> = None;

    tracer::conn_connect("tcp", 0, &peer.to_string());

    // Split stream for concurrent read/write
    let (mut reader, writer) = stream.into_split();
    let writer = Arc::new(tokio::sync::Mutex::new(writer));
    let send_fn: SendFn = {
        let w = writer.clone();
        Arc::new(move |buf: Vec<u8>| {
            let w = w.clone();
            tokio::spawn(async move {
                let mut guard = w.lock().await;
                let _ = guard.write_all(&buf).await;
            });
        })
    };

    loop {
        let n = match reader.read(&mut buf).await {
            Ok(0) => break,
            Ok(n) => n,
            Err(e) => {
                warn!(peer = %peer, err = %e, "TCP read error");
                break;
            }
        };

        let frames = parser.feed(&buf[..n]);
        for frame in frames {
            let msg_type_val = frame.msg_type;
            let payload_size = frame.payload.len();

            tracer::msg_received("tcp", user_id, msg_type_val, payload_size);

            if frame.msg_type == msg_type::PING {
                let pong = protocol::create_pong_frame();
                let w = writer.clone();
                tokio::spawn(async move {
                    let mut guard = w.lock().await;
                    let _ = guard.write_all(&pong).await;
                });
                continue;
            }

            if user.is_none() {
                handle_tcp_auth(&frame, &mut user, &mut user_id, &mut session_id, &conn_mgr, &send_fn, &registry, kafka.clone()).await;
                continue;
            }

            if let Some(u) = &user {
                let ctx = HandlerCtx {
                    user: u.clone(),
                    conn_mgr: conn_mgr.clone(),
                    send: send_fn.clone(),
                    kafka: kafka.clone(),
                };
                registry.dispatch(ctx, &frame).await;
            }
        }
    }

    tracer::conn_disconnect("tcp", user_id, &peer.to_string());

    // Cleanup
    if let Some(sid) = session_id {
        conn_mgr.remove_connection(user_id, sid).await;
    }
}

async fn handle_tcp_auth(
    frame: &Frame,
    user: &mut Option<crate::types::User>,
    user_id: &mut i64,
    session_id: &mut Option<crate::connection_manager::SessionId>,
    conn_mgr: &Arc<ConnectionManager>,
    send_fn: &Arc<dyn Fn(Vec<u8>) + Send + Sync>,
    registry: &Arc<HandlerRegistry>,
    kafka: Option<Arc<crate::kafka::KafkaBus>>,
) {
    if frame.msg_type != msg_type::AUTH_RESTORE && frame.msg_type != msg_type::AUTH_VERIFY_CODE {
        return;
    }

    // Intercept the first send to capture auth result
    // The auth handler will send a response — we need to check if auth succeeded
    // and register the user in the connection manager

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
            let frame = decode_frame(&data);
            if let Some(f) = frame {
                if f.flags & proto_flags::RESPONSE != 0 {
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
                                    let sid = cm.add_connection(uid, os, "tcp").await;
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
        kafka: kafka.clone(),
    };
    registry.dispatch(ctx, frame).await;

    // Check if auth was set by the interceptor
    if let Ok(mut u) = user_clone.try_lock() {
        if let Some(u2) = u.take() {
            *user = Some(u2.clone());
            crate::valkey::set_online(u2.id).await;
        }
    };
    if let Ok(uid) = uid_clone.try_lock() {
        *user_id = *uid;
    };
    if let Ok(mut sid) = sid_clone.try_lock() {
        *session_id = sid.take();
    };
}
