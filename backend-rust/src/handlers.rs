// Handler registration — maps MessageType to handler functions
// Each handler: parse frame → call db → respond → produce Kafka for fanout

use std::sync::Arc;
use tracing::{error, info, warn};

use crate::connection_manager::ConnectionManager;
use crate::handler_registry::{HandlerRegistry, HandlerCtx};
use crate::protocol::{self, Frame, json_payload, msg_type, flags};
use crate::types::*;
use crate::db;

fn json_val(frame: &Frame) -> serde_json::Value {
    json_payload(frame)
}

pub async fn register_handlers(
    registry: &Arc<HandlerRegistry>,
    conn_mgr: Arc<ConnectionManager>,
    kafka: Arc<crate::kafka::KafkaBus>,
) {
    let kafka_clone = || kafka.clone();
    let _cm = conn_mgr.clone();

    // ── Auth ──
    registry.register(msg_type::AUTH_SEND_CODE, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let phone = data.get("phone").and_then(|v| v.as_str()).unwrap_or("").trim();
            if phone.len() < 10 {
                ctx.respond_json(&frame, &serde_json::json!({"ok": false, "error": "Teléfono inválido"}));
                return;
            }
            match db::send_code(&ctx.conn_mgr.db, phone).await {
                Ok(code) => ctx.respond_json(&frame, &serde_json::json!({"ok": true, "code": code})),
                Err(e) => ctx.respond_json(&frame, &serde_json::json!({"ok": false, "error": e.to_string()})),
            }
        })
    })).await;

    registry.register(msg_type::AUTH_VERIFY_CODE, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let phone = data.get("phone").and_then(|v| v.as_str()).unwrap_or("");
            let code = data.get("code").and_then(|v| v.as_str()).unwrap_or("");
            match db::verify_code(&ctx.conn_mgr.db, phone, code).await {
                Ok(true) => {
                    let username = data.get("username").and_then(|v| v.as_str()).unwrap_or("");
                    let display_name = data.get("displayName").and_then(|v| v.as_str()).unwrap_or("");
                    let country_code = data.get("countryCode").and_then(|v| v.as_str()).unwrap_or("");
                    match db::find_or_create_user(&ctx.conn_mgr.db, phone, username, display_name, country_code).await {
                        Ok((user, is_new)) => {
                            let token = db::create_session(&ctx.conn_mgr.db, user.id, "").await.unwrap_or_default();
                            ctx.respond_json(&frame, &serde_json::json!({
                                "ok": true, "token": token, "userId": user.id,
                                "displayName": user.display_name, "avatar": user.avatar, "isNew": is_new
                            }));
                            ctx.kafka.as_ref().map(|k| k.produce("user-presence", &user.id.to_string(), &serde_json::json!({"userId": user.id, "online": true}).to_string()));
                        }
                        Err(e) => ctx.respond_json(&frame, &serde_json::json!({"ok": false, "error": e.to_string()})),
                    }
                }
                _ => ctx.respond_json(&frame, &serde_json::json!({"ok": false, "error": "Código incorrecto"})),
            }
        })
    })).await;

    registry.register(msg_type::AUTH_RESTORE, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let token = data.get("token").and_then(|v| v.as_str()).unwrap_or("");
            match db::get_session(&ctx.conn_mgr.db, token).await {
                Ok(Some(user)) => ctx.respond_json(&frame, &serde_json::json!({"ok": true, "user": user})),
                _ => ctx.respond_json(&frame, &serde_json::json!({"ok": false})),
            }
        })
    })).await;

    // ── Chat ──
    registry.register(msg_type::CHAT_SEND, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            let text = data.get("text").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
            let content_type = data.get("contentType").and_then(|v| v.as_str()).unwrap_or("text");
            let reply_to = data.get("replyToId").and_then(|v| v.as_i64());

            if text.is_empty() && content_type == "text" {
                ctx.respond_json(&frame, &serde_json::json!({"ok": false, "error": "Texto inválido"}));
                return;
            }
            match db::add_message(&ctx.conn_mgr.db, chat_id, ctx.user.id, &text, content_type, reply_to).await {
                Ok(msg_id) => {
                    let _ = db::track_activity(&ctx.conn_mgr.db, ctx.user.id, "messaging").await;
                    let msg = serde_json::json!({
                        "id": msg_id, "chat_id": chat_id, "sender_id": ctx.user.id,
                        "sender_name": ctx.user.display_name, "sender_avatar": ctx.user.avatar,
                        "text": text, "type": content_type,
                        "reply_to_id": reply_to, "forwarded": 0,
                        "created_at": chrono::Utc::now().to_rfc3339(), "status": "sent"
                    });
                    ctx.respond_json(&frame, &serde_json::json!({"ok": true, "id": msg_id}));
                    ctx.kafka.as_ref().map(|k| k.produce("chat-messages", &chat_id.to_string(), &serde_json::json!({
                        "chatId": chat_id, "msg": msg, "senderId": ctx.user.id
                    }).to_string()));
                }
                Err(e) => ctx.respond_json(&frame, &serde_json::json!({"ok": false, "error": e.to_string()})),
            }
        })
    })).await;

    registry.register(msg_type::CHAT_GET_CHATS, Arc::new(|ctx, frame| {
        Box::pin(async move {
            match db::get_user_chats(&ctx.conn_mgr.db, ctx.user.id).await {
                Ok(chats) => ctx.respond_json(&frame, &chats),
                Err(_) => ctx.respond_json(&frame, &serde_json::json!([])),
            }
        })
    })).await;

    registry.register(msg_type::CHAT_GET_MESSAGES, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            let limit = data.get("limit").and_then(|v| v.as_i64()).unwrap_or(50) as i32;
            let cursor = data.get("cursor").and_then(|v| v.as_i64());
            match db::get_messages(&ctx.conn_mgr.db, chat_id, limit, cursor, ctx.user.id).await {
                Ok(msgs) => ctx.respond_json(&frame, &msgs),
                Err(_) => ctx.respond_json(&frame, &serde_json::json!([])),
            }
        })
    })).await;

    registry.register(msg_type::CHAT_MARK_READ, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let message_id = data.get("messageId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::mark_read(&ctx.conn_mgr.db, message_id, ctx.user.id).await;
            let _ = db::update_message_status(&ctx.conn_mgr.db, message_id, "read").await;
            if let Ok(Some(msg)) = db::get_message_by_id(&ctx.conn_mgr.db, message_id).await {
                if msg.sender_id != ctx.user.id {
                    // Produce status update via Kafka
                }
            }
        })
    })).await;

    registry.register(msg_type::CHAT_TYPING, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            let fb = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &frame.payload);
            ctx.kafka.as_ref().map(|k| k.produce("chat-events", &chat_id.to_string(), &serde_json::json!({
                "chatId": chat_id, "frameBase64": fb, "senderId": ctx.user.id, "type": "typing"
            }).to_string()));
        })
    })).await;

    registry.register(msg_type::CHAT_STOP_TYPING, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            let fb = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &frame.payload);
            ctx.kafka.as_ref().map(|k| k.produce("chat-events", &chat_id.to_string(), &serde_json::json!({
                "chatId": chat_id, "frameBase64": fb, "senderId": ctx.user.id, "type": "stop_typing"
            }).to_string()));
        })
    })).await;

    // ── Post / Feed ──
    registry.register(msg_type::POST_CREATE, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let text = data.get("text").and_then(|v| v.as_str()).unwrap_or("");
            let post_type = data.get("type").and_then(|v| v.as_str()).unwrap_or("text");
            let media = data.get("media").and_then(|v| v.as_str());
            match db::create_post(&ctx.conn_mgr.db, ctx.user.id, text, post_type, media).await {
                Ok(post) => ctx.respond_json(&frame, &serde_json::json!({"ok": true, "post": post})),
                Err(e) => ctx.respond_json(&frame, &serde_json::json!({"ok": false, "error": e.to_string()})),
            }
        })
    })).await;

    registry.register(msg_type::POST_GET, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let result = if data.get("type").and_then(|v| v.as_str()) == Some("recommended") {
                db::get_recommended_posts(&ctx.conn_mgr.db, ctx.user.id).await
            } else if let Some(uid) = data.get("userId").and_then(|v| v.as_i64()) {
                db::get_user_posts(&ctx.conn_mgr.db, uid).await.map(|v| v)
            } else {
                db::get_all_posts(&ctx.conn_mgr.db).await
            };
            match result {
                Ok(posts) => ctx.respond_json(&frame, &posts),
                Err(_) => ctx.respond_json(&frame, &serde_json::json!([])),
            }
        })
    })).await;

    registry.register(msg_type::POST_LIKE, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let post_id = data.get("postId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::like_post(&ctx.conn_mgr.db, ctx.user.id, post_id).await {
                Ok(_) => ctx.respond_json(&frame, &serde_json::json!({"ok": true})),
                Err(_) => ctx.respond_json(&frame, &serde_json::json!({"ok": false})),
            }
        })
    })).await;

    // ── Contacts ──
    registry.register(msg_type::CONTACT_GET, Arc::new(|ctx, frame| {
        Box::pin(async move {
            match db::get_contacts(&ctx.conn_mgr.db, ctx.user.id).await {
                Ok(contacts) => ctx.respond_json(&frame, &contacts),
                Err(_) => ctx.respond_json(&frame, &serde_json::json!([])),
            }
        })
    })).await;

    registry.register(msg_type::CONTACT_ADD, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let contact_id = data.get("contactId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::add_contact(&ctx.conn_mgr.db, ctx.user.id, contact_id).await {
                Ok(_) => ctx.respond_json(&frame, &serde_json::json!({"ok": true})),
                Err(e) => ctx.respond_json(&frame, &serde_json::json!({"ok": false, "error": e.to_string()})),
            }
        })
    })).await;

    registry.register(msg_type::CONTACT_SEARCH, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let query = data.get("query").and_then(|v| v.as_str()).unwrap_or("");
            match db::search_users(&ctx.conn_mgr.db, query).await {
                Ok(results) => ctx.respond_json(&frame, &results),
                Err(_) => ctx.respond_json(&frame, &serde_json::json!([])),
            }
        })
    })).await;

    // ── Live ──
    registry.register(msg_type::LIVE_START, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let title = data.get("title").and_then(|v| v.as_str()).unwrap_or("");
            match db::start_live(&ctx.conn_mgr.db, ctx.user.id, title).await {
                Ok(live) => ctx.respond_json(&frame, &serde_json::json!({"ok": true, "live": live})),
                Err(e) => ctx.respond_json(&frame, &serde_json::json!({"ok": false, "error": e.to_string()})),
            }
        })
    })).await;

    registry.register(msg_type::LIVE_END, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let live_id = data.get("liveId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::end_live(&ctx.conn_mgr.db, live_id).await {
                Ok(_) => ctx.respond_json(&frame, &serde_json::json!({"ok": true})),
                Err(_) => ctx.respond_json(&frame, &serde_json::json!({"ok": false})),
            }
        })
    })).await;

    registry.register(msg_type::LIVE_GET_ACTIVE, Arc::new(|ctx, frame| {
        Box::pin(async move {
            match db::get_active_lives(&ctx.conn_mgr.db).await {
                Ok(lives) => ctx.respond_json(&frame, &lives),
                Err(_) => ctx.respond_json(&frame, &serde_json::json!([])),
            }
        })
    })).await;

    // ── Notifications ──
    registry.register(msg_type::NOTIF_GET_LIST, Arc::new(|ctx, frame| {
        Box::pin(async move {
            match db::get_smart_notifications(&ctx.conn_mgr.db, ctx.user.id).await {
                Ok(notifs) => ctx.respond_json(&frame, &notifs),
                Err(_) => ctx.respond_json(&frame, &serde_json::json!([])),
            }
        })
    })).await;

    registry.register(msg_type::NOTIF_MARK_READ, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let notif_id = data.get("notificationId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::mark_notification_read(&ctx.conn_mgr.db, notif_id).await;
            ctx.respond_json(&frame, &serde_json::json!({"ok": true}));
        })
    })).await;

    // ── Profile ──
    registry.register(msg_type::PROFILE_UPDATE, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            match db::update_profile(&ctx.conn_mgr.db, ctx.user.id, &data).await {
                Ok(user) => ctx.respond_json(&frame, &serde_json::json!({"ok": true, "user": user})),
                Err(e) => ctx.respond_json(&frame, &serde_json::json!({"ok": false, "error": e.to_string()})),
            }
        })
    })).await;

    registry.register(msg_type::PROFILE_GET, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let user_id = data.get("userId").and_then(|v| v.as_i64()).unwrap_or(ctx.user.id);
            match db::get_user_by_id(&ctx.conn_mgr.db, user_id).await {
                Ok(Some(profile)) => ctx.respond_json(&frame, &profile),
                _ => ctx.respond_json(&frame, &serde_json::json!({})),
            }
        })
    })).await;

    // ── Vibe Balance ──
    registry.register(msg_type::VIBE_BALANCE_GET, Arc::new(|ctx, frame| {
        Box::pin(async move {
            match db::get_vibe_balance(&ctx.conn_mgr.db, ctx.user.id).await {
                Ok(balance) => ctx.respond_json(&frame, &balance),
                Err(_) => ctx.respond_json(&frame, &serde_json::json!({})),
            }
        })
    })).await;

    registry.register(msg_type::RECORD_INTERACTION, Arc::new(|ctx, frame| {
        Box::pin(async move {
            let data = json_val(&frame);
            let post_id = data.get("postId").and_then(|v| v.as_i64()).unwrap_or(0);
            let interaction_type = data.get("type").and_then(|v| v.as_str()).unwrap_or("view");
            let _ = db::record_interaction(&ctx.conn_mgr.db, ctx.user.id, post_id, interaction_type).await;
            ctx.respond_json(&frame, &serde_json::json!({"ok": true}));
        })
    })).await;

    info!(action = "handler_registration", "All handlers registered");
}
