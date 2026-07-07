use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use base64::Engine;
use serde_json::Value;
use socketioxide::extract::{AckSender, Data, SocketRef};
use socketioxide::SocketIo;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use crate::db;
use crate::format::WireFormat;
use crate::push::PushManager;
use crate::types::*;

pub struct AppState {
    pub db: deadpool_postgres::Pool,
    pub io: SocketIo,
    pub online_users: RwLock<HashSet<i64>>,
    pub socket_user_map: RwLock<HashMap<String, i64>>,
    pub user_socket_map: RwLock<HashMap<i64, Vec<String>>>,
    pub socket_formats: RwLock<HashMap<String, WireFormat>>,
    pub socket_tokens: RwLock<HashMap<String, String>>,
    pub push: PushManager,
    pub storage_url: String,
}

pub fn register_handlers(socket: SocketRef, state: Arc<AppState>, auth: Value) {
    let socket_id = socket.id.to_string();
    let token = auth.get("token").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let format = WireFormat::from_str(auth.get("format").and_then(|v| v.as_str()).unwrap_or("json"));
    let st = state.clone();
    let sid = socket_id.clone();
    tokio::spawn(async move {
        st.socket_formats.write().await.insert(sid, format);
    });

    // Store token for terminate_other_sessions
    let token_clone = token.clone();
    let st_tokens = state.clone();
    let sid_tokens = socket_id.clone();
    tokio::spawn(async move {
        st_tokens.socket_tokens.write().await.insert(sid_tokens, token_clone);
    });

    // Try to authenticate on connect
    if !token.is_empty() {
        let state = state.clone();
        let sid = socket_id.clone();
        let sock = socket.clone();
        tokio::spawn(async move {
            if let Ok(Some(user)) = db::get_session(&state.db, &token).await {
                info!(user_id = user.id, action = "connect", "Usuario conectado");
                sock.join(format!("user:{}", user.id));
                state.online_users.write().await.insert(user.id);
                state.socket_user_map.write().await.insert(sid.clone(), user.id);
                state
                    .user_socket_map
                    .write()
                    .await
                    .entry(user.id)
                    .or_default()
                    .push(sid);

                // Notify contacts
                if let Ok(contacts) = db::get_contacts(&state.db, user.id).await {
                    for c in &contacts {
                        emit_to_user(
                            &state,
                            c.id,
                            "contact_status",
                            &serde_json::json!({"userId": user.id, "online": true}),
                        )
                        .await;
                    }
                }
            }
        });
    }

    // --- AUTH EVENTS ---

    socket.on(
        "send_code",
        async |socket: SocketRef,
         Data(data): Data<SendCodePayload>,
         ack: AckSender| {
            let state = get_state();
            let phone = data.phone.trim().to_string();
            if phone.len() < 10 {
                let _ = ack.send(&serde_json::json!({"ok": false, "error": "Teléfono inválido"}));
                return;
            }
            match db::send_code(&state.db, &phone).await {
                Ok(code) => {
                    info!(action = "send_code", phone = %phone, "Código SMS enviado");
                    let _ = ack.send(&serde_json::json!({"ok": true, "code": code}));
                }
                Err(e) => {
                    error!(action = "send_code", phone = %phone, err = %e, "Error enviando código");
                    let _ = ack.send(&serde_json::json!({"ok": false, "error": "Error interno"}));
                }
            }
        },
    );

    socket.on(
        "verify_code",
        async |socket: SocketRef,
         Data(data): Data<VerifyCodePayload>,
         ack: AckSender| {
            let state = get_state();
            let country_code = data.country_code.as_deref().unwrap_or("");
            match db::verify_code(&state.db, &data.phone, &data.code).await {
                Ok(true) => {
                    match db::find_or_create_user(
                        &state.db,
                        &data.phone,
                        &data.username,
                        &data.display_name,
                        country_code,
                    )
                    .await
                    {
                        Ok((user, is_new)) => {
                            let device_id = socket.id.to_string();
                            if is_new {
                                info!(user_id = user.id, action = "register", "Nuevo usuario registrado");
                            } else {
                                info!(user_id = user.id, action = "verify_code", "Usuario verificado");
                            }
                            match db::create_session(&state.db, user.id, &device_id, "").await {
                                Ok(token) => {
                                    let _ = ack.send(&serde_json::json!({
                                        "ok": true,
                                        "token": token,
                                        "user": user,
                                        "isNew": is_new,
                                    }));
                                }
                                Err(e) => {
                                    error!(user_id = user.id, err = %e, action = "create_session", "Error creando sesión");
                                    let _ = ack.send(&serde_json::json!({"ok": false, "error": "Error al crear sesión"}));
                                }
                            }
                        }
                        Err(e) => {
                            warn!("find_or_create_user error: {}", e);
                            let _ = ack.send(&serde_json::json!({"ok": false, "error": "Error al crear usuario"}));
                        }
                    }
                }
                Ok(false) => {
                    let _ = ack.send(&serde_json::json!({"ok": false, "error": "Código incorrecto o expirado"}));
                }
                Err(e) => {
                    warn!("verify_code error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false, "error": "Error interno"}));
                }
            }
        },
    );

    socket.on(
        "restore_session",
        async |socket: SocketRef,
         Data(data): Data<RestoreSessionPayload>,
         ack: AckSender| {
            let state = get_state();
            match db::get_session(&state.db, &data.token).await {
                Ok(Some(user)) => {
                    let _ = ack.send(&serde_json::json!({"ok": true, "user": user}));
                }
                _ => {
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    // --- CONTACTS ---

    socket.on(
        "get_contacts",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            if user_id == 0 {
                let _ = ack.send(&serde_json::json!([]));
                return;
            }
            match db::get_contacts(&state.db, user_id).await {
                Ok(contacts) => {
                    let online = state.online_users.read().await;
                    let result: Vec<Value> = contacts
                        .into_iter()
                        .map(|mut c| {
                            c.online = Some(online.contains(&c.id));
                            serde_json::to_value(c).unwrap_or_default()
                        })
                        .collect();
                    let _ = ack.send(&result);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "search_users",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let query = data.get("query").and_then(|v| v.as_str()).unwrap_or("");
            if let Ok(users) = db::search_users(&state.db, query).await {
                let filtered: Vec<User> = users.into_iter().filter(|u| u.id != user_id).collect();
                let _ = ack.send(&filtered);
            } else {
                let _ = ack.send(&serde_json::json!([]));
            }
        },
    );

    socket.on(
        "add_contact",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let contact_id = data.get("contactId").and_then(|v| v.as_i64()).unwrap_or(0);
            let ok = db::add_contact(&state.db, user_id, contact_id)
                .await
                .unwrap_or(false);
            if ok {
                emit_to_user(&state, contact_id, "contact_added", &get_user_by_id(&state, user_id).await).await;
            }
            let _ = ack.send(&serde_json::json!({"ok": ok}));
        },
    );

    // --- CHATS ---

    socket.on(
        "get_chats",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            if let Ok(mut chats) = db::get_user_chats(&state.db, user_id).await {
                for chat in &mut chats {
                    if let Ok(members) = db::get_chat_members(&state.db, chat.id).await {
                        let online = state.online_users.read().await;
                        let members_with_online: Vec<User> = members
                            .into_iter()
                            .map(|mut m| {
                                m.online = Some(online.contains(&m.id));
                                m
                            })
                            .collect();
                        chat.members = Some(members_with_online);
                    }
                }
                let _ = ack.send(&chats);
            } else {
                let _ = ack.send(&serde_json::json!([]));
            }
        },
    );

    socket.on(
        "get_or_create_private_chat",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let contact_id = data.get("contactId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::create_private_chat(&state.db, user_id, contact_id).await {
                Ok(chat_id) => {
                    let members =
                        db::get_chat_members(&state.db, chat_id).await.unwrap_or_default();
                    let _ = ack.send(&serde_json::json!({"chatId": chat_id, "members": members}));
                    // Notify the other user
                    if let Ok(chats) = db::get_user_chats(&state.db, contact_id).await {
                        if let Some(chat) = chats.iter().find(|c| c.id == chat_id) {
                            emit_to_user(&state, contact_id, "new_chat", chat).await;
                        }
                    }
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!({"chatId": 0}));
                }
            }
        },
    );

    socket.on(
        "create_group",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let name = data.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let member_ids: Vec<i64> = data
                .get("memberIds")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_i64()).collect())
                .unwrap_or_default();
            if name.is_empty() || member_ids.is_empty() {
                let _ = ack.send(&serde_json::json!({"ok": false, "error": "Nombre y al menos 1 miembro"}));
                return;
            }
            match db::create_group(&state.db, name, user_id, &member_ids).await {
                Ok(chat_id) => {
                    let members =
                        db::get_chat_members(&state.db, chat_id).await.unwrap_or_default();
                    let _ = ack.send(&serde_json::json!({"ok": true, "chatId": chat_id, "members": members}));
                    for m in &members {
                        if m.id != user_id {
                            emit_to_user(
                                &state,
                                m.id,
                                "new_chat",
                                &serde_json::json!({"chatId": chat_id, "type": "group", "members": members}),
                            )
                            .await;
                        }
                    }
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!({"ok": false, "error": "Error al crear grupo"}));
                }
            }
        },
    );

    socket.on(
        "get_messages",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            let cursor = data.get("cursor").and_then(|v| v.as_str()).map(|s| s.to_string());
            match db::get_messages(&state.db, chat_id, 50, cursor).await {
                Ok(msgs) => {
                    let _ = ack.send(&msgs);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "send_message",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            let text = data.get("text").and_then(|v| v.as_str()).unwrap_or("");
            let msg_type = data.get("type").and_then(|v| v.as_str()).unwrap_or("text");
            if text.is_empty() && msg_type != "image" {
                return;
            }
            let reply_to_id = data.get("replyToId").and_then(|v| v.as_i64());
            let forwarded = data.get("forwarded").and_then(|v| v.as_i64());
            match db::add_message(&state.db, chat_id, user_id, text, msg_type, reply_to_id, forwarded).await {
                Ok(msg_id) => {
                    info!(user_id = user_id, chat_id = chat_id, msg_id = msg_id, text_len = text.len(), action = "send_message", "Mensaje enviado");
                    track_activity(&state, user_id, "messaging").await;
                    let user = get_user_by_id(&state, user_id).await;
                    let msg = serde_json::json!({
                        "id": msg_id,
                        "chat_id": chat_id,
                        "sender_id": user_id,
                        "sender_name": user.display_name,
                        "sender_avatar": user.avatar,
                        "text": text,
                        "type": msg_type,
                        "created_at": chrono::Utc::now().to_rfc3339(),
                        "reply_to_id": reply_to_id,
                        "forwarded": forwarded,
                    });
                    let _ = socket.emit("new_message", &msg);
                    let _ = socket
                        .to(format!("chat:{}", chat_id))
                        .emit("new_message", &msg);
                    // Send push notification to other chat members
                    if let Ok(members) = db::get_chat_members(&state.db, chat_id).await {
                        for m in members {
                            if m.id != user_id {
                                state.push.send_push(m.id, &serde_json::json!({
                                    "type": "new_message",
                                    "title": user.display_name,
                                    "body": text,
                                    "chatId": chat_id,
                                })).await;
                                if let Ok(notif) = db::add_smart_notification(&state.db, m.id, "new_message", &format!("Nuevo mensaje de {}", user.display_name), "normal").await {
                                    emit_to_user(&state, m.id, "new_notification", &notif).await;
                                }
                            }
                        }
                    }
                    let _ = ack.send(&msg);
                }
                Err(e) => {
                    error!(user_id = user_id, chat_id = chat_id, err = %e, action = "send_message", "Error enviando mensaje");
                }
            }
        },
    );

    socket.on(
        "mark_read",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         _ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let message_id = data.get("messageId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::mark_read(&state.db, message_id, user_id).await;
        },
    );

    socket.on(
        "typing",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         _ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            let user = get_user_by_id(&state, user_id).await;
            let _ = socket
                .to(format!("chat:{}", chat_id))
                .emit("typing", &serde_json::json!({"chatId": chat_id, "userId": user_id, "name": user.display_name}));
        },
    );

    socket.on(
        "stop_typing",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         _ack: AckSender| {
            let state = get_state();
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            let user_id = get_user_id(&state, &socket).await;
            let _ = socket
                .to(format!("chat:{}", chat_id))
                .emit("stop_typing", &serde_json::json!({"chatId": chat_id, "userId": user_id}));
        },
    );

    socket.on(
        "search_messages",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            let query = data.get("query").and_then(|v| v.as_str()).unwrap_or("");
            if query.is_empty() {
                let _ = ack.send(&serde_json::json!([]));
                return;
            }
            match db::search_messages(&state.db, chat_id, query, 50).await {
                Ok(msgs) => {
                    let _ = ack.send(&msgs);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "delete_message",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let message_id = data.get("messageId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::delete_message(&state.db, message_id, user_id).await {
                Ok(ok) => {
                    let _ = ack.send(&serde_json::json!({"ok": ok}));
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    // --- POSTS ---

    socket.on(
        "get_posts",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let filter = data.get("filter").and_then(|v| v.as_str()).unwrap_or("all");
            let cursor = data.get("cursor").and_then(|v| v.as_str()).map(|s| s.to_string());
            let limit = data.get("limit").and_then(|v| v.as_i64()).unwrap_or(20);
            match db::get_posts(&state.db, user_id, filter, cursor, limit).await {
                Ok(posts) => {
                    let _ = ack.send(&posts);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "create_post",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let text = data.get("text").and_then(|v| v.as_str()).unwrap_or("");
            let media = data.get("media").and_then(|v| v.as_str()).unwrap_or("");
            let media_type = data.get("mediaType").and_then(|v| v.as_str()).unwrap_or("text");
            if text.is_empty() && media.is_empty() {
                let _ = ack.send(&serde_json::json!({"ok": false}));
                return;
            }
            match db::create_post(&state.db, user_id, text, media, media_type).await {
                Ok(mut post) => {
                    let user = get_user_by_id(&state, user_id).await;
                    post.display_name = Some(user.display_name.clone());
                    post.avatar = Some(user.avatar.clone());
                    info!(user_id = user_id, post_id = post.id, has_media = !media.is_empty(), action = "create_post", "Post creado");
                    track_activity(&state, user_id, "feed").await;
                    let _ = ack.send(&serde_json::json!({"ok": true, "post": post}));
                    if let Ok(contacts) = db::get_contacts(&state.db, user_id).await {
                        let event = serde_json::json!({
                            "id": post.id,
                            "user_id": user_id,
                            "text": post.text,
                            "media": post.media,
                            "media_type": post.media_type,
                            "created_at": post.created_at,
                            "display_name": user.display_name,
                            "avatar": user.avatar,
                        });
                        for c in &contacts {
                            emit_to_user(&state, c.id, "new_post", &event).await;
                        }
                    }
                }
                Err(e) => {
                    warn!("create_post error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "view_post",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let post_id = data.get("postId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::view_post(&state.db, post_id, user_id).await;
            match db::get_post_views(&state.db, post_id).await {
                Ok(views) => {
                    let _ = ack.send(&views);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "like_post",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let post_id = data.get("postId").and_then(|v| v.as_i64()).unwrap_or(0);
            let liked = db::like_post(&state.db, post_id, user_id)
                .await
                .unwrap_or(false);
            let _ = ack.send(&serde_json::json!({"ok": liked}));
            if liked {
                let _ = socket.within(format!("post:{}", post_id)).emit("post_liked", &serde_json::json!({"postId": post_id, "userId": user_id}));
            }
        },
    );

    socket.on(
        "unlike_post",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let post_id = data.get("postId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::unlike_post(&state.db, post_id, user_id).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
            let _ = socket.within(format!("post:{}", post_id)).emit("post_unliked", &serde_json::json!({"postId": post_id, "userId": user_id}));
        },
    );

    socket.on(
        "has_user_liked_post",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let post_id = data.get("postId").and_then(|v| v.as_i64()).unwrap_or(0);
            let liked = db::has_user_liked_post(&state.db, post_id, user_id)
                .await
                .unwrap_or(false);
            let _ = ack.send(&serde_json::json!({"liked": liked}));
        },
    );

    socket.on(
        "add_post_comment",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let post_id = data.get("postId").and_then(|v| v.as_i64()).unwrap_or(0);
            let text = data.get("text").and_then(|v| v.as_str()).unwrap_or("");
            let parent_id = data.get("parentId").and_then(|v| v.as_i64());
            if text.is_empty() {
                let _ = ack.send(&serde_json::json!({"ok": false}));
                return;
            }
            match db::add_post_comment(&state.db, post_id, user_id, text, parent_id).await {
                Ok(mut comment) => {
                    let user = get_user_by_id(&state, user_id).await;
                    comment.display_name = Some(user.display_name.clone());
                    comment.avatar = Some(user.avatar.clone());
                    comment.username = Some(user.username.clone());
                    let _ = ack.send(&serde_json::json!({"ok": true, "comment": comment}));
                    let full = serde_json::json!({
                        "postId": post_id,
                        "comment": {
                            "id": comment.id,
                            "post_id": comment.post_id,
                            "user_id": comment.user_id,
                            "text": comment.text,
                            "parent_id": comment.parent_id,
                            "created_at": comment.created_at,
                            "display_name": user.display_name,
                            "avatar": user.avatar,
                            "username": user.username,
                        }
                    });
                    let _ = socket.within(format!("post:{}", post_id)).emit("new_post_comment", &full);
                }
                Err(e) => {
                    warn!("add_post_comment error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "get_post_comments",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let post_id = data.get("postId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::get_post_comments(&state.db, post_id).await {
                Ok(comments) => {
                    let _ = ack.send(&comments);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    // --- PROFILE ---

    // --- PROFILE ---

    socket.on("update_profile", async |socket: SocketRef, Data(data): Data<Value>, ack: AckSender| {
        let state = get_state();
        let user_id = get_user_id(&state, &socket).await;
        let _ = db::update_profile(&state.db, user_id, &data).await;
        let _ = ack.send(&serde_json::json!({"ok": true}));
    });

    // --- CALLS ---

    socket.on(
        "get_calls",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            match db::get_user_calls(&state.db, user_id, 30).await {
                Ok(calls) => {
                    let _ = ack.send(&calls);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "log_call",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let callee_id = data.get("calleeId").and_then(|v| v.as_i64()).unwrap_or(0);
            let call_type = data.get("type").and_then(|v| v.as_str()).unwrap_or("audio");
            let status = data.get("status").and_then(|v| v.as_str()).unwrap_or("missed");
            let duration = data.get("duration").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::add_call(&state.db, user_id, callee_id, call_type, status, duration as i32).await {
                Ok(id) => {
                    let _ = ack.send(&serde_json::json!({"id": id}));
                    if status == "missed" {
                        let caller = get_user_by_id(&state, user_id).await;
                        if let Ok(notif) = db::add_smart_notification(&state.db, callee_id, "missed_call", &format!("Llamada perdida de {}", caller.display_name), "normal").await {
                            emit_to_user(&state, callee_id, "new_notification", &notif).await;
                        }
                    }
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!({"id": 0}));
                }
            }
        },
    );

    // --- TWO-STEP ---

    socket.on(
        "set_two_step",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let password = data.get("password").and_then(|v| v.as_str()).unwrap_or("");
            let hint = data.get("hint").and_then(|v| v.as_str()).unwrap_or("");
            if password.len() < 4 {
                let _ = ack.send(&serde_json::json!({"ok": false, "error": "La contraseña debe tener al menos 4 caracteres"}));
                return;
            }
            let _ = db::set_two_step_password(&state.db, user_id, password, hint).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    socket.on(
        "verify_two_step",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let password = data.get("password").and_then(|v| v.as_str()).unwrap_or("");
            let ok = db::verify_two_step_password(&state.db, user_id, password)
                .await
                .unwrap_or(true);
            let _ = ack.send(&serde_json::json!({"ok": ok}));
        },
    );

    socket.on(
        "disable_two_step",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let password = data.get("password").and_then(|v| v.as_str()).unwrap_or("");
            let valid = db::verify_two_step_password(&state.db, user_id, password)
                .await
                .unwrap_or(false);
            if !valid {
                let _ = ack.send(&serde_json::json!({"ok": false, "error": "Contraseña incorrecta"}));
                return;
            }
            let _ = db::disable_two_step(&state.db, user_id).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    socket.on(
        "get_two_step_status",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            match db::get_two_step_status(&state.db, user_id).await {
                Ok(status) => {
                    let _ = ack.send(&status);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!({"enabled": 0, "hint": ""}));
                }
            }
        },
    );

    // --- BLOCKED USERS ---

    socket.on(
        "block_user",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let blocked_id = data.get("userId").and_then(|v| v.as_i64()).unwrap_or(0);
            let ok = db::block_user(&state.db, user_id, blocked_id)
                .await
                .unwrap_or(false);
            let _ = ack.send(&serde_json::json!({"ok": ok}));
        },
    );

    socket.on(
        "unblock_user",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let blocked_id = data.get("userId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::unblock_user(&state.db, user_id, blocked_id).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    socket.on(
        "get_blocked_users",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            match db::get_blocked_users(&state.db, user_id).await {
                Ok(users) => {
                    let _ = ack.send(&users);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    // --- SESSIONS ---

    socket.on(
        "get_sessions",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            match db::get_user_sessions(&state.db, user_id).await {
                Ok(sessions) => {
                    let _ = ack.send(&sessions);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "terminate_session",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let session_id = data.get("sessionId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::terminate_session(&state.db, session_id, user_id).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    socket.on(
        "terminate_other_sessions",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let token = state.socket_tokens.read().await.get(&socket.id.to_string()).cloned().unwrap_or_default();
            let _ = db::terminate_other_sessions(&state.db, &token, user_id).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    // --- PRIVACY ---

    socket.on(
        "get_privacy_settings",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            match db::get_privacy_settings(&state.db, user_id).await {
                Ok(settings) => {
                    let _ = ack.send(&settings);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!({
                        "last_seen": "everyone", "profile_photo": "everyone", "bio": "everyone",
                        "status": "contacts", "calls": "everyone", "read_receipts": 1, "message_history": 1
                    }));
                }
            }
        },
    );

    socket.on("update_privacy_settings", async |socket: SocketRef, Data(data): Data<Value>, ack: AckSender| {
        let state = get_state();
        let user_id = get_user_id(&state, &socket).await;
        let _ = db::update_privacy_settings(&state.db, user_id, &data).await;
        let _ = ack.send(&serde_json::json!({"ok": true}));
    });

    // --- DELETE ACCOUNT ---

    socket.on(
        "get_account_deletion",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            match db::get_account_deletion(&state.db, user_id).await {
                Ok(delete_at) => {
                    let _ = ack.send(&serde_json::json!({"delete_at": delete_at}));
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!({"delete_at": null}));
                }
            }
        },
    );

    socket.on(
        "schedule_account_deletion",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let days = data.get("days").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::schedule_account_deletion(&state.db, user_id, days as i32).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    socket.on(
        "cancel_account_deletion",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let _ = db::cancel_account_deletion(&state.db, user_id).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    // --- VIDEOS ---

    socket.on(
        "create_video",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let video_url = data.get("videoUrl").and_then(|v| v.as_str()).unwrap_or("");
            if video_url.is_empty() {
                let _ = ack.send(&serde_json::json!({"ok": false}));
                return;
            }
            let thumbnail = data.get("thumbnail").and_then(|v| v.as_str()).unwrap_or("");
            let caption = data.get("caption").and_then(|v| v.as_str()).unwrap_or("");
            match db::create_video(&state.db, user_id, video_url, thumbnail, caption).await {
                Ok(mut video) => {
                    let user = get_user_by_id(&state, user_id).await;
                    video.display_name = Some(user.display_name);
                    video.avatar = Some(user.avatar);
                    video.username = Some(user.username);
                    info!(user_id = user_id, video_id = video.id, action = "create_video", "Video subido");
                    let _ = ack.send(&serde_json::json!({"ok": true, "video": video}));
                }
                Err(e) => {
                    warn!("create_video error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "get_videos",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let cursor = data.get("cursor").and_then(|v| v.as_str()).map(|s| s.to_string());
            let limit = data.get("limit").and_then(|v| v.as_i64()).unwrap_or(10);
            match db::get_videos(&state.db, cursor, limit).await {
                Ok(videos) => {
                    let _ = ack.send(&videos);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "like_video",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let video_id = data.get("videoId").and_then(|v| v.as_i64()).unwrap_or(0);
            let liked = db::like_video(&state.db, video_id, user_id)
                .await
                .unwrap_or(false);
            let _ = ack.send(&serde_json::json!({"ok": liked}));
        },
    );

    socket.on(
        "unlike_video",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let video_id = data.get("videoId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::unlike_video(&state.db, video_id, user_id).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    socket.on(
        "get_video_likes",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let video_id = data.get("videoId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::get_video_likes(&state.db, video_id).await {
                Ok(likes) => {
                    let _ = ack.send(&likes);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "add_video_comment",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let video_id = data.get("videoId").and_then(|v| v.as_i64()).unwrap_or(0);
            let text = data.get("text").and_then(|v| v.as_str()).unwrap_or("");
            if text.is_empty() {
                let _ = ack.send(&serde_json::json!({"ok": false}));
                return;
            }
            match db::add_video_comment(&state.db, video_id, user_id, text).await {
                Ok(mut comment) => {
                    let user = get_user_by_id(&state, user_id).await;
                    comment.display_name = Some(user.display_name);
                    comment.avatar = Some(user.avatar);
                    comment.username = Some(user.username);
                    let _ = ack.send(&serde_json::json!({"ok": true, "comment": comment}));
                }
                Err(e) => {
                    warn!("add_video_comment error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "get_video_comments",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let video_id = data.get("videoId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::get_video_comments(&state.db, video_id).await {
                Ok(comments) => {
                    let _ = ack.send(&comments);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "has_user_liked",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let video_id = data.get("videoId").and_then(|v| v.as_i64()).unwrap_or(0);
            let liked = db::has_user_liked_video(&state.db, video_id, user_id)
                .await
                .unwrap_or(false);
            let _ = ack.send(&serde_json::json!({"liked": liked}));
        },
    );

    // --- LIVES ---

    socket.on(
        "start_live",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let title = data.get("title").and_then(|v| v.as_str()).unwrap_or("");
            match db::start_live(&state.db, user_id, title).await {
                Ok(mut live) => {
                    let user = get_user_by_id(&state, user_id).await;
                    live.display_name = Some(user.display_name);
                    live.avatar = Some(user.avatar);
                    live.username = Some(user.username);
                    info!(user_id = user_id, live_id = live.id, action = "start_live", "Live iniciado");
                    track_activity(&state, user_id, "live").await;
                    let _ = ack.send(&serde_json::json!({"ok": true, "live": live}));
                }
                Err(e) => {
                    error!(user_id = user_id, err = %e, action = "start_live", "Error iniciando live");
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "end_live",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let live_id = data.get("liveId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::end_live(&state.db, live_id, user_id).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    socket.on(
        "get_active_lives",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            match db::get_active_lives(&state.db).await {
                Ok(lives) => {
                    let _ = ack.send(&lives);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    // --- LIVE COMMENTS & REACTIONS ---

    socket.on(
        "add_live_comment",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let live_id = data.get("liveId").and_then(|v| v.as_i64()).unwrap_or(0);
            let text = data.get("text").and_then(|v| v.as_str()).unwrap_or("");
            if text.is_empty() {
                let _ = ack.send(&serde_json::json!({"ok": false}));
                return;
            }
            match db::add_live_comment(&state.db, live_id, user_id, text).await {
                Ok(mut comment) => {
                    let user = get_user_by_id(&state, user_id).await;
                    comment.display_name = Some(user.display_name);
                    comment.avatar = Some(user.avatar);
                    comment.username = Some(user.username);
                    let _ = socket.within(format!("live:{}", live_id)).emit("new_live_comment", &serde_json::json!({"liveId": live_id, "comment": comment}));
                    let _ = ack.send(&serde_json::json!({"ok": true, "comment": comment}));
                    info!(user_id = user_id, live_id = live_id, action = "add_live_comment", "Comentario en live");
                }
                Err(e) => {
                    warn!("add_live_comment error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "get_live_comments",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let live_id = data.get("liveId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::get_live_comments(&state.db, live_id).await {
                Ok(comments) => { let _ = ack.send(&comments); }
                Err(_) => { let _ = ack.send(&serde_json::json!([])); }
            }
        },
    );

    socket.on(
        "add_live_reaction",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let live_id = data.get("liveId").and_then(|v| v.as_i64()).unwrap_or(0);
            let reaction = data.get("reaction").and_then(|v| v.as_str()).unwrap_or("");
            if reaction.is_empty() {
                let _ = ack.send(&serde_json::json!({"ok": false}));
                return;
            }
            match db::add_live_reaction(&state.db, live_id, user_id, reaction).await {
                Ok(Some(mut react)) => {
                    let user = get_user_by_id(&state, user_id).await;
                    react.display_name = Some(user.display_name);
                    react.avatar = Some(user.avatar);
                    react.username = Some(user.username);
                    let _ = socket.within(format!("live:{}", live_id)).emit("new_live_reaction", &serde_json::json!({"liveId": live_id, "reaction": react}));
                    let _ = ack.send(&serde_json::json!({"ok": true, "reaction": react}));
                    info!(user_id = user_id, live_id = live_id, reaction = %reaction, action = "add_live_reaction", "Reacción en live");
                }
                Ok(None) => { let _ = ack.send(&serde_json::json!({"ok": true, "reaction": null})); }
                Err(e) => {
                    warn!("add_live_reaction error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "get_live_reactions",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let live_id = data.get("liveId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::get_live_reactions(&state.db, live_id).await {
                Ok(reactions) => { let _ = ack.send(&reactions); }
                Err(_) => { let _ = ack.send(&serde_json::json!([])); }
            }
        },
    );

    // --- LIVE STARS / GIFTS ---

    socket.on(
        "send_live_gift",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let live_id = data.get("liveId").and_then(|v| v.as_i64()).unwrap_or(0);
            let recipient_id = data.get("recipientId").and_then(|v| v.as_i64()).unwrap_or(0);
            let stars = data.get("stars").and_then(|v| v.as_i64()).unwrap_or(0);
            let message = data.get("message").and_then(|v| v.as_str()).unwrap_or("");
            if live_id == 0 || recipient_id == 0 || stars <= 0 {
                let _ = ack.send(&serde_json::json!({"ok": false, "error": "Faltan datos"}));
                return;
            }
            match db::send_live_gift(&state.db, live_id, user_id, recipient_id, stars as i32, message).await {
                Ok(Some(mut gift)) => {
                    let user = get_user_by_id(&state, user_id).await;
                    gift.sender_name = Some(user.display_name);
                    gift.sender_avatar = Some(user.avatar);
                    gift.sender_username = Some(user.username);
                    let _ = socket.within(format!("live:{}", live_id)).emit("new_live_gift", &serde_json::json!({"liveId": live_id, "gift": gift}));
                    let _ = ack.send(&serde_json::json!({"ok": true, "gift": gift}));
                    info!(user_id = user_id, live_id = live_id, stars = stars, action = "send_live_gift", "Estrella enviada en live");
                }
                Ok(None) => {
                    let _ = ack.send(&serde_json::json!({"ok": false, "error": "Estrellas insuficientes"}));
                }
                Err(e) => {
                    warn!("send_live_gift error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false, "error": "Error interno"}));
                }
            }
        },
    );

    socket.on(
        "get_live_gifts",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let live_id = data.get("liveId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::get_live_gifts(&state.db, live_id).await {
                Ok(gifts) => { let _ = ack.send(&gifts); }
                Err(_) => { let _ = ack.send(&serde_json::json!([])); }
            }
        },
    );

    socket.on(
        "get_user_stars",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            match db::get_user_stars(&state.db, user_id).await {
                Ok(stars) => { let _ = ack.send(&serde_json::json!({"stars": stars})); }
                Err(_) => { let _ = ack.send(&serde_json::json!({"stars": 0})); }
            }
        },
    );

    // --- CHAT ROOMS ---

    socket.on(
        "join_chat",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         _ack: AckSender| {
            if let Some(chat_id) = data.get("chatId").and_then(|v| v.as_i64()) {
                let _ = socket.join(format!("chat:{}", chat_id));
            }
        },
    );

    socket.on(
        "leave_chat",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         _ack: AckSender| {
            if let Some(chat_id) = data.get("chatId").and_then(|v| v.as_i64()) {
                let _ = socket.leave(format!("chat:{}", chat_id));
            }
        },
    );

    // --- LIVE ROOMS ---

    socket.on(
        "join_live",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         _ack: AckSender| {
            if let Some(live_id) = data.get("liveId").and_then(|v| v.as_i64()) {
                let _ = socket.join(format!("live:{}", live_id));
            }
        },
    );

    socket.on(
        "leave_live",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         _ack: AckSender| {
            if let Some(live_id) = data.get("liveId").and_then(|v| v.as_i64()) {
                let _ = socket.leave(format!("live:{}", live_id));
            }
        },
    );

    // --- POST ROOMS ---

    socket.on(
        "join_post",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         _ack: AckSender| {
            if let Some(post_id) = data.get("postId").and_then(|v| v.as_i64()) {
                let _ = socket.join(format!("post:{}", post_id));
            }
        },
    );

    socket.on(
        "leave_post",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         _ack: AckSender| {
            if let Some(post_id) = data.get("postId").and_then(|v| v.as_i64()) {
                let _ = socket.leave(format!("post:{}", post_id));
            }
        },
    );

    // --- CHANNELS ---

    socket.on(
        "get_channels",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            match db::get_channels(&state.db).await {
                Ok(channels) => {
                    let _ = ack.send(&channels);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "create_channel",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let name = data.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let description = data.get("description").and_then(|v| v.as_str()).unwrap_or("");
            let avatar = data.get("avatar").and_then(|v| v.as_str()).unwrap_or("");
            if name.is_empty() {
                let _ = ack.send(&serde_json::json!({"ok": false, "error": "Name required"}));
                return;
            }
            match db::create_channel(&state.db, name, description, avatar, user_id).await {
                Ok(channel) => {
                    let _ = ack.send(&serde_json::json!({"ok": true, "channel": channel}));
                }
                Err(e) => {
                    warn!("create_channel error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "subscribe_channel",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let channel_id = data.get("channelId").and_then(|v| v.as_i64()).unwrap_or(0);
            let ok = db::subscribe_channel(&state.db, user_id, channel_id).await.unwrap_or(false);
            if ok {
                if let Ok(channels) = db::get_channels(&state.db).await {
                    if let Some(channel) = channels.iter().find(|c| c.id == channel_id) {
                        if channel.owner_id != user_id {
                            let user = get_user_by_id(&state, user_id).await;
                            if let Ok(notif) = db::add_smart_notification(&state.db, channel.owner_id, "channel_subscribe", &format!("{} se suscribió a {}", user.display_name, channel.name), "normal").await {
                                emit_to_user(&state, channel.owner_id, "new_notification", &notif).await;
                            }
                        }
                    }
                }
            }
            let _ = ack.send(&serde_json::json!({"ok": ok}));
        },
    );

    socket.on(
        "get_subscribed_channels",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            match db::get_subscribed_channels(&state.db, user_id).await {
                Ok(ids) => {
                    let _ = ack.send(&ids);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "get_channel_posts",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let channel_id = data.get("channelId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::get_channel_posts(&state.db, channel_id).await {
                Ok(posts) => {
                    let _ = ack.send(&posts);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "create_channel_post",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let channel_id = data.get("channelId").and_then(|v| v.as_i64()).unwrap_or(0);
            let text = data.get("text").and_then(|v| v.as_str()).unwrap_or("");
            let media = data.get("media").and_then(|v| v.as_str()).unwrap_or("");
            let media_type = data.get("mediaType").and_then(|v| v.as_str()).unwrap_or("text");
            match db::create_channel_post(&state.db, channel_id, user_id, text, media, media_type).await {
                Ok(mut post) => {
                    let user = get_user_by_id(&state, user_id).await;
                    post.display_name = Some(user.display_name);
                    post.avatar = Some(user.avatar);
                    let _ = ack.send(&serde_json::json!({"ok": true, "post": post}));
                    // Notify subscribers
                    if let Ok(sub_ids) = db::get_channel_subscribers_ids(&state.db, channel_id).await {
                        for sid in sub_ids {
                            emit_to_user(&state, sid, "new_channel_post", &post).await;
                        }
                    }
                }
                Err(e) => {
                    warn!("create_channel_post error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "get_channel_subscribers",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let channel_id = data.get("channelId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::get_channel_subscribers(&state.db, channel_id).await {
                Ok(users) => {
                    let _ = ack.send(&users);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    // --- COMMUNITIES ---

    socket.on(
        "get_communities",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            match db::get_communities(&state.db).await {
                Ok(communities) => {
                    let _ = ack.send(&communities);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "create_community",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let name = data.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let description = data.get("description").and_then(|v| v.as_str()).unwrap_or("");
            let avatar = data.get("avatar").and_then(|v| v.as_str()).unwrap_or("");
            if name.is_empty() {
                let _ = ack.send(&serde_json::json!({"ok": false, "error": "Name required"}));
                return;
            }
            match db::create_community(&state.db, name, description, avatar, user_id).await {
                Ok(community) => {
                    let _ = ack.send(&serde_json::json!({"ok": true, "community": community}));
                }
                Err(e) => {
                    warn!("create_community error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "join_community",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let community_id = data.get("communityId").and_then(|v| v.as_i64()).unwrap_or(0);
            let ok = db::join_community(&state.db, user_id, community_id).await.unwrap_or(false);
            if ok {
                if let Ok(communities) = db::get_communities(&state.db).await {
                    if let Some(community) = communities.iter().find(|c| c.id == community_id) {
                        if community.owner_id != user_id {
                            let user = get_user_by_id(&state, user_id).await;
                            if let Ok(notif) = db::add_smart_notification(&state.db, community.owner_id, "community_join", &format!("{} se unió a {}", user.display_name, community.name), "normal").await {
                                emit_to_user(&state, community.owner_id, "new_notification", &notif).await;
                            }
                        }
                    }
                }
            }
            let _ = ack.send(&serde_json::json!({"ok": ok}));
        },
    );

    socket.on(
        "get_joined_communities",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            match db::get_joined_communities(&state.db, user_id).await {
                Ok(ids) => {
                    let _ = ack.send(&ids);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    // --- POLLS ---

    socket.on(
        "create_poll",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            let question = data.get("question").and_then(|v| v.as_str()).unwrap_or("");
            let multiple_choice = data.get("multipleChoice").and_then(|v| v.as_i64()).unwrap_or(0);
            let options: Vec<String> = data.get("options")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();
            if question.is_empty() || options.len() < 2 {
                let _ = ack.send(&serde_json::json!({"ok": false, "error": "Question and at least 2 options required"}));
                return;
            }
            match db::create_poll(&state.db, chat_id, user_id, question, &options, multiple_choice as i32).await {
                Ok(poll_id) => {
                    let _ = ack.send(&serde_json::json!({"ok": true, "pollId": poll_id}));
                }
                Err(e) => {
                    warn!("create_poll error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "get_poll",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let poll_id = data.get("pollId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::get_poll(&state.db, poll_id).await {
                Ok(poll) => {
                    let _ = ack.send(&poll);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!(null));
                }
            }
        },
    );

    socket.on(
        "vote_poll",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let option_id = data.get("optionId").and_then(|v| v.as_i64()).unwrap_or(0);
            let ok = db::vote_poll(&state.db, user_id, option_id).await.unwrap_or(false);
            let _ = ack.send(&serde_json::json!({"ok": ok}));
        },
    );

    // --- SHOP ---

    socket.on(
        "get_products",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let category = data.get("category").and_then(|v| v.as_str()).unwrap_or("all");
            let cursor = data
                .get("cursor")
                .and_then(|v| v.as_str())
                .and_then(|s| chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f").ok());
            let limit = data.get("limit").and_then(|v| v.as_i64()).unwrap_or(20);
            match db::get_products(&state.db, category, cursor, limit).await {
                Ok(products) => {
                    let _ = ack.send(&products);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "create_product",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let name = data.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let description = data.get("description").and_then(|v| v.as_str()).unwrap_or("");
            let price = data.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let currency = data.get("currency").and_then(|v| v.as_str()).unwrap_or("USD");
            let images = data.get("images").and_then(|v| v.as_str()).unwrap_or("");
            let category = data.get("category").and_then(|v| v.as_str()).unwrap_or("general");
            let stock = data.get("stock").and_then(|v| v.as_i64()).unwrap_or(0);
            if name.is_empty() || price <= 0.0 {
                let _ = ack.send(&serde_json::json!({"ok": false, "error": "Name and price required"}));
                return;
            }
            match db::create_product(&state.db, user_id, name, description, price, currency, images, category, stock as i32).await {
                Ok(product) => {
                    let _ = ack.send(&serde_json::json!({"ok": true, "product": product}));
                }
                Err(e) => {
                    warn!("create_product error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "buy_product",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let product_id = data.get("productId").and_then(|v| v.as_i64()).unwrap_or(0);
            let quantity = data.get("quantity").and_then(|v| v.as_i64()).unwrap_or(1);
            match db::buy_product(&state.db, user_id, product_id, quantity as i32).await {
                Ok(Some(order)) => {
                    track_activity(&state, user_id, "shop").await;
                    let _ = ack.send(&serde_json::json!({"ok": true, "order": order}));
                }
                Ok(None) => {
                    let _ = ack.send(&serde_json::json!({"ok": false, "error": "Not enough stock"}));
                }
                Err(e) => {
                    warn!("buy_product error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "get_my_orders",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            match db::get_my_orders(&state.db, user_id).await {
                Ok(orders) => {
                    let _ = ack.send(&orders);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    // --- WISHLISTS ---

    socket.on(
        "create_wishlist",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let name = data.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let is_public = data.get("isPublic").and_then(|v| v.as_i64()).unwrap_or(0);
            if name.is_empty() {
                let _ = ack.send(&serde_json::json!({"ok": false, "error": "Name required"}));
                return;
            }
            match db::create_wishlist(&state.db, user_id, name, is_public as i32).await {
                Ok(wishlist) => {
                    let _ = ack.send(&serde_json::json!({"ok": true, "wishlist": wishlist}));
                }
                Err(e) => {
                    warn!("create_wishlist error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "get_wishlists",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            match db::get_wishlists(&state.db, user_id).await {
                Ok(wishlists) => {
                    let _ = ack.send(&wishlists);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "add_to_wishlist",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let wishlist_id = data.get("wishlistId").and_then(|v| v.as_i64()).unwrap_or(0);
            let product_id = data.get("productId").and_then(|v| v.as_i64()).unwrap_or(0);
            let ok = db::add_to_wishlist(&state.db, wishlist_id, product_id).await.unwrap_or(false);
            let _ = ack.send(&serde_json::json!({"ok": ok}));
        },
    );

    // --- FLASH DEALS ---

    socket.on(
        "get_flash_deals",
        async |_: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            match db::get_flash_deals(&state.db).await {
                Ok(deals) => {
                    let _ = ack.send(&deals);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    // --- MEMES ---

    socket.on(
        "get_memes",
        async |_: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            match db::get_memes(&state.db).await {
                Ok(memes) => {
                    let _ = ack.send(&memes);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "create_meme",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let image_url = data.get("imageUrl").and_then(|v| v.as_str()).unwrap_or("");
            let caption = data.get("caption").and_then(|v| v.as_str()).unwrap_or("");
            let template = data.get("template").and_then(|v| v.as_str()).unwrap_or("");
            if image_url.is_empty() {
                let _ = ack.send(&serde_json::json!({"ok": false, "error": "Image required"}));
                return;
            }
            match db::create_meme(&state.db, user_id, image_url, caption, template).await {
                Ok(mut meme) => {
                    let user = get_user_by_id(&state, user_id).await;
                    meme.display_name = Some(user.display_name);
                    meme.avatar = Some(user.avatar);
                    let _ = ack.send(&serde_json::json!({"ok": true, "meme": meme}));
                }
                Err(e) => {
                    warn!("create_meme error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "like_meme",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let _user_id = get_user_id(&state, &socket).await;
            let meme_id = data.get("memeId").and_then(|v| v.as_i64()).unwrap_or(0);
            let ok = db::like_meme(&state.db, meme_id, _user_id).await.unwrap_or(false);
            let _ = ack.send(&serde_json::json!({"ok": ok}));
        },
    );

    // --- STICKERS ---

    socket.on(
        "get_sticker_packs",
        async |_: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            match db::get_sticker_packs(&state.db).await {
                Ok(packs) => {
                    let _ = ack.send(&packs);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "get_stickers",
        async |_: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let pack_id = data.get("packId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::get_stickers(&state.db, pack_id).await {
                Ok(stickers) => {
                    let _ = ack.send(&stickers);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "purchase_sticker",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let pack_id = data.get("packId").and_then(|v| v.as_i64()).unwrap_or(0);
            let ok = db::purchase_sticker(&state.db, user_id, pack_id).await.unwrap_or(false);
            let _ = ack.send(&serde_json::json!({"ok": ok}));
        },
    );

    socket.on(
        "get_my_stickers",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            match db::get_my_stickers(&state.db, user_id).await {
                Ok(ids) => {
                    let _ = ack.send(&ids);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    // --- VIBE BALANCE ---

    socket.on(
        "get_vibe_balance",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            match db::get_vibe_balance(&state.db, user_id).await {
                Ok(balance) => {
                    let _ = ack.send(&balance);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!({}));
                }
            }
        },
    );

    socket.on(
        "update_vibe_balance",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         _ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let section = data.get("section").and_then(|v| v.as_str()).unwrap_or("");
            let minutes = data.get("minutes").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            if !section.is_empty() {
                let _ = db::update_vibe_balance(&state.db, user_id, section, minutes).await;
            }
        },
    );

    // --- FOCUS ---

    socket.on(
        "start_focus",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let mode = data.get("mode").and_then(|v| v.as_str()).unwrap_or("pomodoro");
            match db::start_focus(&state.db, user_id, mode).await {
                Ok(session) => {
                    let _ = ack.send(&serde_json::json!({"ok": true, "session": session}));
                }
                Err(e) => {
                    warn!("start_focus error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "end_focus",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            match db::end_focus(&state.db, user_id).await {
                Ok(session) => {
                    let _ = ack.send(&serde_json::json!({"ok": true, "session": session}));
                }
                Err(e) => {
                    warn!("end_focus error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "get_focus_status",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            match db::get_focus_status(&state.db, user_id).await {
                Ok(session) => {
                    let _ = ack.send(&session);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!(null));
                }
            }
        },
    );

    // --- NOTIFICATIONS ---

    socket.on(
        "get_notifications",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            match db::get_notifications(&state.db, user_id).await {
                Ok(notifications) => {
                    let _ = ack.send(&notifications);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "mark_notification_read",
        async |_: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let notification_id = data.get("notificationId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::mark_notification_read(&state.db, notification_id).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    // --- SHARED NOTES ---

    socket.on(
        "save_note",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            let title = data.get("title").and_then(|v| v.as_str()).unwrap_or("");
            let content = data.get("content").and_then(|v| v.as_str()).unwrap_or("");
            match db::save_note(&state.db, chat_id, title, content, user_id).await {
                Ok(note) => {
                    let _ = ack.send(&serde_json::json!({"ok": true, "note": note}));
                }
                Err(e) => {
                    warn!("save_note error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "get_note",
        async |_: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::get_note(&state.db, chat_id).await {
                Ok(note) => {
                    let _ = ack.send(&note);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!(null));
                }
            }
        },
    );

    // --- GROUP TASKS ---

    socket.on(
        "create_task",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            let title = data.get("title").and_then(|v| v.as_str()).unwrap_or("");
            let assigned_to = data.get("assignedTo").and_then(|v| v.as_i64());
            let due_date = data.get("dueDate").and_then(|v| v.as_str()).unwrap_or("");
            if title.is_empty() {
                let _ = ack.send(&serde_json::json!({"ok": false, "error": "Title required"}));
                return;
            }
            match db::create_task(&state.db, chat_id, title, assigned_to.map(|v| v as i32), user_id, due_date).await {
                Ok(task) => {
                    let _ = ack.send(&serde_json::json!({"ok": true, "task": task}));
                }
                Err(e) => {
                    warn!("create_task error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "get_tasks",
        async |_: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::get_tasks(&state.db, chat_id).await {
                Ok(tasks) => {
                    let _ = ack.send(&tasks);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "complete_task",
        async |_: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let task_id = data.get("taskId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::complete_task(&state.db, task_id).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    // --- WATCH TOGETHER ---

    socket.on(
        "create_watch_session",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            let video_url = data.get("videoUrl").and_then(|v| v.as_str()).unwrap_or("");
            if video_url.is_empty() {
                let _ = ack.send(&serde_json::json!({"ok": false, "error": "Video URL required"}));
                return;
            }
            match db::create_watch_session(&state.db, chat_id, user_id, video_url).await {
                Ok(session) => {
                    let _ = ack.send(&serde_json::json!({"ok": true, "session": session}));
                }
                Err(e) => {
                    warn!("create_watch_session error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "sync_watch",
        async |_: SocketRef,
         Data(data): Data<Value>,
         _ack: AckSender| {
            let state = get_state();
            let session_id = data.get("sessionId").and_then(|v| v.as_i64()).unwrap_or(0);
            let playback_time = data.get("currentTime").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let playing = data.get("playing").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::sync_watch(&state.db, session_id, playback_time, playing as i32).await;
        },
    );

    socket.on(
        "get_watch_session",
        async |_: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::get_watch_session(&state.db, chat_id).await {
                Ok(session) => {
                    let _ = ack.send(&session);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!(null));
                }
            }
        },
    );

    // --- GAMES ---

    socket.on(
        "get_games",
        async |_: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            match db::get_games(&state.db).await {
                Ok(games) => {
                    let _ = ack.send(&games);
                }
                Err(_) => {
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "create_game",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let game_id = data.get("gameId").and_then(|v| v.as_i64()).unwrap_or(0);
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::create_game_session(&state.db, game_id, chat_id, user_id).await {
                Ok(session_id) => {
                    track_activity(&state, user_id, "games").await;
                    let _ = ack.send(&serde_json::json!({"ok": true, "sessionId": session_id}));
                }
                Err(e) => {
                    warn!("create_game_session error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    // === MISSING HANDLERS (Node parity) ===

    // --- FORWARD MESSAGE ---
    socket.on(
        "forward_message",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let message_id = data.get("messageId").and_then(|v| v.as_i64()).unwrap_or(0);
            let from_chat_id = data.get("fromChatId").and_then(|v| v.as_i64()).unwrap_or(0);
            let to_chat_id = data.get("toChatId").and_then(|v| v.as_i64()).unwrap_or(0);
            match db::forward_message(&state.db, message_id, from_chat_id, to_chat_id, user_id).await {
                Ok(new_id) => {
                    let _ = ack.send(&serde_json::json!({"ok": true, "messageId": new_id}));
                }
                Err(e) => {
                    warn!("forward_message error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    // --- PIN CHAT ---
    socket.on(
        "pin_chat",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let chat_id = data.get("chatId").and_then(|v| v.as_i64()).unwrap_or(0);
            let pinned = data.get("pinned").and_then(|v| v.as_bool()).unwrap_or(false);
            let _ = db::toggle_pin_chat(&state.db, user_id, chat_id, pinned).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    // --- UNSUBSCRIBE CHANNEL ---
    socket.on(
        "unsubscribe_channel",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let channel_id = data.get("channelId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::unsubscribe_channel(&state.db, user_id, channel_id).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    // --- LEAVE COMMUNITY ---
    socket.on(
        "leave_community",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let community_id = data.get("communityId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::leave_community(&state.db, user_id, community_id).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    // --- WEBRTC CALLS ---
    socket.on(
        "start_call",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let callee_id = data.get("calleeId").and_then(|v| v.as_i64()).unwrap_or(0);
            let call_type = data.get("type").and_then(|v| v.as_str()).unwrap_or("audio");
            match db::create_active_call(&state.db, user_id, callee_id, call_type).await {
                Ok(call) => {
                    track_activity(&state, user_id, "calls").await;
                    emit_to_user(&state, callee_id, "incoming_call", &call).await;
                    let _ = ack.send(&serde_json::json!({"ok": true, "call": call}));
                }
                Err(e) => {
                    warn!("start_call error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "accept_call",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let call_id = data.get("callId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::update_call_status(&state.db, call_id, "connected").await;
            if let Ok(Some(call)) = db::get_active_call(&state.db, call_id).await {
                let other = if call.caller_id == user_id { call.callee_id } else { call.caller_id };
                emit_to_user(&state, other, "call_accepted", &call).await;
            }
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    socket.on(
        "reject_call",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let call_id = data.get("callId").and_then(|v| v.as_i64()).unwrap_or(0);
            if let Ok(Some(call)) = db::get_active_call(&state.db, call_id).await {
                let other = if call.caller_id == user_id { call.callee_id } else { call.caller_id };
                emit_to_user(&state, other, "call_rejected", &serde_json::json!({"callId": call_id})).await;
                let callee = get_user_by_id(&state, user_id).await;
                if let Ok(notif) = db::add_smart_notification(&state.db, other, "missed_call", &format!("Llamada perdida de {}", callee.display_name), "normal").await {
                    emit_to_user(&state, other, "new_notification", &notif).await;
                }
            }
            let _ = db::end_active_call(&state.db, call_id).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    socket.on(
        "end_call",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let call_id = data.get("callId").and_then(|v| v.as_i64()).unwrap_or(0);
            if let Ok(Some(call)) = db::get_active_call(&state.db, call_id).await {
                emit_to_user(&state, call.caller_id, "call_ended", &serde_json::json!({"callId": call_id})).await;
                emit_to_user(&state, call.callee_id, "call_ended", &serde_json::json!({"callId": call_id})).await;
            }
            let _ = db::end_active_call(&state.db, call_id).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    socket.on(
        "signal_data",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let target_id = data.get("targetId").and_then(|v| v.as_i64()).unwrap_or(0);
            let signal = data.get("signal");
            emit_to_user(&state, target_id, "signal_data", &serde_json::json!({
                "userId": user_id, "signal": signal
            })).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    // --- BROADCASTS ---
    socket.on(
        "start_broadcast",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let title = data.get("title").and_then(|v| v.as_str()).unwrap_or("");
            match db::start_broadcast(&state.db, user_id, title).await {
                Ok(bc) => {
                    socket.leave_all();
                    socket.join(format!("broadcast:{}", bc.id));
                    let _ = ack.send(&serde_json::json!({"ok": true, "broadcast": bc}));
                }
                Err(e) => {
                    warn!("start_broadcast error: {}", e);
                    let _ = ack.send(&serde_json::json!({"ok": false}));
                }
            }
        },
    );

    socket.on(
        "stop_broadcast",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let broadcast_id = data.get("broadcastId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::stop_broadcast(&state.db, broadcast_id, user_id).await;
            let _ = state.io.to(format!("broadcast:{}", broadcast_id)).emit("broadcast_ended", &serde_json::json!({"broadcastId": broadcast_id})).await;
            socket.leave(format!("broadcast:{}", broadcast_id));
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    socket.on(
        "get_broadcasts",
        async |_: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            match db::get_broadcasts(&state.db).await {
                Ok(list) => { let _ = ack.send(&list); }
                Err(_) => { let _ = ack.send(&serde_json::json!([])); }
            }
        },
    );

    socket.on(
        "view_broadcast",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let broadcast_id = data.get("broadcastId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::add_broadcast_viewer(&state.db, broadcast_id, user_id).await;
            socket.join(format!("broadcast:{}", broadcast_id));
            // Notify broadcaster
            if let Ok(Some(bc)) = db::get_broadcast(&state.db, broadcast_id).await {
                emit_to_user(&state, bc.user_id, "broadcast_viewer_joined", &serde_json::json!({"userId": user_id})).await;
            }
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    socket.on(
        "leave_broadcast",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let broadcast_id = data.get("broadcastId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::remove_broadcast_viewer(&state.db, broadcast_id, user_id).await;
            socket.leave(format!("broadcast:{}", broadcast_id));
            if let Ok(Some(bc)) = db::get_broadcast(&state.db, broadcast_id).await {
                emit_to_user(&state, bc.user_id, "broadcast_viewer_left", &serde_json::json!({"userId": user_id})).await;
            }
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    socket.on(
        "broadcast_chunk",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let broadcast_id = data.get("broadcastId").and_then(|v| v.as_i64()).unwrap_or(0);
            let chunk = data.get("chunk");
            let _ = state.io.to(format!("broadcast:{}", broadcast_id)).emit("broadcast_chunk", &serde_json::json!({"chunk": chunk})).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    socket.on(
        "broadcast_signal",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let broadcast_id = data.get("broadcastId").and_then(|v| v.as_i64()).unwrap_or(0);
            let signal = data.get("signal");
            let user_id = get_user_id(&state, &socket).await;
            let _ = state.io.to(format!("broadcast:{}", broadcast_id)).emit("broadcast_signal", &serde_json::json!({"userId": user_id, "signal": signal})).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    // --- AVATAR 3D ---
    socket.on(
        "save_avatar",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let customization = data.get("customization").cloned().unwrap_or(serde_json::Value::Null);
            let _ = db::save_avatar_customization(&state.db, user_id, &customization).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    socket.on(
        "get_avatar",
        async |socket: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            match db::get_avatar_customization(&state.db, user_id).await {
                Ok(Some(c)) => { let _ = ack.send(&c); }
                _ => { let _ = ack.send(&serde_json::json!({})); }
            }
        },
    );

    // --- GAMES ---
    socket.on(
        "join_game",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let session_id = data.get("sessionId").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = db::join_game_session(&state.db, session_id, user_id).await;
            let _ = state.io.to(format!("game:{}", session_id)).emit("player_joined", &serde_json::json!({"userId": user_id})).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    socket.on(
        "game_action",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let session_id = data.get("sessionId").and_then(|v| v.as_i64()).unwrap_or(0);
            let action = data.get("action").and_then(|v| v.as_str()).unwrap_or("");
            let game_data = data.get("data");
            let _ = state.io.to(format!("game:{}", session_id)).emit("game_action", &serde_json::json!({
                "userId": user_id, "action": action, "data": game_data
            })).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    // --- LIVEKIT TOKEN ---
    socket.on(
        "livekit_token",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let api_key = std::env::var("LIVEKIT_API_KEY").unwrap_or_default();
            let api_secret = std::env::var("LIVEKIT_API_SECRET").unwrap_or_default();
            if api_key.is_empty() || api_secret.is_empty() {
                let _ = ack.send(&serde_json::json!({"ok": false, "error": "LiveKit no configurado"}));
                return;
            }
            let room = data.get("room").and_then(|v| v.as_str()).unwrap_or("");
            let identity = data.get("identity").and_then(|v| v.as_str()).unwrap_or("");
            let metadata = data.get("metadata").or(Some(&Value::Null));
            if room.is_empty() || identity.is_empty() {
                let _ = ack.send(&serde_json::json!({"ok": false}));
                return;
            }
            let now = chrono::Utc::now().timestamp();
            let claims = serde_json::json!({
                "iss": api_key,
                "sub": identity,
                "iat": now,
                "exp": now + 3600,
                "nbf": now,
                "video": {
                    "roomJoin": true,
                    "room": room,
                },
                "metadata": metadata,
            });
            let header_b64 = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(
                serde_json::to_string(&serde_json::json!({"alg": "HS256", "typ": "JWT"})).unwrap_or_default()
            );
            let claims_b64 = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(
                serde_json::to_string(&claims).unwrap_or_default()
            );
            fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
                use sha2::Digest;
                const BLOCK_SIZE: usize = 64;
                let mut k = key.to_vec();
                if k.len() > BLOCK_SIZE {
                    k = sha2::Sha256::digest(&k).to_vec();
                }
                k.resize(BLOCK_SIZE, 0);
                let mut ipad = vec![0x36u8; BLOCK_SIZE];
                let mut opad = vec![0x5cu8; BLOCK_SIZE];
                for i in 0..k.len() {
                    ipad[i] ^= k[i];
                    opad[i] ^= k[i];
                }
                let inner = sha2::Sha256::digest(&[&ipad[..], data].concat());
                sha2::Sha256::digest(&[&opad[..], &inner[..]].concat()).to_vec()
            }
            let sig = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(
                hmac_sha256(api_secret.as_bytes(), format!("{}.{}", header_b64, claims_b64).as_bytes())
            );
            let token = format!("{}.{}.{}", header_b64, claims_b64, sig);
            let _ = ack.send(&serde_json::json!({"ok": true, "token": token}));
        },
    );

    // --- RECOMMENDATIONS ---
    socket.on(
        "record_interaction",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let post_id = data.get("postId").and_then(|v| v.as_i64()).unwrap_or(0);
            let itype = data.get("type").and_then(|v| v.as_str()).unwrap_or("view");
            let weight = data.get("value").and_then(|v| v.as_i64()).unwrap_or(data.get("weight").and_then(|v| v.as_i64()).unwrap_or(1)) as i32;
            let _ = db::record_interaction(&state.db, user_id, post_id, itype, weight).await;
            let _ = ack.send(&serde_json::json!({"ok": true}));
        },
    );

    socket.on(
        "get_recommended_posts",
        async |socket: SocketRef,
         Data(data): Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let user_id = get_user_id(&state, &socket).await;
            let limit = data.get("limit").and_then(|v| v.as_i64()).unwrap_or(10) as i32;
            let seen_ids: Vec<i64> = data.get("seenIds").and_then(|v| v.as_array()).map(|arr| arr.iter().filter_map(|x| x.as_i64()).collect()).unwrap_or_default();
            match db::get_recommended_posts(&state.db, user_id, limit, seen_ids).await {
                Ok(posts) => {
                    info!(user_id = user_id, count = posts.len(), action = "get_recommended_posts", "Posts recomendados enviados");
                    let _ = ack.send(&posts);
                }
                Err(e) => {
                    warn!(user_id = user_id, err = %e, action = "get_recommended_posts", "Error obteniendo posts recomendados");
                    let _ = ack.send(&serde_json::json!([]));
                }
            }
        },
    );

    socket.on(
        "get_trending_tags",
        async |_: SocketRef,
         _data: Data<Value>,
         ack: AckSender| {
            let state = get_state();
            let _ = ack.send(&serde_json::json!(db::get_trending_tags(&state.db, 20).await.unwrap_or_default()));
        },
    );

    // --- DISCONNECT ---
    let state_for_disconnect = state.clone();
    let sid = socket_id.clone();
    socket.on_disconnect(async move |_: SocketRef| {
        let state = &state_for_disconnect;
        let user_id = {
            let mut map = state.socket_user_map.write().await;
            map.remove(&sid)
        };
        if let Some(uid) = user_id {
            info!(user_id = uid, action = "disconnect", "Usuario desconectado");
            // Cleanup token
            state.socket_tokens.write().await.remove(&sid);
            // End active calls
            if let Ok(calls) = db::get_user_active_calls(&state.db, uid).await {
                for call in calls {
                    let _ = db::end_active_call(&state.db, call.id).await;
                    let other = if call.caller_id == uid { call.callee_id } else { call.caller_id };
                    let _ = state.io.to(format!("user:{}", other)).emit("call_ended", &serde_json::json!({"callId": call.id})).await;
                }
            }
            // End active broadcasts
            let mut usm = state.user_socket_map.write().await;
            if let Some(sockets) = usm.get_mut(&uid) {
                sockets.retain(|s| s != &sid);
                if sockets.is_empty() {
                    usm.remove(&uid);
                    state.online_users.write().await.remove(&uid);
                    if let Ok(contacts) = db::get_contacts(&state.db, uid).await {
                        for c in &contacts {
                            let _ = state
                                .io
                                .to(format!("user:{}", c.id))
                                .emit(
                                    "contact_status",
                                    &serde_json::json!({"userId": uid, "online": false}),
                                )
                                .await;
                        }
                    }
                }
            }
        }
    });
}

fn get_state() -> Arc<AppState> {
    crate::STATE.get().expect("State not initialized").clone()
}

async fn get_user_id(state: &AppState, socket: &SocketRef) -> i64 {
    let map = state.socket_user_map.read().await;
    map.get(&socket.id.to_string()).copied().unwrap_or(0)
}

async fn get_user_by_id(state: &AppState, user_id: i64) -> User {
    db::get_user_by_id(&state.db, user_id)
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| User {
            id: 0,
            phone: String::new(),
            username: String::new(),
            display_name: String::new(),
            avatar: String::new(),
            bio: None,
            country_code: None,
            online: None,
        })
}

async fn track_activity(state: &AppState, user_id: i64, section: &str) {
    let _ = db::update_vibe_balance(&state.db, user_id, section, 1).await;
}

async fn emit_to_user(state: &AppState, user_id: i64, event: &str, data: &impl serde::Serialize) {
    let _ = state
        .io
        .to(format!("user:{}", user_id))
        .emit(event, data)
        .await;
}

#[allow(dead_code)]
async fn emit_to_user_formatted(
    state: &AppState,
    user_id: i64,
    event: &str,
    data: &impl serde::Serialize,
) {
    let value: Value = serde_json::to_value(data).unwrap_or(Value::Null);
    let sids = {
        let map = state.user_socket_map.read().await;
        map.get(&user_id).cloned().unwrap_or_default()
    };
    for sid in &sids {
        let fmt = {
            let fmts = state.socket_formats.read().await;
            fmts.get(sid).copied().unwrap_or(crate::format::WireFormat::Json)
        };
        let buf = crate::format::encode_event(event, &value, &fmt);
        let _ = state.io.to(format!("user:{}", user_id)).emit(event, &buf).await;
    }
}

