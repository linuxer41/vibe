use chrono::Utc;
use deadpool_postgres::Pool;
use sha2::{Digest, Sha256};
use tokio_postgres::Row;
use uuid::Uuid;

use crate::snowflake;
use crate::types::*;
use tracing::{error, info, warn};

pub type DbPool = Pool;

pub async fn keepalive_ping(pool: &DbPool) {
    match pool.get().await {
        Ok(client) => {
            let _ = client.query_one("SELECT 1", &[]).await;
        }
        Err(e) => {
            warn!(err = %e, action = "keepalive", "DB ping failed");
        }
    }
}

pub async fn init_db(pool: &DbPool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let max_retries: u32 = 30;
    for i in 0..max_retries {
        match pool.get().await {
            Ok(client) => {
                match client.query_one("SELECT 1", &[]).await {
                    Ok(_) => {
                        info!(action = "db_connect", "Database connected");
                        return Ok(());
                    }
                    Err(e) => {
                        warn!(attempt = i + 1, err = %e, action = "db_connect", "Waiting for database...");
                    }
                }
            }
            Err(e) => {
                warn!(attempt = i + 1, err = %e, action = "db_connect", "Waiting for database pool...");
            }
        }
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    }
    Err("Failed to connect to database after 30 retries".into())
}

pub fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn generate_token() -> String {
    Uuid::new_v4().to_string()
}

fn row_to_user(row: &Row) -> User {
    User {
        id: row.get("id"),
        phone: row.get("phone"),
        username: row.get("username"),
        display_name: row.get("display_name"),
        avatar: row.get("avatar"),
        bio: row.get("bio"),
        country_code: row.get("country_code"),
        online: None,
    }
}

// --- AUTH ---

pub async fn send_code(pool: &DbPool, phone: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let code = format!("{:06}", rand::random::<u32>() % 1000000);
    let expires = Utc::now() + chrono::Duration::minutes(5);
    let expires_naive = expires.naive_utc();
    let id = snowflake::generate();
    let client = pool.get().await?;
    client
        .execute(
            "INSERT INTO verification_codes (id, phone, code, expires_at) VALUES ($1, $2, $3, $4)",
            &[&id, &phone.to_string(), &code, &expires_naive],
        )
        .await?;
    Ok(code)
}

pub async fn verify_code(
    pool: &DbPool,
    phone: &str,
    code: &str,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT id, expires_at FROM verification_codes WHERE phone = $1 AND code = $2 AND used = 0 ORDER BY id DESC FETCH FIRST 1 ROWS ONLY",
            &[&phone.to_string(), &code.to_string()],
        )
        .await?;
    if let Some(row) = rows.first() {
        let expires_at: chrono::NaiveDateTime = row.get("expires_at");
        if expires_at > Utc::now().naive_utc() {
            let id: i64 = row.get("id");
            client.execute(
                "UPDATE verification_codes SET used = 1 WHERE id = $1",
                &[&id],
            ).await?;
            return Ok(true);
        }
    }
    Ok(false)
}

pub async fn find_or_create_user(
    pool: &DbPool,
    phone: &str,
    username: &str,
    display_name: &str,
    country_code: &str,
) -> Result<(User, bool), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT id, phone, username, display_name, avatar, bio, country_code FROM users WHERE phone = $1",
            &[&phone.to_string()],
        )
        .await?;
    if let Some(row) = rows.first() {
        return Ok((row_to_user(row), false));
    }
    let user_id = snowflake::generate();
    info!(user_id = user_id, phone = %phone, action = "register", "Nuevo usuario registrado con Snowflake ID");
    let rows = client
        .query(
            "INSERT INTO users (id, phone, username, display_name, country_code) VALUES ($1, $2, $3, $4, $5) RETURNING id, phone, username, display_name, avatar, bio, country_code",
            &[&user_id, &phone.to_string(), &username.to_string(), &display_name.to_string(), &country_code.to_string()],
        )
        .await?;
    let user = row_to_user(&rows[0]);
    Ok((user, true))
}

pub async fn create_session(
    pool: &DbPool,
    user_id: i64,
    device_id: &str,
    device_name: &str,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let token = generate_token();
    let client = pool.get().await?;
    client
        .execute(
            "INSERT INTO sessions (user_id, token, device_id, device_name) VALUES ($1, $2, $3, $4)",
            &[&user_id, &token, &device_id.to_string(), &device_name.to_string()],
        )
        .await?;
    Ok(token)
}

pub async fn get_session(
    pool: &DbPool,
    token: &str,
) -> Result<Option<User>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT u.id, u.phone, u.username, u.display_name, u.avatar, u.bio, u.country_code
             FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = $1 AND s.created_at > NOW() - INTERVAL '30 days'",
            &[&token.to_string()],
        )
        .await?;
    Ok(rows.first().map(|r| row_to_user(r)))
}

// --- USERS / CONTACTS ---

pub async fn get_user_by_id(
    pool: &DbPool,
    id: i64,
) -> Result<Option<User>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT id, phone, username, display_name, avatar, bio, country_code FROM users WHERE id = $1",
            &[&id],
        )
        .await?;
    Ok(rows.first().map(|r| row_to_user(r)))
}

pub async fn search_users(
    pool: &DbPool,
    query: &str,
) -> Result<Vec<User>, Box<dyn std::error::Error + Send + Sync>> {
    let like = format!("%{}%", query);
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT id, phone, username, display_name, avatar FROM users WHERE phone LIKE $1 OR username LIKE $2 OR display_name LIKE $3 FETCH FIRST 20 ROWS ONLY",
            &[&like, &like, &like],
        )
        .await?;
    Ok(rows.iter().map(|r| row_to_user(r)).collect())
}

pub async fn add_contact(
    pool: &DbPool,
    user_id: i64,
    contact_user_id: i64,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let result = client
        .execute(
            "INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            &[&user_id, &contact_user_id],
        )
        .await;
    let _ = client
        .execute(
            "INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            &[&contact_user_id, &user_id],
        )
        .await;
    Ok(result.is_ok())
}

pub async fn get_contacts(
    pool: &DbPool,
    user_id: i64,
) -> Result<Vec<User>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT u.id, u.phone, u.username, u.display_name, u.avatar, u.bio, u.country_code
             FROM contacts c JOIN users u ON c.contact_user_id = u.id WHERE c.user_id = $1 ORDER BY u.display_name",
            &[&user_id],
        )
        .await?;
    Ok(rows.iter().map(|r| row_to_user(r)).collect())
}

// --- CHATS ---

pub async fn get_private_chat(
    pool: &DbPool,
    user1_id: i64,
    user2_id: i64,
) -> Result<Option<i64>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT c.id FROM chats c
             WHERE c.type = 'private'
             AND (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id) = 2
             AND (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id AND user_id IN ($1, $2)) = 2",
            &[&user1_id, &user2_id],
        )
        .await?;
    Ok(rows.first().map(|r| r.get("id")))
}

pub async fn create_private_chat(
    pool: &DbPool,
    user1_id: i64,
    user2_id: i64,
) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
    if let Some(id) = get_private_chat(pool, user1_id, user2_id).await? {
        return Ok(id);
    }
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO chats (type, name, created_by) VALUES ('private', '', $1) RETURNING id",
            &[&user1_id],
        )
        .await?;
    let chat_id: i64 = rows[0].get("id");
    client
        .execute(
            "INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2), ($3, $4)",
            &[&chat_id, &user1_id, &chat_id, &user2_id],
        )
        .await?;
    Ok(chat_id)
}

pub async fn create_group(
    pool: &DbPool,
    name: &str,
    created_by: i64,
    member_ids: &[i64],
) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO chats (type, name, created_by) VALUES ('group', $1, $2) RETURNING id",
            &[&name.to_string(), &created_by],
        )
        .await?;
    let chat_id: i64 = rows[0].get("id");
    let mut all_members: Vec<i64> = member_ids.to_vec();
    all_members.push(created_by);
    all_members.sort();
    all_members.dedup();
    for uid in all_members {
        let _ = client
            .execute(
                "INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                &[&chat_id, &uid],
            )
            .await;
    }
    Ok(chat_id)
}

pub async fn get_user_chats(
    pool: &DbPool,
    user_id: i64,
) -> Result<Vec<Chat>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT c.id, c.type, c.name, c.avatar, c.created_at,
             (SELECT text FROM messages WHERE chat_id = c.id ORDER BY id DESC FETCH FIRST 1 ROWS ONLY) as last_message,
             (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY id DESC FETCH FIRST 1 ROWS ONLY)::text as last_message_time,
             (SELECT sender_id FROM messages WHERE chat_id = c.id ORDER BY id DESC FETCH FIRST 1 ROWS ONLY) as last_sender_id
             FROM chats c JOIN chat_members cm ON c.id = cm.chat_id WHERE cm.user_id = $1
             ORDER BY last_message_time DESC NULLS LAST",
            &[&user_id],
        )
        .await?;

    let mut chats: Vec<Chat> = Vec::new();
    for row in rows {
        let chat_id: i64 = row.get("id");
        let chat_type: String = row.get("type");

        // Get unread count
        let unread_rows = client
            .query(
                "SELECT COUNT(*) as cnt FROM messages m
                 WHERE m.chat_id = $1 AND m.id > COALESCE(
                   (SELECT MAX(mr.message_id) FROM message_reads mr WHERE mr.user_id = $2 AND mr.message_id IN (SELECT id FROM messages WHERE chat_id = $1)), 0
                 ) AND m.sender_id != $2",
                &[&chat_id, &user_id],
            )
            .await?;
        let unread: i64 = unread_rows[0].get("cnt");

        let mut name: String = row.get("name");
        let mut avatar: String = row.get("avatar");

        if chat_type == "private" {
            let member_rows = client
                .query(
                    "SELECT u.id, u.display_name, u.avatar FROM chat_members cm JOIN users u ON cm.user_id = u.id WHERE cm.chat_id = $1 AND cm.user_id != $2",
                    &[&chat_id, &user_id],
                )
                .await?;
            if let Some(m) = member_rows.first() {
                let n: String = m.get("display_name");
                let a: String = m.get("avatar");
                if name.is_empty() { name = n; }
                if avatar.is_empty() { avatar = a; }
            }
        }

        let last_msg_time: Option<String> = row.get("last_message_time");

        chats.push(Chat {
            id: chat_id,
            chat_type,
            name,
            avatar,
            last_message: row.get("last_message"),
            last_message_time: last_msg_time,
            last_sender_id: row.get("last_sender_id"),
            created_at: None,
            unread: Some(unread),
            members: None,
            pinned: None,
        });
    }
    Ok(chats)
}

pub async fn get_chat_members(
    pool: &DbPool,
    chat_id: i64,
) -> Result<Vec<User>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT u.id, u.phone, u.username, u.display_name, u.avatar, u.bio, u.country_code
             FROM chat_members cm JOIN users u ON cm.user_id = u.id WHERE cm.chat_id = $1",
            &[&chat_id],
        )
        .await?;
    Ok(rows.iter().map(|r| row_to_user(r)).collect())
}

// --- MESSAGES ---

pub async fn add_message(
    pool: &DbPool,
    chat_id: i64,
    sender_id: i64,
    text: &str,
    msg_type: &str,
    reply_to_id: Option<i64>,
    forwarded: Option<i64>,
) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
    let msg_id = snowflake::generate();
    let client = pool.get().await?;
    client
        .execute(
            "INSERT INTO messages (id, chat_id, sender_id, text, type, reply_to_id, forwarded) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            &[&msg_id, &chat_id, &sender_id, &text.to_string(), &msg_type.to_string(), &reply_to_id, &forwarded],
        )
        .await?;
    info!(chat_id = chat_id, sender_id = sender_id, msg_id = msg_id, text_len = text.len(), action = "add_message", "Mensaje guardado en DB");
    Ok(msg_id)
}

pub async fn get_messages(
    pool: &DbPool,
    chat_id: i64,
    limit: i64,
    cursor: Option<String>,
) -> Result<Vec<Message>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = if let Some(ref c) = cursor {
        client
            .query(
                "SELECT m.*, u.display_name as sender_name, u.avatar as sender_avatar
                 FROM messages m JOIN users u ON m.sender_id = u.id
                 WHERE m.chat_id = $1 AND m.created_at < $2
                 ORDER BY m.created_at DESC FETCH FIRST $3 ROWS ONLY",
                &[&chat_id, c, &limit],
            )
            .await?
    } else {
        client
            .query(
                "SELECT m.*, u.display_name as sender_name, u.avatar as sender_avatar
                 FROM messages m JOIN users u ON m.sender_id = u.id
                 WHERE m.chat_id = $1
                 ORDER BY m.created_at DESC FETCH FIRST $2 ROWS ONLY",
                &[&chat_id, &limit],
            )
            .await?
    };

    let mut msgs: Vec<Message> = rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            Message {
                id: r.get("id"),
                chat_id: r.get("chat_id"),
                sender_id: r.get("sender_id"),
                sender_name: r.get("sender_name"),
                sender_avatar: r.get("sender_avatar"),
                text: r.get("text"),
                msg_type: r.get("type"),
                created_at: created_at.and_utc().to_rfc3339(),
                reply_to_id: r.get("reply_to_id"),
                forwarded: r.get("forwarded"),
            }
        })
        .collect();
    msgs.reverse();
    Ok(msgs)
}

pub async fn mark_read(
    pool: &DbPool,
    message_id: i64,
    user_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let _ = client
        .execute(
            "INSERT INTO message_reads (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            &[&message_id, &user_id],
        )
        .await;
    Ok(())
}

pub async fn search_messages(
    pool: &DbPool,
    chat_id: i64,
    query: &str,
    limit: i64,
) -> Result<Vec<Message>, Box<dyn std::error::Error + Send + Sync>> {
    let like = format!("%{}%", query);
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT m.*, u.display_name as sender_name, u.avatar as sender_avatar
             FROM messages m JOIN users u ON m.sender_id = u.id
             WHERE m.chat_id = $1 AND m.text ILIKE $2
             ORDER BY m.created_at DESC FETCH FIRST $3 ROWS ONLY",
            &[&chat_id, &like, &limit],
        )
        .await?;
    let mut msgs: Vec<Message> = rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            Message {
                id: r.get("id"),
                chat_id: r.get("chat_id"),
                sender_id: r.get("sender_id"),
                sender_name: r.get("sender_name"),
                sender_avatar: r.get("sender_avatar"),
                text: r.get("text"),
                msg_type: r.get("type"),
                created_at: created_at.and_utc().to_rfc3339(),
                reply_to_id: r.get("reply_to_id"),
                forwarded: r.get("forwarded"),
            }
        })
        .collect();
    msgs.reverse();
    Ok(msgs)
}

pub async fn delete_message(
    pool: &DbPool,
    message_id: i64,
    user_id: i64,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .execute(
            "DELETE FROM messages WHERE id = $1 AND sender_id = $2",
            &[&message_id, &user_id],
        )
        .await?;
    Ok(rows > 0)
}

// --- CALLS ---

pub async fn add_call(
    pool: &DbPool,
    caller_id: i64,
    callee_id: i64,
    call_type: &str,
    status: &str,
    duration: i32,
) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
    let call_id = snowflake::generate();
    let client = pool.get().await?;
    client
        .execute(
            "INSERT INTO calls (id, caller_id, callee_id, type, status, duration) VALUES ($1, $2, $3, $4, $5, $6)",
            &[&call_id, &caller_id, &callee_id, &call_type.to_string(), &status.to_string(), &duration],
        )
        .await?;
    info!(caller_id = caller_id, callee_id = callee_id, call_id = call_id, call_type = %call_type, status = %status, action = "add_call", "Llamada registrada");
    Ok(call_id)
}

pub async fn get_user_calls(
    pool: &DbPool,
    user_id: i64,
    limit: i64,
) -> Result<Vec<Call>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT c.*,
             CASE WHEN c.caller_id = $1 THEN 'outgoing' WHEN c.callee_id = $1 THEN 'incoming' ELSE c.status END as direction,
             u.id as other_id, u.display_name as other_name, u.avatar as other_avatar
             FROM calls c JOIN users u ON (CASE WHEN c.caller_id = $1 THEN c.callee_id ELSE c.caller_id END) = u.id
             WHERE c.caller_id = $1 OR c.callee_id = $1
             ORDER BY c.id DESC FETCH FIRST $2 ROWS ONLY",
            &[&user_id, &limit],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            Call {
                id: r.get("id"),
                caller_id: r.get("caller_id"),
                callee_id: r.get("callee_id"),
                call_type: r.get("type"),
                status: r.get("status"),
                duration: r.get("duration"),
                created_at: created_at.and_utc().to_rfc3339(),
                direction: r.get("direction"),
                other_id: r.get("other_id"),
                other_name: r.get("other_name"),
                other_avatar: r.get("other_avatar"),
            }
        })
        .collect())
}

// --- POSTS ---

pub async fn create_post(
    pool: &DbPool,
    user_id: i64,
    text: &str,
    media: &str,
    media_type: &str,
) -> Result<Post, Box<dyn std::error::Error + Send + Sync>> {
    let post_id = snowflake::generate();
    let expires = Utc::now() + chrono::Duration::hours(24);
    let expires_naive = expires.naive_utc();
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO posts (id, user_id, text, media, media_type, expires_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, text, media, media_type, created_at",
            &[&post_id, &user_id, &text.to_string(), &media.to_string(), &media_type.to_string(), &expires_naive],
        )
        .await?;
    let created_at: chrono::NaiveDateTime = rows[0].get("created_at");
    info!(user_id = user_id, post_id = post_id, action = "create_post", "Post creado en DB");
    Ok(Post {
        id: rows[0].get("id"),
        user_id,
        text: rows[0].get("text"),
        media: rows[0].get("media"),
        media_type: rows[0].get("media_type"),
        likes_count: Some(0),
        comments_count: Some(0),
        created_at: created_at.and_utc().to_rfc3339(),
        expires_at: Some(expires.to_rfc3339()),
        display_name: None,
        avatar: None,
        views: None,
    })
}

pub async fn get_posts(
    pool: &DbPool,
    user_id: i64,
    filter: &str,
    cursor: Option<String>,
    limit: i64,
) -> Result<Vec<Post>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let (sql_prefix, params): (String, Vec<&(dyn tokio_postgres::types::ToSql + Sync)>) = match filter {
        "mine" => {
            let base = "SELECT p.*, u.display_name, u.avatar,
                (SELECT COUNT(*) FROM post_views WHERE post_id = p.id) as views
                FROM posts p JOIN users u ON p.user_id = u.id
                WHERE p.user_id = $1 AND p.expires_at > NOW()".to_string();
            if let Some(ref c) = cursor {
                (format!("{} AND p.created_at < $2 ORDER BY p.created_at DESC FETCH FIRST $3 ROWS ONLY", base),
                 vec![&user_id as &(dyn tokio_postgres::types::ToSql + Sync), c as &(dyn tokio_postgres::types::ToSql + Sync), &limit as &(dyn tokio_postgres::types::ToSql + Sync)])
            } else {
                (format!("{} ORDER BY p.created_at DESC FETCH FIRST $2 ROWS ONLY", base),
                 vec![&user_id as &(dyn tokio_postgres::types::ToSql + Sync), &limit as &(dyn tokio_postgres::types::ToSql + Sync)])
            }
        }
        "contacts" => {
            let base = "SELECT p.*, u.display_name, u.avatar,
                (SELECT COUNT(*) FROM post_views WHERE post_id = p.id) as views
                FROM posts p JOIN users u ON p.user_id = u.id
                WHERE (p.user_id = $1 OR p.user_id IN (SELECT contact_user_id FROM contacts WHERE user_id = $1))
                AND p.expires_at > NOW()".to_string();
            if let Some(ref c) = cursor {
                (format!("{} AND p.created_at < $2 ORDER BY p.created_at DESC FETCH FIRST $3 ROWS ONLY", base),
                 vec![&user_id as &(dyn tokio_postgres::types::ToSql + Sync), c as &(dyn tokio_postgres::types::ToSql + Sync), &limit as &(dyn tokio_postgres::types::ToSql + Sync)])
            } else {
                (format!("{} ORDER BY p.created_at DESC FETCH FIRST $2 ROWS ONLY", base),
                 vec![&user_id as &(dyn tokio_postgres::types::ToSql + Sync), &limit as &(dyn tokio_postgres::types::ToSql + Sync)])
            }
        }
        _ => { // "all"
            let base = "SELECT p.*, u.display_name, u.avatar,
                (SELECT COUNT(*) FROM post_views WHERE post_id = p.id) as views
                FROM posts p JOIN users u ON p.user_id = u.id
                WHERE p.expires_at > NOW()".to_string();
            if let Some(ref c) = cursor {
                (format!("{} AND p.created_at < $1 ORDER BY p.created_at DESC FETCH FIRST $2 ROWS ONLY", base),
                 vec![c as &(dyn tokio_postgres::types::ToSql + Sync), &limit as &(dyn tokio_postgres::types::ToSql + Sync)])
            } else {
                (format!("{} ORDER BY p.created_at DESC FETCH FIRST $1 ROWS ONLY", base),
                 vec![&limit as &(dyn tokio_postgres::types::ToSql + Sync)])
            }
        }
    };

    let rows = client.query(&sql_prefix, &params).await?;
    Ok(rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            let expires_at: Option<chrono::NaiveDateTime> = r.get("expires_at");
            Post {
                id: r.get("id"),
                user_id: r.get("user_id"),
                text: r.get("text"),
                media: r.get("media"),
                media_type: r.get("media_type"),
                likes_count: r.get("likes_count"),
                comments_count: r.get("comments_count"),
                created_at: created_at.and_utc().to_rfc3339(),
                expires_at: expires_at.map(|e| e.and_utc().to_rfc3339()),
                display_name: r.get("display_name"),
                avatar: r.get("avatar"),
                views: r.get("views"),
            }
        })
        .collect())
}

pub async fn view_post(
    pool: &DbPool,
    post_id: i64,
    user_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let _ = client
        .execute(
            "INSERT INTO post_views (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            &[&post_id, &user_id],
        )
        .await;
    Ok(())
}

pub async fn get_post_views(
    pool: &DbPool,
    post_id: i64,
) -> Result<Vec<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT u.id, u.display_name, u.avatar, sv.viewed_at FROM post_views sv JOIN users u ON sv.user_id = u.id WHERE sv.post_id = $1",
            &[&post_id],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<_, i64>("id"),
                "display_name": r.get::<_, String>("display_name"),
                "avatar": r.get::<_, String>("avatar"),
                "viewed_at": r.get::<_, chrono::NaiveDateTime>("viewed_at").and_utc().to_rfc3339(),
            })
        })
        .collect())
}

// --- POST LIKES & COMMENTS ---

pub async fn like_post(
    pool: &DbPool,
    post_id: i64,
    user_id: i64,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let result = client
        .execute(
            "INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            &[&post_id, &user_id],
        )
        .await;
    if result.is_ok() {
        let _ = client
            .execute(
                "UPDATE posts SET likes_count = (SELECT COUNT(*) FROM post_likes WHERE post_id = $1) WHERE id = $1",
                &[&post_id],
            )
            .await;
        Ok(true)
    } else {
        Ok(false)
    }
}

pub async fn unlike_post(
    pool: &DbPool,
    post_id: i64,
    user_id: i64,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let _ = client
        .execute(
            "DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2",
            &[&post_id, &user_id],
        )
        .await;
    let _ = client
        .execute(
            "UPDATE posts SET likes_count = (SELECT COUNT(*) FROM post_likes WHERE post_id = $1) WHERE id = $1",
            &[&post_id],
        )
        .await;
    Ok(true)
}

pub async fn has_user_liked_post(
    pool: &DbPool,
    post_id: i64,
    user_id: i64,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2",
            &[&post_id, &user_id],
        )
        .await?;
    Ok(!rows.is_empty())
}

pub async fn add_post_comment(
    pool: &DbPool,
    post_id: i64,
    user_id: i64,
    text: &str,
    parent_id: Option<i64>,
) -> Result<PostComment, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO post_comments (post_id, user_id, text, parent_id) VALUES ($1, $2, $3, $4) RETURNING id, post_id, user_id, text, parent_id, created_at",
            &[&post_id, &user_id, &text.to_string(), &parent_id],
        )
        .await?;
    let _ = client
        .execute(
            "UPDATE posts SET comments_count = (SELECT COUNT(*) FROM post_comments WHERE post_id = $1) WHERE id = $1",
            &[&post_id],
        )
        .await;
    let created_at: chrono::NaiveDateTime = rows[0].get("created_at");
    Ok(PostComment {
        id: rows[0].get("id"),
        post_id: rows[0].get("post_id"),
        user_id: rows[0].get("user_id"),
        text: rows[0].get("text"),
        parent_id: rows[0].get("parent_id"),
        created_at: created_at.and_utc().to_rfc3339(),
        display_name: None,
        avatar: None,
        username: None,
    })
}

pub async fn get_post_comments(
    pool: &DbPool,
    post_id: i64,
) -> Result<Vec<PostComment>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT sc.*, u.display_name, u.avatar, u.username
             FROM post_comments sc JOIN users u ON sc.user_id = u.id WHERE sc.post_id = $1 ORDER BY sc.created_at ASC",
            &[&post_id],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            PostComment {
                id: r.get("id"),
                post_id: r.get("post_id"),
                user_id: r.get("user_id"),
                text: r.get("text"),
                parent_id: r.get("parent_id"),
                created_at: created_at.and_utc().to_rfc3339(),
                display_name: r.get("display_name"),
                avatar: r.get("avatar"),
                username: r.get("username"),
            }
        })
        .collect())
}

// --- LIVE COMMENTS & REACTIONS ---

pub async fn add_live_comment(
    pool: &DbPool,
    live_id: i64,
    user_id: i64,
    text: &str,
) -> Result<LiveComment, Box<dyn std::error::Error + Send + Sync>> {
    let id = crate::snowflake::generate();
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO live_comments (id, live_id, user_id, text) VALUES ($1, $2, $3, $4) RETURNING id, live_id, user_id, text, created_at",
            &[&id, &live_id, &user_id, &text.to_string()],
        )
        .await?;
    let created_at: chrono::NaiveDateTime = rows[0].get("created_at");
    Ok(LiveComment {
        id: rows[0].get("id"),
        live_id: rows[0].get("live_id"),
        user_id: rows[0].get("user_id"),
        text: rows[0].get("text"),
        created_at: created_at.and_utc().to_rfc3339(),
        display_name: None,
        avatar: None,
        username: None,
    })
}

pub async fn get_live_comments(
    pool: &DbPool,
    live_id: i64,
) -> Result<Vec<LiveComment>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT lc.*, u.display_name, u.avatar, u.username
             FROM live_comments lc JOIN users u ON lc.user_id = u.id
             WHERE lc.live_id = $1 ORDER BY lc.created_at ASC",
            &[&live_id],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            LiveComment {
                id: r.get("id"),
                live_id: r.get("live_id"),
                user_id: r.get("user_id"),
                text: r.get("text"),
                created_at: created_at.and_utc().to_rfc3339(),
                display_name: r.get("display_name"),
                avatar: r.get("avatar"),
                username: r.get("username"),
            }
        })
        .collect())
}

pub async fn add_live_reaction(
    pool: &DbPool,
    live_id: i64,
    user_id: i64,
    reaction: &str,
) -> Result<Option<LiveReaction>, Box<dyn std::error::Error + Send + Sync>> {
    let id = crate::snowflake::generate();
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO live_reactions (id, live_id, user_id, reaction) VALUES ($1, $2, $3, $4) ON CONFLICT (live_id, user_id, reaction) DO NOTHING RETURNING *",
            &[&id, &live_id, &user_id, &reaction.to_string()],
        )
        .await?;
    if rows.is_empty() {
        return Ok(None);
    }
    let created_at: chrono::NaiveDateTime = rows[0].get("created_at");
    Ok(Some(LiveReaction {
        id: rows[0].get("id"),
        live_id: rows[0].get("live_id"),
        user_id: rows[0].get("user_id"),
        reaction: rows[0].get("reaction"),
        created_at: created_at.and_utc().to_rfc3339(),
        display_name: None,
        avatar: None,
        username: None,
    }))
}

pub async fn get_live_reactions(
    pool: &DbPool,
    live_id: i64,
) -> Result<Vec<LiveReaction>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT lr.*, u.display_name, u.avatar, u.username
             FROM live_reactions lr JOIN users u ON lr.user_id = u.id
             WHERE lr.live_id = $1 ORDER BY lr.created_at DESC",
            &[&live_id],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            LiveReaction {
                id: r.get("id"),
                live_id: r.get("live_id"),
                user_id: r.get("user_id"),
                reaction: r.get("reaction"),
                created_at: created_at.and_utc().to_rfc3339(),
                display_name: r.get("display_name"),
                avatar: r.get("avatar"),
                username: r.get("username"),
            }
        })
        .collect())
}

// --- LIVE STARS / GIFTS ---

pub async fn get_user_stars(
    pool: &DbPool,
    user_id: i64,
) -> Result<i32, Box<dyn std::error::Error + Send + Sync>> {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT stars FROM vibe_balance WHERE user_id = $1 AND date = $2",
            &[&user_id, &today],
        )
        .await?;
    if rows.is_empty() {
        return Ok(0);
    }
    let stars: Option<i32> = rows[0].get("stars");
    Ok(stars.unwrap_or(0))
}

pub async fn spend_stars(
    pool: &DbPool,
    user_id: i64,
    amount: i32,
) -> Result<i32, Box<dyn std::error::Error + Send + Sync>> {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let client = pool.get().await?;
    let stars_delta = -amount;
    let rows = client
        .query(
            "INSERT INTO vibe_balance (user_id, date, stars) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, date) DO UPDATE SET stars = vibe_balance.stars + $3
             RETURNING stars",
            &[&user_id, &today, &stars_delta],
        )
        .await?;
    let stars: Option<i32> = rows[0].get("stars");
    Ok(stars.unwrap_or(0))
}

pub async fn send_live_gift(
    pool: &DbPool,
    live_id: i64,
    sender_id: i64,
    recipient_id: i64,
    stars: i32,
    message: &str,
) -> Result<Option<LiveGift>, Box<dyn std::error::Error + Send + Sync>> {
    let balance = spend_stars(pool, sender_id, stars).await?;
    if balance < 0 {
        return Ok(None);
    }
    let id = crate::snowflake::generate();
    let client = pool.get().await?;
    let msg = message.to_string();
    let rows = client
        .query(
            "INSERT INTO live_gifts (id, live_id, sender_id, recipient_id, stars, message) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
            &[&id, &live_id, &sender_id, &recipient_id, &stars, &msg],
        )
        .await?;
    let created_at: chrono::NaiveDateTime = rows[0].get("created_at");
    Ok(Some(LiveGift {
        id: rows[0].get("id"),
        live_id: rows[0].get("live_id"),
        sender_id: rows[0].get("sender_id"),
        recipient_id: rows[0].get("recipient_id"),
        stars: rows[0].get("stars"),
        message: rows[0].get("message"),
        created_at: created_at.and_utc().to_rfc3339(),
        sender_name: None,
        sender_avatar: None,
        sender_username: None,
    }))
}

pub async fn get_live_gifts(
    pool: &DbPool,
    live_id: i64,
) -> Result<Vec<LiveGift>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT lg.*, su.display_name as sender_name, su.avatar as sender_avatar, su.username as sender_username
             FROM live_gifts lg JOIN users su ON lg.sender_id = su.id
             WHERE lg.live_id = $1 ORDER BY lg.created_at DESC",
            &[&live_id],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            LiveGift {
                id: r.get("id"),
                live_id: r.get("live_id"),
                sender_id: r.get("sender_id"),
                recipient_id: r.get("recipient_id"),
                stars: r.get("stars"),
                message: r.get("message"),
                created_at: created_at.and_utc().to_rfc3339(),
                sender_name: r.get("sender_name"),
                sender_avatar: r.get("sender_avatar"),
                sender_username: r.get("sender_username"),
            }
        })
        .collect())
}

// --- PROFILE ---

pub async fn update_profile(
    pool: &DbPool,
    user_id: i64,
    fields: &serde_json::Value,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let sets: Vec<String> = fields.as_object()
        .map(|obj| {
            obj.keys().enumerate().filter_map(|(i, key)| {
                let val = obj.get(key)?;
                if matches!(key.as_str(), "display_name" | "username" | "avatar" | "bio") && (val.is_string() || val.is_null()) {
                    Some(format!("{} = ${}", key, i + 1))
                } else {
                    None
                }
            }).collect()
        })
        .unwrap_or_default();

    if sets.is_empty() {
        return Ok(());
    }

    let client = pool.get().await?;
    let dn = fields.get("display_name").and_then(|v| v.as_str()).map(String::from);
    let un = fields.get("username").and_then(|v| v.as_str()).map(String::from);
    let av = fields.get("avatar").and_then(|v| v.as_str()).map(String::from);
    let bi = fields.get("bio").and_then(|v| v.as_str()).map(String::from);
    let uid = user_id.to_string();
    let mut params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = Vec::new();
    if let Some(ref v) = dn { params.push(v); }
    if let Some(ref v) = un { params.push(v); }
    if let Some(ref v) = av { params.push(v); }
    if let Some(ref v) = bi { params.push(v); }
    params.push(&uid);
    client.execute(
        &format!("UPDATE users SET {} WHERE id = ${}", sets.join(", "), sets.len() + 1),
        &params,
    ).await?;
    Ok(())
}

// --- TWO-STEP ---

pub async fn set_two_step_password(
    pool: &DbPool,
    user_id: i64,
    password: &str,
    hint: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let hash = hash_password(password);
    let client = pool.get().await?;
    client
        .execute(
            "INSERT INTO two_step_settings (user_id, password_hash, hint, enabled) VALUES ($1, $2, $3, 1)
             ON CONFLICT(user_id) DO UPDATE SET password_hash = $2, hint = $3, enabled = 1",
            &[&user_id, &hash, &hint.to_string()],
        )
        .await?;
    Ok(())
}

pub async fn verify_two_step_password(
    pool: &DbPool,
    user_id: i64,
    password: &str,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT password_hash, enabled FROM two_step_settings WHERE user_id = $1",
            &[&user_id],
        )
        .await?;
    if let Some(row) = rows.first() {
        let enabled: i32 = row.get("enabled");
        if enabled == 0 {
            return Ok(true);
        }
        let password_hash: String = row.get("password_hash");
        return Ok(hash_password(password) == password_hash);
    }
    Ok(true)
}

pub async fn disable_two_step(
    pool: &DbPool,
    user_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "UPDATE two_step_settings SET enabled = 0 WHERE user_id = $1",
            &[&user_id],
        )
        .await?;
    Ok(())
}

pub async fn get_two_step_status(
    pool: &DbPool,
    user_id: i64,
) -> Result<TwoStepStatus, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT enabled, hint FROM two_step_settings WHERE user_id = $1",
            &[&user_id],
        )
        .await?;
    if let Some(row) = rows.first() {
        Ok(TwoStepStatus {
            enabled: row.get("enabled"),
            hint: row.get("hint"),
        })
    } else {
        Ok(TwoStepStatus {
            enabled: 0,
            hint: String::new(),
        })
    }
}

// --- BLOCKED USERS ---

pub async fn block_user(
    pool: &DbPool,
    user_id: i64,
    blocked_user_id: i64,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let result = client
        .execute(
            "INSERT INTO blocked_users (user_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            &[&user_id, &blocked_user_id],
        )
        .await;
    Ok(result.is_ok())
}

pub async fn unblock_user(
    pool: &DbPool,
    user_id: i64,
    blocked_user_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "DELETE FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2",
            &[&user_id, &blocked_user_id],
        )
        .await?;
    Ok(())
}

pub async fn get_blocked_users(
    pool: &DbPool,
    user_id: i64,
) -> Result<Vec<User>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT u.id, u.phone, u.username, u.display_name, u.avatar, u.bio, u.country_code
             FROM blocked_users b JOIN users u ON b.blocked_user_id = u.id WHERE b.user_id = $1",
            &[&user_id],
        )
        .await?;
    Ok(rows.iter().map(|r| row_to_user(r)).collect())
}

pub async fn is_blocked(
    pool: &DbPool,
    user_id: i64,
    target_user_id: i64,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT id FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2",
            &[&user_id, &target_user_id],
        )
        .await?;
    if !rows.is_empty() {
        return Ok(true);
    }
    let rows = client
        .query(
            "SELECT id FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2",
            &[&target_user_id, &user_id],
        )
        .await?;
    Ok(!rows.is_empty())
}

// --- SESSIONS ---

pub async fn get_user_sessions(
    pool: &DbPool,
    user_id: i64,
) -> Result<Vec<Session>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT id, device_name, device_id, created_at::text, last_active::text FROM sessions WHERE user_id = $1 ORDER BY last_active DESC",
            &[&user_id],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| Session {
            id: r.get("id"),
            device_name: r.get("device_name"),
            device_id: r.get("device_id"),
            created_at: r.get("created_at"),
            last_active: r.get("last_active"),
        })
        .collect())
}

pub async fn update_session_activity(
    pool: &DbPool,
    token: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE token = $1",
            &[&token.to_string()],
        )
        .await?;
    Ok(())
}

pub async fn terminate_session(
    pool: &DbPool,
    session_id: i64,
    user_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "DELETE FROM sessions WHERE id = $1 AND user_id = $2",
            &[&session_id, &user_id],
        )
        .await?;
    Ok(())
}

pub async fn terminate_other_sessions(
    pool: &DbPool,
    current_token: &str,
    user_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "DELETE FROM sessions WHERE user_id = $1 AND token != $2",
            &[&user_id, &current_token.to_string()],
        )
        .await?;
    Ok(())
}

// --- PRIVACY ---

pub async fn get_privacy_settings(
    pool: &DbPool,
    user_id: i64,
) -> Result<PrivacySettings, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT * FROM privacy_settings WHERE user_id = $1",
            &[&user_id],
        )
        .await?;
    if let Some(row) = rows.first() {
        Ok(PrivacySettings {
            user_id: row.get("user_id"),
            last_seen: row.get("last_seen"),
            profile_photo: row.get("profile_photo"),
            bio: row.get("bio"),
            status: row.get("status"),
            calls: row.get("calls"),
            read_receipts: row.get("read_receipts"),
            message_history: row.get("message_history"),
        })
    } else {
        client
            .execute("INSERT INTO privacy_settings (user_id) VALUES ($1)", &[&user_id])
            .await?;
        Ok(PrivacySettings {
            user_id,
            last_seen: "everyone".to_string(),
            profile_photo: "everyone".to_string(),
            bio: "everyone".to_string(),
            status: "contacts".to_string(),
            calls: "everyone".to_string(),
            read_receipts: 1,
            message_history: 1,
        })
    }
}

pub async fn update_privacy_settings(
    pool: &DbPool,
    user_id: i64,
    fields: &serde_json::Value,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let allowed = [
        "last_seen", "profile_photo", "bio", "status", "calls", "read_receipts", "message_history",
    ];
    let mut sets = Vec::new();
    let mut vals: Vec<(Option<String>, Option<i32>)> = Vec::new();

    for key in allowed {
        if let Some(v) = fields.get(key) {
            if let Some(s) = v.as_str() {
                sets.push(format!("{} = ${}", key, sets.len() + 1));
                vals.push((Some(s.to_string()), None));
            } else if let Some(n) = v.as_i64() {
                sets.push(format!("{} = ${}", key, sets.len() + 1));
                vals.push((None, Some(n as i32)));
            }
        }
    }

    if sets.is_empty() {
        return Ok(());
    }

    let client = pool.get().await?;
    let _ = client
        .execute("INSERT INTO privacy_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING", &[&user_id])
        .await;

    let mut params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = Vec::new();
    for (s, i) in &vals {
        if let Some(ref s) = s { params.push(s); }
        else if let Some(ref i) = i { params.push(i); }
    }
    params.push(&user_id);
    client.execute(
        &format!("UPDATE privacy_settings SET {} WHERE user_id = ${}", sets.join(", "), sets.len() + 1),
        &params,
    ).await?;
    Ok(())
}

// --- DELETE ACCOUNT ---

pub async fn schedule_account_deletion(
    pool: &DbPool,
    user_id: i64,
    days: i32,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let delete_at = Utc::now() + chrono::Duration::days(days as i64);
    let delete_naive = delete_at.naive_utc();
    let client = pool.get().await?;
    client
        .execute(
            "UPDATE users SET delete_at = $1 WHERE id = $2",
            &[&delete_naive, &user_id],
        )
        .await?;
    Ok(())
}

pub async fn cancel_account_deletion(
    pool: &DbPool,
    user_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "UPDATE users SET delete_at = NULL WHERE id = $1",
            &[&user_id],
        )
        .await?;
    Ok(())
}

pub async fn get_account_deletion(
    pool: &DbPool,
    user_id: i64,
) -> Result<Option<String>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query("SELECT delete_at FROM users WHERE id = $1", &[&user_id])
        .await?;
    if let Some(row) = rows.first() {
        let delete_at: Option<String> = row.get("delete_at");
        return Ok(delete_at);
    }
    Ok(None)
}

// --- VIDEOS ---

pub async fn create_video(
    pool: &DbPool,
    user_id: i64,
    video_url: &str,
    thumbnail: &str,
    caption: &str,
) -> Result<Video, Box<dyn std::error::Error + Send + Sync>> {
    let video_id = snowflake::generate();
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO videos (id, user_id, video_url, thumbnail, caption) VALUES ($1, $2, $3, $4, $5) RETURNING id, video_url, thumbnail, caption, created_at",
            &[&video_id, &user_id, &video_url.to_string(), &thumbnail.to_string(), &caption.to_string()],
        )
        .await?;
    let created_at: chrono::NaiveDateTime = rows[0].get("created_at");
    info!(user_id = user_id, video_id = video_id, action = "create_video", "Video creado en DB");
    Ok(Video {
        id: rows[0].get("id"),
        user_id,
        video_url: rows[0].get("video_url"),
        thumbnail: rows[0].get("thumbnail"),
        caption: rows[0].get("caption"),
        likes_count: Some(0),
        comments_count: Some(0),
        created_at: created_at.and_utc().to_rfc3339(),
        display_name: None,
        avatar: None,
        username: None,
    })
}

pub async fn get_videos(
    pool: &DbPool,
    cursor: Option<String>,
    limit: i64,
) -> Result<Vec<Video>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = if let Some(ref c) = cursor {
        client
            .query(
                "SELECT v.*, u.display_name, u.avatar, u.username
                 FROM videos v JOIN users u ON v.user_id = u.id
                 WHERE v.created_at < $1
                 ORDER BY v.created_at DESC FETCH FIRST $2 ROWS ONLY",
                &[c, &limit],
            )
            .await?
    } else {
        client
            .query(
                "SELECT v.*, u.display_name, u.avatar, u.username
                 FROM videos v JOIN users u ON v.user_id = u.id
                 ORDER BY v.created_at DESC FETCH FIRST $1 ROWS ONLY",
                &[&limit],
            )
            .await?
    };
    Ok(rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            Video {
                id: r.get("id"),
                user_id: r.get("user_id"),
                video_url: r.get("video_url"),
                thumbnail: r.get("thumbnail"),
                caption: r.get("caption"),
                likes_count: r.get("likes_count"),
                comments_count: r.get("comments_count"),
                created_at: created_at.and_utc().to_rfc3339(),
                display_name: r.get("display_name"),
                avatar: r.get("avatar"),
                username: r.get("username"),
            }
        })
        .collect())
}

pub async fn like_video(
    pool: &DbPool,
    video_id: i64,
    user_id: i64,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let result = client
        .execute(
            "INSERT INTO video_likes (video_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            &[&video_id, &user_id],
        )
        .await;
    if result.is_ok() {
        let _ = client
            .execute(
                "UPDATE videos SET likes_count = (SELECT COUNT(*) FROM video_likes WHERE video_id = $1) WHERE id = $1",
                &[&video_id],
            )
            .await;
        Ok(true)
    } else {
        Ok(false)
    }
}

pub async fn unlike_video(
    pool: &DbPool,
    video_id: i64,
    user_id: i64,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let _ = client
        .execute(
            "DELETE FROM video_likes WHERE video_id = $1 AND user_id = $2",
            &[&video_id, &user_id],
        )
        .await;
    let _ = client
        .execute(
            "UPDATE videos SET likes_count = (SELECT COUNT(*) FROM video_likes WHERE video_id = $1) WHERE id = $1",
            &[&video_id],
        )
        .await;
    Ok(true)
}

pub async fn get_video_likes(
    pool: &DbPool,
    video_id: i64,
) -> Result<Vec<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT u.id, u.display_name, u.avatar FROM video_likes vl JOIN users u ON vl.user_id = u.id WHERE vl.video_id = $1",
            &[&video_id],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<_, i64>("id"),
                "display_name": r.get::<_, String>("display_name"),
                "avatar": r.get::<_, String>("avatar"),
            })
        })
        .collect())
}

pub async fn add_video_comment(
    pool: &DbPool,
    video_id: i64,
    user_id: i64,
    text: &str,
) -> Result<VideoComment, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO video_comments (video_id, user_id, text) VALUES ($1, $2, $3) RETURNING id, video_id, user_id, text, created_at",
            &[&video_id, &user_id, &text.to_string()],
        )
        .await?;
    let _ = client
        .execute(
            "UPDATE videos SET comments_count = (SELECT COUNT(*) FROM video_comments WHERE video_id = $1) WHERE id = $1",
            &[&video_id],
        )
        .await;
    let created_at: chrono::NaiveDateTime = rows[0].get("created_at");
    Ok(VideoComment {
        id: rows[0].get("id"),
        video_id: rows[0].get("video_id"),
        user_id: rows[0].get("user_id"),
        text: rows[0].get("text"),
        created_at: created_at.and_utc().to_rfc3339(),
        display_name: None,
        avatar: None,
        username: None,
    })
}

pub async fn get_video_comments(
    pool: &DbPool,
    video_id: i64,
) -> Result<Vec<VideoComment>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT vc.*, u.display_name, u.avatar, u.username
             FROM video_comments vc JOIN users u ON vc.user_id = u.id WHERE vc.video_id = $1 ORDER BY vc.created_at DESC",
            &[&video_id],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            VideoComment {
                id: r.get("id"),
                video_id: r.get("video_id"),
                user_id: r.get("user_id"),
                text: r.get("text"),
                created_at: created_at.and_utc().to_rfc3339(),
                display_name: r.get("display_name"),
                avatar: r.get("avatar"),
                username: r.get("username"),
            }
        })
        .collect())
}

pub async fn has_user_liked_video(
    pool: &DbPool,
    video_id: i64,
    user_id: i64,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT id FROM video_likes WHERE video_id = $1 AND user_id = $2",
            &[&video_id, &user_id],
        )
        .await?;
    Ok(!rows.is_empty())
}

// --- LIVES ---

pub async fn start_live(
    pool: &DbPool,
    user_id: i64,
    title: &str,
) -> Result<Live, Box<dyn std::error::Error + Send + Sync>> {
    let live_id = snowflake::generate();
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO lives (id, user_id, title) VALUES ($1, $2, $3) RETURNING id, user_id, title, status, started_at",
            &[&live_id, &user_id, &title.to_string()],
        )
        .await?;
    let started_at: chrono::NaiveDateTime = rows[0].get("started_at");
    info!(user_id = user_id, live_id = live_id, action = "start_live", "Live creado en DB");
    Ok(Live {
        id: rows[0].get("id"),
        user_id: rows[0].get("user_id"),
        title: rows[0].get("title"),
        status: "live".to_string(),
        started_at: started_at.and_utc().to_rfc3339(),
        ended_at: None,
        display_name: None,
        avatar: None,
        username: None,
    })
}

pub async fn end_live(
    pool: &DbPool,
    live_id: i64,
    user_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "UPDATE lives SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2",
            &[&live_id, &user_id],
        )
        .await?;
    Ok(())
}

pub async fn get_active_lives(
    pool: &DbPool,
) -> Result<Vec<Live>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT l.*, u.display_name, u.avatar, u.username
             FROM lives l JOIN users u ON l.user_id = u.id WHERE l.status = 'live' ORDER BY l.started_at DESC",
            &[],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let started_at: chrono::NaiveDateTime = r.get("started_at");
            Live {
                id: r.get("id"),
                user_id: r.get("user_id"),
                title: r.get("title"),
                status: "live".to_string(),
                started_at: started_at.and_utc().to_rfc3339(),
                ended_at: None,
                display_name: r.get("display_name"),
                avatar: r.get("avatar"),
                username: r.get("username"),
            }
        })
        .collect())
}

pub async fn create_story(
    pool: &DbPool,
    user_id: i64,
    media_url: &str,
) -> Result<Story, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let id = snowflake::generate();
    let row = client
        .query_one(
            "INSERT INTO stories (id, user_id, media_url, expires_at)
             VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')
             RETURNING *",
            &[&id, &user_id, &media_url],
        )
        .await?;
    let created_at: chrono::NaiveDateTime = row.get("created_at");
    let expires_at: chrono::NaiveDateTime = row.get("expires_at");
    Ok(Story {
        id: row.get("id"),
        user_id: row.get("user_id"),
        media_url: row.get("media_url"),
        created_at: created_at.and_utc().to_rfc3339(),
        expires_at: expires_at.and_utc().to_rfc3339(),
        views_count: row.get("views_count"),
        display_name: None,
        avatar: None,
        username: None,
    })
}

pub async fn get_stories(
    pool: &DbPool,
    user_id: i64,
) -> Result<Vec<StoryGroup>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT s.*, u.display_name, u.avatar, u.username
             FROM stories s JOIN users u ON s.user_id = u.id
             WHERE s.expires_at > NOW()
               AND (s.user_id = $1 OR s.user_id IN (SELECT contact_user_id FROM contacts WHERE user_id = $1))
             ORDER BY s.user_id, s.created_at DESC",
            &[&user_id],
        )
        .await?;
    let mut groups: Vec<StoryGroup> = Vec::new();
    for r in &rows {
        let uid: i64 = r.get("user_id");
        if let Some(g) = groups.iter_mut().find(|g: &&mut StoryGroup| g.user.id == uid) {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            let expires_at: chrono::NaiveDateTime = r.get("expires_at");
            g.stories.push(StoryItem {
                id: r.get("id"),
                media_url: r.get("media_url"),
                created_at: created_at.and_utc().to_rfc3339(),
                expires_at: expires_at.and_utc().to_rfc3339(),
                views_count: r.get("views_count"),
            });
        } else {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            let expires_at: chrono::NaiveDateTime = r.get("expires_at");
            groups.push(StoryGroup {
                user: StoryUser {
                    id: uid,
                    display_name: r.get("display_name"),
                    avatar: r.get("avatar"),
                    username: r.get("username"),
                },
                stories: vec![StoryItem {
                    id: r.get("id"),
                    media_url: r.get("media_url"),
                    created_at: created_at.and_utc().to_rfc3339(),
                    expires_at: expires_at.and_utc().to_rfc3339(),
                    views_count: r.get("views_count"),
                }],
            });
        }
    }
    Ok(groups)
}

pub async fn view_story(
    pool: &DbPool,
    story_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "UPDATE stories SET views_count = views_count + 1 WHERE id = $1",
            &[&story_id],
        )
        .await?;
    Ok(())
}

// --- CHANNELS ---

pub async fn create_channel(
    pool: &DbPool,
    name: &str,
    description: &str,
    avatar: &str,
    owner_id: i64,
) -> Result<Channel, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO channels (name, description, avatar, owner_id) VALUES ($1, $2, $3, $4) RETURNING id, name, description, avatar, owner_id, created_at",
            &[&name.to_string(), &description.to_string(), &avatar.to_string(), &owner_id],
        )
        .await?;
    let created_at: chrono::NaiveDateTime = rows[0].get("created_at");
    Ok(Channel {
        id: rows[0].get("id"),
        name: rows[0].get("name"),
        description: rows[0].get("description"),
        avatar: rows[0].get("avatar"),
        owner_id: rows[0].get("owner_id"),
        subscribers: Some(0),
        display_name: None,
        created_at: created_at.and_utc().to_rfc3339(),
    })
}

pub async fn get_channels(
    pool: &DbPool,
) -> Result<Vec<Channel>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT c.*, u.display_name,
             (SELECT COUNT(*) FROM channel_subscribers WHERE channel_id = c.id) as subscribers
             FROM channels c JOIN users u ON c.owner_id = u.id ORDER BY c.created_at DESC",
            &[],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            Channel {
                id: r.get("id"),
                name: r.get("name"),
                description: r.get("description"),
                avatar: r.get("avatar"),
                owner_id: r.get("owner_id"),
                subscribers: r.get("subscribers"),
                display_name: r.get("display_name"),
                created_at: created_at.and_utc().to_rfc3339(),
            }
        })
        .collect())
}

pub async fn subscribe_channel(
    pool: &DbPool,
    user_id: i64,
    channel_id: i64,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let result = client
        .execute(
            "INSERT INTO channel_subscribers (user_id, channel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            &[&user_id, &channel_id],
        )
        .await;
    Ok(result.is_ok())
}

pub async fn get_channel_subscribers_ids(
    pool: &DbPool,
    channel_id: i64,
) -> Result<Vec<i64>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT user_id FROM channel_subscribers WHERE channel_id = $1",
            &[&channel_id],
        )
        .await?;
    Ok(rows.into_iter().map(|r| r.get("user_id")).collect())
}

pub async fn get_subscribed_channels(
    pool: &DbPool,
    user_id: i64,
) -> Result<Vec<i64>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT channel_id FROM channel_subscribers WHERE user_id = $1",
            &[&user_id],
        )
        .await?;
    Ok(rows.iter().map(|r| r.get("channel_id")).collect())
}

pub async fn get_channel_posts(
    pool: &DbPool,
    channel_id: i64,
) -> Result<Vec<ChannelPost>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT cp.*, u.display_name, u.avatar
             FROM channel_posts cp JOIN users u ON cp.sender_id = u.id
             WHERE cp.channel_id = $1 ORDER BY cp.created_at DESC",
            &[&channel_id],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            ChannelPost {
                id: r.get("id"),
                channel_id: r.get("channel_id"),
                sender_id: r.get("sender_id"),
                text: r.get("text"),
                media: r.get("media"),
                media_type: r.get("media_type"),
                likes_count: r.get("likes_count"),
                comments_count: r.get("comments_count"),
                display_name: r.get("display_name"),
                avatar: r.get("avatar"),
                created_at: created_at.and_utc().to_rfc3339(),
            }
        })
        .collect())
}

pub async fn create_channel_post(
    pool: &DbPool,
    channel_id: i64,
    sender_id: i64,
    text: &str,
    media: &str,
    media_type: &str,
) -> Result<ChannelPost, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let id = snowflake::generate();
    let rows = client
        .query(
            "INSERT INTO channel_posts (id, channel_id, sender_id, text, media, media_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, channel_id, sender_id, text, media, media_type, created_at",
            &[&id, &channel_id, &sender_id, &text.to_string(), &media.to_string(), &media_type.to_string()],
        )
        .await?;
    let created_at: chrono::NaiveDateTime = rows[0].get("created_at");
    Ok(ChannelPost {
        id: rows[0].get("id"),
        channel_id: rows[0].get("channel_id"),
        sender_id: rows[0].get("sender_id"),
        text: rows[0].get("text"),
        media: rows[0].get("media"),
        media_type: rows[0].get("media_type"),
        likes_count: Some(0),
        comments_count: Some(0),
        display_name: None,
        avatar: None,
        created_at: created_at.and_utc().to_rfc3339(),
    })
}

pub async fn get_channel_subscribers(
    pool: &DbPool,
    channel_id: i64,
) -> Result<Vec<User>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT u.id, u.phone, u.username, u.display_name, u.avatar, u.bio, u.country_code
             FROM channel_subscribers cs JOIN users u ON cs.user_id = u.id WHERE cs.channel_id = $1",
            &[&channel_id],
        )
        .await?;
    Ok(rows.iter().map(|r| row_to_user(r)).collect())
}

// --- COMMUNITIES ---

pub async fn create_community(
    pool: &DbPool,
    name: &str,
    description: &str,
    avatar: &str,
    owner_id: i64,
) -> Result<Community, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO communities (name, description, avatar, owner_id) VALUES ($1, $2, $3, $4) RETURNING id, name, description, avatar, owner_id, created_at",
            &[&name.to_string(), &description.to_string(), &avatar.to_string(), &owner_id],
        )
        .await?;
    let created_at: chrono::NaiveDateTime = rows[0].get("created_at");
    Ok(Community {
        id: rows[0].get("id"),
        name: rows[0].get("name"),
        description: rows[0].get("description"),
        avatar: rows[0].get("avatar"),
        owner_id: rows[0].get("owner_id"),
        display_name: None,
        members_count: Some(0),
        created_at: created_at.and_utc().to_rfc3339(),
    })
}

pub async fn get_communities(
    pool: &DbPool,
) -> Result<Vec<Community>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT c.*, u.display_name,
             (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as members_count
             FROM communities c JOIN users u ON c.owner_id = u.id ORDER BY c.created_at DESC",
            &[],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            Community {
                id: r.get("id"),
                name: r.get("name"),
                description: r.get("description"),
                avatar: r.get("avatar"),
                owner_id: r.get("owner_id"),
                display_name: r.get("display_name"),
                members_count: r.get("members_count"),
                created_at: created_at.and_utc().to_rfc3339(),
            }
        })
        .collect())
}

pub async fn join_community(
    pool: &DbPool,
    user_id: i64,
    community_id: i64,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let result = client
        .execute(
            "INSERT INTO community_members (user_id, community_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            &[&user_id, &community_id],
        )
        .await;
    Ok(result.is_ok())
}

pub async fn get_joined_communities(
    pool: &DbPool,
    user_id: i64,
) -> Result<Vec<i64>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT community_id FROM community_members WHERE user_id = $1",
            &[&user_id],
        )
        .await?;
    Ok(rows.iter().map(|r| r.get("community_id")).collect())
}

// --- POLLS ---

pub async fn create_poll(
    pool: &DbPool,
    chat_id: i64,
    creator_id: i64,
    question: &str,
    options: &[String],
    multiple_choice: i32,
) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO polls (chat_id, creator_id, question, multiple_choice) VALUES ($1, $2, $3, $4) RETURNING id",
            &[&chat_id, &creator_id, &question.to_string(), &multiple_choice],
        )
        .await?;
    let poll_id: i64 = rows[0].get("id");
    for opt in options {
        client
            .execute(
                "INSERT INTO poll_options (poll_id, text) VALUES ($1, $2)",
                &[&poll_id, &opt.to_string()],
            )
            .await?;
    }
    Ok(poll_id)
}

pub async fn get_poll(
    pool: &DbPool,
    poll_id: i64,
) -> Result<Option<Poll>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT * FROM polls WHERE id = $1",
            &[&poll_id],
        )
        .await?;
    if rows.is_empty() {
        return Ok(None);
    }
    let created_at: chrono::NaiveDateTime = rows[0].get("created_at");
    let opt_rows = client
        .query(
            "SELECT id, poll_id, text FROM poll_options WHERE poll_id = $1",
            &[&poll_id],
        )
        .await?;
    let options: Vec<PollOption> = opt_rows
        .iter()
        .map(|r| PollOption {
            id: r.get("id"),
            poll_id: r.get("poll_id"),
            text: r.get("text"),
        })
        .collect();
    let vote_rows = client
        .query(
            "SELECT option_id, COUNT(*) as votes FROM poll_votes WHERE poll_id = $1 GROUP BY option_id",
            &[&poll_id],
        )
        .await?;
    let votes: Vec<PollVote> = vote_rows
        .iter()
        .map(|r| PollVote {
            option_id: r.get("option_id"),
            votes: r.get("votes"),
        })
        .collect();
    Ok(Some(Poll {
        id: rows[0].get("id"),
        chat_id: rows[0].get("chat_id"),
        creator_id: rows[0].get("creator_id"),
        question: rows[0].get("question"),
        multiple_choice: rows[0].get("multiple_choice"),
        options,
        votes,
        created_at: created_at.and_utc().to_rfc3339(),
    }))
}

pub async fn vote_poll(
    pool: &DbPool,
    user_id: i64,
    option_id: i64,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let result = client
        .execute(
            "INSERT INTO poll_votes (user_id, option_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            &[&user_id, &option_id],
        )
        .await;
    Ok(result.is_ok())
}

// --- PRODUCTS ---

pub async fn get_products(
    pool: &DbPool,
    category: &str,
    cursor: Option<chrono::NaiveDateTime>,
    limit: i64,
) -> Result<Vec<Product>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = match (category.is_empty() || category == "all", cursor) {
        (true, None) => {
            client
                .query(
                    "SELECT p.*, u.display_name, u.avatar FROM products p JOIN users u ON p.seller_id = u.id ORDER BY p.created_at DESC FETCH FIRST $1 ROWS ONLY",
                    &[&limit],
                )
                .await?
        }
        (true, Some(c)) => {
            client
                .query(
                    "SELECT p.*, u.display_name, u.avatar FROM products p JOIN users u ON p.seller_id = u.id WHERE p.created_at < $1 ORDER BY p.created_at DESC FETCH FIRST $2 ROWS ONLY",
                    &[&c, &limit],
                )
                .await?
        }
        (false, None) => {
            client
                .query(
                    "SELECT p.*, u.display_name, u.avatar FROM products p JOIN users u ON p.seller_id = u.id WHERE p.category = $1 ORDER BY p.created_at DESC FETCH FIRST $2 ROWS ONLY",
                    &[&category.to_string(), &limit],
                )
                .await?
        }
        (false, Some(c)) => {
            client
                .query(
                    "SELECT p.*, u.display_name, u.avatar FROM products p JOIN users u ON p.seller_id = u.id WHERE p.category = $1 AND p.created_at < $2 ORDER BY p.created_at DESC FETCH FIRST $3 ROWS ONLY",
                    &[&category.to_string(), &c, &limit],
                )
                .await?
        }
    };
    Ok(rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            Product {
                id: r.get("id"),
                seller_id: r.get("seller_id"),
                name: r.get("name"),
                description: r.get("description"),
                price: r.get("price"),
                currency: r.get("currency"),
                images: r.get("images"),
                category: r.get("category"),
                stock: r.get("stock"),
                display_name: r.get("display_name"),
                avatar: r.get("avatar"),
                created_at: created_at.and_utc().to_rfc3339(),
            }
        })
        .collect())
}

pub async fn create_product(
    pool: &DbPool,
    seller_id: i64,
    name: &str,
    description: &str,
    price: f64,
    currency: &str,
    images: &str,
    category: &str,
    stock: i32,
) -> Result<Product, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO products (seller_id, name, description, price, currency, images, category, stock) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, seller_id, name, description, price, currency, images, category, stock, created_at",
            &[&seller_id, &name.to_string(), &description.to_string(), &(serde_json::json!(price)), &currency.to_string(), &images.to_string(), &category.to_string(), &stock],
        )
        .await?;
    let created_at: chrono::NaiveDateTime = rows[0].get("created_at");
    Ok(Product {
        id: rows[0].get("id"),
        seller_id: rows[0].get("seller_id"),
        name: rows[0].get("name"),
        description: rows[0].get("description"),
        price: rows[0].get("price"),
        currency: rows[0].get("currency"),
        images: rows[0].get("images"),
        category: rows[0].get("category"),
        stock: rows[0].get("stock"),
        display_name: None,
        avatar: None,
        created_at: created_at.and_utc().to_rfc3339(),
    })
}

pub async fn buy_product(
    pool: &DbPool,
    buyer_id: i64,
    product_id: i64,
    quantity: i32,
) -> Result<Option<Order>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT id, price, name, images, stock FROM products WHERE id = $1",
            &[&product_id],
        )
        .await?;
    if rows.is_empty() {
        return Ok(None);
    }
    let stock: i32 = rows[0].get("stock");
    if stock < quantity {
        return Ok(None);
    }
    let price: serde_json::Value = rows[0].get("price");
    let total_val = price.as_f64().unwrap_or(0.0) * quantity as f64;
    let total = serde_json::json!(total_val);
    let name: String = rows[0].get("name");
    let images: String = rows[0].get("images");
    let order_rows = client
        .query(
            "INSERT INTO orders (buyer_id, product_id, quantity, total) VALUES ($1, $2, $3, $4) RETURNING id, buyer_id, product_id, quantity, total, status, created_at",
            &[&buyer_id, &product_id, &quantity, &total],
        )
        .await?;
    client.execute("UPDATE products SET stock = stock - $1 WHERE id = $2", &[&quantity, &product_id]).await?;
    let created_at: chrono::NaiveDateTime = order_rows[0].get("created_at");
    Ok(Some(Order {
        id: order_rows[0].get("id"),
        buyer_id: order_rows[0].get("buyer_id"),
        product_id: order_rows[0].get("product_id"),
        quantity: order_rows[0].get("quantity"),
        total: order_rows[0].get("total"),
        status: order_rows[0].get("status"),
        name: Some(name),
        images: Some(images),
        created_at: created_at.and_utc().to_rfc3339(),
    }))
}

pub async fn get_my_orders(
    pool: &DbPool,
    user_id: i64,
) -> Result<Vec<Order>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT o.*, p.name, p.images FROM orders o JOIN products p ON o.product_id = p.id WHERE o.buyer_id = $1 ORDER BY o.created_at DESC",
            &[&user_id],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            Order {
                id: r.get("id"),
                buyer_id: r.get("buyer_id"),
                product_id: r.get("product_id"),
                quantity: r.get("quantity"),
                total: r.get("total"),
                status: r.get("status"),
                name: r.get("name"),
                images: r.get("images"),
                created_at: created_at.and_utc().to_rfc3339(),
            }
        })
        .collect())
}

// --- WISHLISTS ---

pub async fn create_wishlist(
    pool: &DbPool,
    user_id: i64,
    name: &str,
    is_public: i32,
) -> Result<Wishlist, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO wishlists (user_id, name, is_public) VALUES ($1, $2, $3) RETURNING id, user_id, name, is_public, created_at",
            &[&user_id, &name.to_string(), &is_public],
        )
        .await?;
    let created_at: chrono::NaiveDateTime = rows[0].get("created_at");
    Ok(Wishlist {
        id: rows[0].get("id"),
        user_id: rows[0].get("user_id"),
        name: rows[0].get("name"),
        is_public: rows[0].get("is_public"),
        items: None,
        created_at: created_at.and_utc().to_rfc3339(),
    })
}

pub async fn get_wishlists(
    pool: &DbPool,
    user_id: i64,
) -> Result<Vec<Wishlist>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT w.*, COALESCE(json_agg(json_build_object('product_id', wi.product_id, 'name', p.name, 'price', p.price)) FILTER (WHERE wi.product_id IS NOT NULL), '[]') as items
             FROM wishlists w LEFT JOIN wishlist_items wi ON w.id = wi.wishlist_id LEFT JOIN products p ON wi.product_id = p.id
             WHERE w.user_id = $1 GROUP BY w.id ORDER BY w.created_at DESC",
            &[&user_id],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            Wishlist {
                id: r.get("id"),
                user_id: r.get("user_id"),
                name: r.get("name"),
                is_public: r.get("is_public"),
                items: r.get("items"),
                created_at: created_at.and_utc().to_rfc3339(),
            }
        })
        .collect())
}

pub async fn add_to_wishlist(
    pool: &DbPool,
    wishlist_id: i64,
    product_id: i64,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let result = client
        .execute(
            "INSERT INTO wishlist_items (wishlist_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            &[&wishlist_id, &product_id],
        )
        .await;
    Ok(result.is_ok())
}

// --- FLASH DEALS ---

pub async fn get_flash_deals(
    pool: &DbPool,
) -> Result<Vec<FlashDeal>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT fd.*, p.name, p.price, p.images
             FROM flash_deals fd JOIN products p ON fd.product_id = p.id
             WHERE fd.ends_at > NOW() AND fd.starts_at <= NOW() ORDER BY fd.ends_at ASC",
            &[],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            FlashDeal {
                id: r.get("id"),
                product_id: r.get("product_id"),
                discount_percent: r.get("discount_percent"),
                starts_at: r.get("starts_at"),
                ends_at: r.get("ends_at"),
                max_quantity: r.get("max_quantity"),
                sold: r.get("sold"),
                name: r.get("name"),
                price: r.get("price"),
                images: r.get("images"),
            }
        })
        .collect())
}

// --- MEMES ---

pub async fn create_meme(
    pool: &DbPool,
    user_id: i64,
    image_url: &str,
    caption: &str,
    template: &str,
) -> Result<Meme, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO memes (user_id, image_url, caption, template) VALUES ($1, $2, $3, $4) RETURNING id, user_id, image_url, caption, template, created_at",
            &[&user_id, &image_url.to_string(), &caption.to_string(), &template.to_string()],
        )
        .await?;
    let created_at: chrono::NaiveDateTime = rows[0].get("created_at");
    Ok(Meme {
        id: rows[0].get("id"),
        user_id: rows[0].get("user_id"),
        image_url: rows[0].get("image_url"),
        caption: rows[0].get("caption"),
        template: rows[0].get("template"),
        likes_count: Some(0),
        display_name: None,
        avatar: None,
        created_at: created_at.and_utc().to_rfc3339(),
    })
}

pub async fn get_memes(
    pool: &DbPool,
) -> Result<Vec<Meme>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT m.*, u.display_name, u.avatar FROM memes m JOIN users u ON m.user_id = u.id ORDER BY m.created_at DESC",
            &[],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            Meme {
                id: r.get("id"),
                user_id: r.get("user_id"),
                image_url: r.get("image_url"),
                caption: r.get("caption"),
                template: r.get("template"),
                likes_count: r.get("likes_count"),
                display_name: r.get("display_name"),
                avatar: r.get("avatar"),
                created_at: created_at.and_utc().to_rfc3339(),
            }
        })
        .collect())
}

pub async fn like_meme(
    pool: &DbPool,
    meme_id: i64,
    user_id: i64,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let result = client
        .execute(
            "INSERT INTO meme_likes (meme_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            &[&meme_id, &user_id],
        )
        .await;
    if result.is_ok() {
        let _ = client
            .execute(
                "UPDATE memes SET likes_count = (SELECT COUNT(*) FROM meme_likes WHERE meme_id = $1) WHERE id = $1",
                &[&meme_id],
            )
            .await;
    }
    Ok(result.is_ok())
}

// --- STICKERS ---

pub async fn get_sticker_packs(
    pool: &DbPool,
) -> Result<Vec<StickerPack>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT sp.*, u.display_name FROM sticker_packs sp JOIN users u ON sp.author_id = u.id ORDER BY sp.created_at DESC",
            &[],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            StickerPack {
                id: r.get("id"),
                name: r.get("name"),
                author_id: r.get("author_id"),
                price: r.get("price"),
                display_name: r.get("display_name"),
                created_at: created_at.and_utc().to_rfc3339(),
            }
        })
        .collect())
}

pub async fn get_stickers(
    pool: &DbPool,
    pack_id: i64,
) -> Result<Vec<Sticker>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT s.*, sp.name as pack_name FROM stickers s JOIN sticker_packs sp ON s.pack_id = sp.id WHERE s.pack_id = $1 ORDER BY s.created_at ASC",
            &[&pack_id],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let created_at: chrono::NaiveDateTime = r.get("created_at");
            Sticker {
                id: r.get("id"),
                pack_id: r.get("pack_id"),
                image_url: r.get("image_url"),
                emoji: r.get("emoji"),
                pack_name: r.get("pack_name"),
                created_at: created_at.and_utc().to_rfc3339(),
            }
        })
        .collect())
}

pub async fn purchase_sticker(
    pool: &DbPool,
    user_id: i64,
    pack_id: i64,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let result = client
        .execute(
            "INSERT INTO sticker_purchases (user_id, pack_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            &[&user_id, &pack_id],
        )
        .await;
    Ok(result.is_ok())
}

pub async fn get_my_stickers(
    pool: &DbPool,
    user_id: i64,
) -> Result<Vec<i64>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT pack_id FROM sticker_purchases WHERE user_id = $1",
            &[&user_id],
        )
        .await?;
    Ok(rows.iter().map(|r| r.get("pack_id")).collect())
}

// --- VIBE BALANCE ---

pub async fn get_vibe_balance(
    pool: &DbPool,
    user_id: i64,
) -> Result<VibeBalance, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let rows = client
        .query(
            "SELECT messaging_minutes, feed_minutes, live_minutes, shop_minutes, games_minutes, calls_minutes
             FROM vibe_balance WHERE user_id = $1 AND date = $2",
            &[&user_id, &today],
        )
        .await?;
    if let Some(row) = rows.first() {
        Ok(VibeBalance {
            messaging_minutes: row.get("messaging_minutes"),
            feed_minutes: row.get("feed_minutes"),
            live_minutes: row.get("live_minutes"),
            shop_minutes: row.get("shop_minutes"),
            games_minutes: row.get("games_minutes"),
            calls_minutes: row.get("calls_minutes"),
        })
    } else {
        Ok(VibeBalance {
            messaging_minutes: Some(0),
            feed_minutes: Some(0),
            live_minutes: Some(0),
            shop_minutes: Some(0),
            games_minutes: Some(0),
            calls_minutes: Some(0),
        })
    }
}

pub async fn update_vibe_balance(
    pool: &DbPool,
    user_id: i64,
    section: &str,
    minutes: i32,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let sql = format!(
        "INSERT INTO vibe_balance (user_id, date, {}_minutes) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, date) DO UPDATE SET {}_minutes = COALESCE(vibe_balance.{}_minutes, 0) + $3",
        section, section, section
    );
    client.execute(&sql, &[&user_id, &today, &minutes]).await?;
    Ok(())
}

// --- FOCUS SESSIONS ---

pub async fn start_focus(
    pool: &DbPool,
    user_id: i64,
    mode: &str,
) -> Result<FocusSession, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO focus_sessions (user_id, mode) VALUES ($1, $2) RETURNING id, user_id, mode, started_at, ended_at, duration_minutes, active",
            &[&user_id, &mode.to_string()],
        )
        .await?;
    Ok(FocusSession {
        id: rows[0].get("id"),
        user_id: rows[0].get("user_id"),
        mode: rows[0].get("mode"),
        started_at: rows[0].get("started_at"),
        ended_at: None,
        duration_minutes: None,
        active: Some(1),
    })
}

pub async fn end_focus(
    pool: &DbPool,
    user_id: i64,
) -> Result<FocusSession, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "UPDATE focus_sessions SET ended_at = CURRENT_TIMESTAMP, active = 0,
             duration_minutes = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) / 60
             WHERE user_id = $1 AND active = 1
             RETURNING id, user_id, mode, started_at::text, ended_at::text, duration_minutes, active",
            &[&user_id],
        )
        .await?;
    if let Some(row) = rows.first() {
        Ok(FocusSession {
            id: row.get("id"),
            user_id: row.get("user_id"),
            mode: row.get("mode"),
            started_at: row.get("started_at"),
            ended_at: row.get("ended_at"),
            duration_minutes: row.get("duration_minutes"),
            active: Some(0),
        })
    } else {
        Ok(FocusSession {
            id: 0,
            user_id,
            mode: String::new(),
            started_at: String::new(),
            ended_at: None,
            duration_minutes: None,
            active: Some(0),
        })
    }
}

pub async fn get_focus_status(
    pool: &DbPool,
    user_id: i64,
) -> Result<Option<FocusSession>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT id, user_id, mode, started_at::text, ended_at::text, duration_minutes, active
             FROM focus_sessions WHERE user_id = $1 AND active = 1 ORDER BY id DESC FETCH FIRST 1 ROWS ONLY",
            &[&user_id],
        )
        .await?;
    if let Some(row) = rows.first() {
        Ok(Some(FocusSession {
            id: row.get("id"),
            user_id: row.get("user_id"),
            mode: row.get("mode"),
            started_at: row.get("started_at"),
            ended_at: row.get("ended_at"),
            duration_minutes: row.get("duration_minutes"),
            active: Some(1),
        }))
    } else {
        Ok(None)
    }
}

// --- SMART NOTIFICATIONS ---

pub async fn add_smart_notification(
    pool: &DbPool,
    user_id: i64,
    notification_type: &str,
    message: &str,
    priority: &str,
) -> Result<SmartNotification, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO smart_notifications (user_id, notification_type, message, priority) VALUES ($1, $2, $3, $4) RETURNING id, user_id, notification_type, message, priority, read, created_at::text",
            &[&user_id, &notification_type.to_string(), &message.to_string(), &priority.to_string()],
        )
        .await?;
    Ok(SmartNotification {
        id: rows[0].get("id"),
        user_id: rows[0].get("user_id"),
        notification_type: rows[0].get("notification_type"),
        message: rows[0].get("message"),
        priority: Some(rows[0].get("priority")),
        read: Some(rows[0].get("read")),
        created_at: rows[0].get("created_at"),
    })
}

pub async fn get_notifications(
    pool: &DbPool,
    user_id: i64,
) -> Result<Vec<SmartNotification>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT id, user_id, notification_type, message, priority, read, created_at::text
             FROM smart_notifications WHERE user_id = $1 ORDER BY created_at DESC FETCH FIRST 50 ROWS ONLY",
            &[&user_id],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| SmartNotification {
            id: r.get("id"),
            user_id: r.get("user_id"),
            notification_type: r.get("notification_type"),
            message: r.get("message"),
            priority: r.get("priority"),
            read: r.get("read"),
            created_at: r.get("created_at"),
        })
        .collect())
}

pub async fn mark_notification_read(
    pool: &DbPool,
    notification_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "UPDATE smart_notifications SET read = 1 WHERE id = $1",
            &[&notification_id],
        )
        .await?;
    Ok(())
}

// --- SHARED NOTES ---

pub async fn save_note(
    pool: &DbPool,
    chat_id: i64,
    title: &str,
    content: &str,
    updated_by: i64,
) -> Result<SharedNote, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO shared_notes (chat_id, title, content, updated_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (chat_id) DO UPDATE SET title = $2, content = $3, updated_by = $4, updated_at = CURRENT_TIMESTAMP
             RETURNING id, chat_id, title, content, updated_by, updated_at::text",
            &[&chat_id, &title.to_string(), &content.to_string(), &updated_by],
        )
        .await?;
    Ok(SharedNote {
        id: rows[0].get("id"),
        chat_id: rows[0].get("chat_id"),
        title: rows[0].get("title"),
        content: rows[0].get("content"),
        updated_by: rows[0].get("updated_by"),
        updated_at: rows[0].get("updated_at"),
    })
}

pub async fn get_note(
    pool: &DbPool,
    chat_id: i64,
) -> Result<Option<SharedNote>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT id, chat_id, title, content, updated_by, updated_at::text FROM shared_notes WHERE chat_id = $1",
            &[&chat_id],
        )
        .await?;
    if let Some(row) = rows.first() {
        Ok(Some(SharedNote {
            id: row.get("id"),
            chat_id: row.get("chat_id"),
            title: row.get("title"),
            content: row.get("content"),
            updated_by: row.get("updated_by"),
            updated_at: row.get("updated_at"),
        }))
    } else {
        Ok(None)
    }
}

// --- GROUP TASKS ---

pub async fn create_task(
    pool: &DbPool,
    chat_id: i64,
    title: &str,
    assigned_to: Option<i32>,
    created_by: i64,
    due_date: &str,
) -> Result<GroupTask, Box<dyn std::error::Error + Send + Sync>> {
    let due = if due_date.is_empty() { None } else { Some(due_date.to_string()) };
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO group_tasks (chat_id, title, assigned_to, created_by, due_date) VALUES ($1, $2, $3, $4, $5) RETURNING id, chat_id, title, assigned_to, created_by, due_date::text, created_at::text",
            &[&chat_id, &title.to_string(), &assigned_to, &created_by, &due],
        )
        .await?;
    Ok(GroupTask {
        id: rows[0].get("id"),
        chat_id: rows[0].get("chat_id"),
        title: rows[0].get("title"),
        assigned_to: rows[0].get("assigned_to"),
        created_by: rows[0].get("created_by"),
        due_date: rows[0].get("due_date"),
        completed: Some(0),
        creator_name: None,
        assignee_name: None,
        created_at: rows[0].get("created_at"),
    })
}

pub async fn get_tasks(
    pool: &DbPool,
    chat_id: i64,
) -> Result<Vec<GroupTask>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT gt.*, gt.created_at::text, gt.due_date::text,
             c.display_name as creator_name, a.display_name as assignee_name
             FROM group_tasks gt
             LEFT JOIN users c ON gt.created_by = c.id
             LEFT JOIN users a ON gt.assigned_to = a.id
             WHERE gt.chat_id = $1 ORDER BY gt.created_at DESC",
            &[&chat_id],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| GroupTask {
            id: r.get("id"),
            chat_id: r.get("chat_id"),
            title: r.get("title"),
            assigned_to: r.get("assigned_to"),
            created_by: r.get("created_by"),
            due_date: r.get("due_date"),
            completed: r.get("completed"),
            creator_name: r.get("creator_name"),
            assignee_name: r.get("assignee_name"),
            created_at: r.get("created_at"),
        })
        .collect())
}

pub async fn complete_task(
    pool: &DbPool,
    task_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "UPDATE group_tasks SET completed = ABS(completed - 1) WHERE id = $1",
            &[&task_id],
        )
        .await?;
    Ok(())
}

// --- WATCH TOGETHER ---

pub async fn create_watch_session(
    pool: &DbPool,
    chat_id: i64,
    creator_id: i64,
    video_url: &str,
) -> Result<WatchSession, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "INSERT INTO watch_sessions (chat_id, creator_id, video_url) VALUES ($1, $2, $3) RETURNING id, chat_id, creator_id, video_url, playback_time, playing, created_at::text",
            &[&chat_id, &creator_id, &video_url.to_string()],
        )
        .await?;
    Ok(WatchSession {
        id: rows[0].get("id"),
        chat_id: rows[0].get("chat_id"),
        creator_id: rows[0].get("creator_id"),
        video_url: rows[0].get("video_url"),
        playback_time: rows[0].get("playback_time"),
        playing: rows[0].get("playing"),
        created_at: rows[0].get("created_at"),
    })
}

pub async fn sync_watch(
    pool: &DbPool,
    session_id: i64,
    playback_time: f64,
    playing: i32,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "UPDATE watch_sessions SET playback_time = $1, playing = $2 WHERE id = $3",
            &[&playback_time, &playing, &session_id],
        )
        .await?;
    Ok(())
}

pub async fn get_watch_session(
    pool: &DbPool,
    chat_id: i64,
) -> Result<Option<WatchSession>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT id, chat_id, creator_id, video_url, playback_time, playing, created_at::text
             FROM watch_sessions WHERE chat_id = $1 ORDER BY id DESC FETCH FIRST 1 ROWS ONLY",
            &[&chat_id],
        )
        .await?;
    if let Some(row) = rows.first() {
        Ok(Some(WatchSession {
            id: row.get("id"),
            chat_id: row.get("chat_id"),
            creator_id: row.get("creator_id"),
            video_url: row.get("video_url"),
            playback_time: row.get("playback_time"),
            playing: row.get("playing"),
            created_at: row.get("created_at"),
        }))
    } else {
        Ok(None)
    }
}

// --- GAMES ---

pub async fn get_games(
    pool: &DbPool,
) -> Result<Vec<Game>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query("SELECT id, name, game_type, max_players FROM games ORDER BY name", &[])
        .await?;
    Ok(rows
        .iter()
        .map(|r| Game {
            id: r.get("id"),
            name: r.get("name"),
            game_type: r.get("game_type"),
            max_players: r.get("max_players"),
        })
        .collect())
}

pub async fn create_game_session(
    pool: &DbPool,
    game_id: i64,
    chat_id: i64,
    creator_id: i64,
) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let id = snowflake::generate();
    let rows = client
        .query(
            "INSERT INTO game_sessions (id, game_id, chat_id, creator_id) VALUES ($1, $2, $3, $4) RETURNING id",
            &[&id, &game_id, &chat_id, &creator_id],
        )
        .await?;
    Ok(rows[0].get("id"))
}

// === MISSING DB FUNCTIONS (Node parity) ===

// --- CLEANUP ---
pub async fn cleanup_expired_sessions(pool: &DbPool) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let count = client
        .execute("DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '30 days'", &[])
        .await?;
    Ok(count)
}

// --- CHATS ---
pub async fn add_chat_member(
    pool: &DbPool,
    chat_id: i64,
    user_id: i64,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let id = snowflake::generate();
    client
        .execute(
            "INSERT INTO chat_members (id, chat_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            &[&id, &chat_id, &user_id],
        )
        .await?;
    Ok(true)
}

pub async fn toggle_pin_chat(
    pool: &DbPool,
    user_id: i64,
    chat_id: i64,
    pinned: bool,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let _ = client
        .execute(
            "UPDATE chat_members SET pinned = $1 WHERE user_id = $2 AND chat_id = $3",
            &[&(pinned as i32), &user_id, &chat_id],
        )
        .await?;
    Ok(())
}

// --- MESSAGES ---
pub async fn forward_message(
    pool: &DbPool,
    message_id: i64,
    from_chat_id: i64,
    to_chat_id: i64,
    sender_id: i64,
) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let orig = client
        .query_one(
            "SELECT text, type FROM messages WHERE id = $1 AND chat_id = $2",
            &[&message_id, &from_chat_id],
        )
        .await?;
    let text: String = orig.get("text");
    let msg_type: String = orig.get("type");
    let new_id = snowflake::generate();
    client
        .execute(
            "INSERT INTO messages (id, chat_id, sender_id, text, type, forwarded) VALUES ($1, $2, $3, $4, $5, $6)",
            &[&new_id, &to_chat_id, &sender_id, &text, &msg_type, &(1i32)],
        )
        .await?;
    Ok(new_id)
}

// --- CHANNELS ---
pub async fn unsubscribe_channel(
    pool: &DbPool,
    user_id: i64,
    channel_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "DELETE FROM channel_subscribers WHERE user_id = $1 AND channel_id = $2",
            &[&user_id, &channel_id],
        )
        .await?;
    Ok(())
}

// --- COMMUNITIES ---
pub async fn leave_community(
    pool: &DbPool,
    user_id: i64,
    community_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "DELETE FROM community_members WHERE user_id = $1 AND community_id = $2",
            &[&user_id, &community_id],
        )
        .await?;
    Ok(())
}

// --- WEBRTC CALLS ---
pub async fn create_active_call(
    pool: &DbPool,
    caller_id: i64,
    callee_id: i64,
    call_type: &str,
) -> Result<ActiveCall, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let id = snowflake::generate();
    let rows = client
        .query(
            "INSERT INTO active_calls (id, caller_id, callee_id, type, status) VALUES ($1, $2, $3, $4, 'ringing') RETURNING id, caller_id, callee_id, type, status, created_at",
            &[&id, &caller_id, &callee_id, &call_type.to_string()],
        )
        .await?;
    let r = &rows[0];
    Ok(ActiveCall {
        id: r.get("id"),
        caller_id: r.get("caller_id"),
        callee_id: r.get("callee_id"),
        call_type: r.get("type"),
        status: r.get("status"),
        created_at: r.get("created_at"),
    })
}

pub async fn get_active_call(
    pool: &DbPool,
    call_id: i64,
) -> Result<Option<ActiveCall>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT id, caller_id, callee_id, type, status, created_at FROM active_calls WHERE id = $1",
            &[&call_id],
        )
        .await?;
    Ok(rows.first().map(|r| ActiveCall {
        id: r.get("id"),
        caller_id: r.get("caller_id"),
        callee_id: r.get("callee_id"),
        call_type: r.get("type"),
        status: r.get("status"),
        created_at: r.get("created_at"),
    }))
}

pub async fn get_active_call_between(
    pool: &DbPool,
    user1_id: i64,
    user2_id: i64,
) -> Result<Option<ActiveCall>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT id, caller_id, callee_id, type, status, created_at FROM active_calls WHERE status = 'ringing' AND ((caller_id = $1 AND callee_id = $2) OR (caller_id = $2 AND callee_id = $1)) FETCH FIRST 1 ROWS ONLY",
            &[&user1_id, &user2_id],
        )
        .await?;
    Ok(rows.first().map(|r| ActiveCall {
        id: r.get("id"),
        caller_id: r.get("caller_id"),
        callee_id: r.get("callee_id"),
        call_type: r.get("type"),
        status: r.get("status"),
        created_at: r.get("created_at"),
    }))
}

pub async fn get_user_active_calls(
    pool: &DbPool,
    user_id: i64,
) -> Result<Vec<ActiveCall>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT id, caller_id, callee_id, type, status, created_at FROM active_calls WHERE (caller_id = $1 OR callee_id = $1) AND status = 'ringing'",
            &[&user_id],
        )
        .await?;
    Ok(rows.into_iter().map(|r| ActiveCall {
        id: r.get("id"),
        caller_id: r.get("caller_id"),
        callee_id: r.get("callee_id"),
        call_type: r.get("type"),
        status: r.get("status"),
        created_at: r.get("created_at"),
    }).collect())
}

pub async fn update_call_status(
    pool: &DbPool,
    call_id: i64,
    status: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "UPDATE active_calls SET status = $1 WHERE id = $2",
            &[&status.to_string(), &call_id],
        )
        .await?;
    Ok(())
}

pub async fn end_active_call(
    pool: &DbPool,
    call_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "DELETE FROM active_calls WHERE id = $1",
            &[&call_id],
        )
        .await?;
    Ok(())
}

// --- BROADCASTS ---
pub async fn start_broadcast(
    pool: &DbPool,
    user_id: i64,
    title: &str,
) -> Result<Broadcast, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let id = snowflake::generate();
    let rows = client
        .query(
            "INSERT INTO broadcasts (id, user_id, title, status) VALUES ($1, $2, $3, 'live') RETURNING *",
            &[&id, &user_id, &title.to_string()],
        )
        .await?;
    Ok(broadcast_from_row(&rows[0]))
}

pub async fn stop_broadcast(
    pool: &DbPool,
    broadcast_id: i64,
    user_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "UPDATE broadcasts SET status = 'ended', ended_at = NOW() WHERE id = $1 AND user_id = $2",
            &[&broadcast_id, &user_id],
        )
        .await?;
    Ok(())
}

pub async fn get_broadcast(
    pool: &DbPool,
    broadcast_id: i64,
) -> Result<Option<Broadcast>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT b.*, u.display_name, u.avatar, u.username, (SELECT COUNT(*) FROM broadcast_viewers WHERE broadcast_id = b.id) as viewers FROM broadcasts b JOIN users u ON b.user_id = u.id WHERE b.id = $1 AND b.status = 'live'",
            &[&broadcast_id],
        )
        .await?;
    Ok(rows.first().map(|r| broadcast_from_row(r)))
}

pub async fn get_broadcasts(
    pool: &DbPool,
) -> Result<Vec<Broadcast>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT b.*, u.display_name, u.avatar, u.username, (SELECT COUNT(*) FROM broadcast_viewers WHERE broadcast_id = b.id) as viewers FROM broadcasts b JOIN users u ON b.user_id = u.id WHERE b.status = 'live' ORDER BY b.started_at DESC",
            &[],
        )
        .await?;
    Ok(rows.into_iter().map(|r| broadcast_from_row(&r)).collect())
}

pub async fn add_broadcast_viewer(
    pool: &DbPool,
    broadcast_id: i64,
    user_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let id = snowflake::generate();
    client
        .execute(
            "INSERT INTO broadcast_viewers (id, broadcast_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            &[&id, &broadcast_id, &user_id],
        )
        .await?;
    Ok(())
}

pub async fn remove_broadcast_viewer(
    pool: &DbPool,
    broadcast_id: i64,
    user_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "DELETE FROM broadcast_viewers WHERE broadcast_id = $1 AND user_id = $2",
            &[&broadcast_id, &user_id],
        )
        .await?;
    Ok(())
}

pub async fn get_broadcast_viewers(
    pool: &DbPool,
    broadcast_id: i64,
) -> Result<Vec<i64>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT user_id FROM broadcast_viewers WHERE broadcast_id = $1",
            &[&broadcast_id],
        )
        .await?;
    Ok(rows.into_iter().map(|r| r.get("user_id")).collect())
}

fn broadcast_from_row(r: &tokio_postgres::Row) -> Broadcast {
    Broadcast {
        id: r.get("id"),
        user_id: r.get("user_id"),
        title: r.get("title"),
        status: r.get("status"),
        started_at: r.get("started_at"),
        ended_at: r.get("ended_at"),
        display_name: r.get("display_name"),
        avatar: r.get("avatar"),
        username: r.get("username"),
        viewers: r.try_get("viewers").ok(),
    }
}

// --- AVATAR 3D ---
pub async fn save_avatar_customization(
    pool: &DbPool,
    user_id: i64,
    customization: &serde_json::Value,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let id = snowflake::generate();
    client
        .execute(
            "INSERT INTO avatar_3d (id, user_id, customization) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET customization = $3, updated_at = NOW()",
            &[&id, &user_id, &customization],
         )
         .await?;
    Ok(())
}

pub async fn get_avatar_customization(
    pool: &DbPool,
    user_id: i64,
) -> Result<Option<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT customization FROM avatar_3d WHERE user_id = $1",
            &[&user_id],
        )
        .await?;
    Ok(rows.first().map(|r| r.get("customization")))
}

// --- GAMES ---
pub async fn join_game_session(
    pool: &DbPool,
    session_id: i64,
    user_id: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "INSERT INTO game_players (id, session_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            &[&snowflake::generate(), &session_id, &user_id],
        )
        .await?;
    Ok(())
}

pub async fn update_game_score(
    pool: &DbPool,
    session_id: i64,
    user_id: i64,
    score: i32,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "INSERT INTO game_scores (id, session_id, user_id, score) VALUES ($1, $2, $3, $4) ON CONFLICT (session_id, user_id) DO UPDATE SET score = $4",
            &[&snowflake::generate(), &session_id, &user_id, &score],
        )
        .await?;
    Ok(())
}

pub async fn end_game_session(
    pool: &DbPool,
    session_id: i64,
    winner_id: Option<i64>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "UPDATE game_sessions SET status = 'ended', winner_id = COALESCE($1, winner_id), ended_at = NOW() WHERE id = $2",
            &[&winner_id, &session_id],
        )
        .await?;
    Ok(())
}

// --- RECOMMENDATIONS ---
pub async fn record_interaction(
    pool: &DbPool,
    user_id: i64,
    post_id: i64,
    interaction_type: &str,
    weight: i32,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let id = snowflake::generate();
    let upsert = if interaction_type == "dwell" {
        format!(
            "INSERT INTO post_interactions (id, user_id, post_id, interaction_type, weight, created_at) VALUES ({}, {}, {}, '{}', {}, NOW()) ON CONFLICT (user_id, post_id, interaction_type) DO UPDATE SET weight = {}, created_at = NOW()",
            id, user_id, post_id, interaction_type, weight, weight
        )
    } else {
        format!(
            "INSERT INTO post_interactions (id, user_id, post_id, interaction_type, weight, created_at) VALUES ({}, {}, {}, '{}', {}, NOW()) ON CONFLICT (user_id, post_id, interaction_type) DO NOTHING",
            id, user_id, post_id, interaction_type, weight
        )
    };
    client.execute(&upsert, &[]).await?;
    Ok(())
}

pub async fn get_recommended_posts(
    pool: &DbPool,
    user_id: i64,
    limit: i32,
    seen_ids: Vec<i64>,
) -> Result<Vec<RecommendedPost>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    // Merge seen_ids with interacted post IDs
    let excluded = client
        .query(
            "SELECT ARRAY(SELECT DISTINCT post_id FROM post_interactions WHERE user_id = $1) as ids",
            &[&user_id],
        )
        .await?;
    let mut exclude_ids: Vec<i64> = excluded[0].try_get::<_, Vec<i64>>("ids").unwrap_or_default();
    for id in seen_ids { if !exclude_ids.contains(&id) { exclude_ids.push(id); } }
    let limit_i64 = limit as i64;
    let params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = vec![
        &exclude_ids as &(dyn tokio_postgres::types::ToSql + Sync),
        &limit_i64 as &(dyn tokio_postgres::types::ToSql + Sync),
    ];

    let query_str = "SELECT p.*, u.display_name, u.avatar, u.username,
                    (SELECT COUNT(*) FROM post_views WHERE post_id = p.id) as views,
                    (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
                    (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comments_count,
                    COALESCE((SELECT SUM(weight) FROM post_interactions WHERE post_id = p.id AND created_at > NOW() - INTERVAL '24 hours'), 0) as recent_engagement
                 FROM posts p JOIN users u ON p.user_id = u.id
                 WHERE p.expires_at > NOW() AND p.id != ALL($1)
                 ORDER BY recent_engagement DESC, p.created_at DESC
                 FETCH FIRST $2 ROWS ONLY";

    let rows = client
        .query(query_str, &params)
        .await?;

    Ok(rows.into_iter().map(|r| {
        let views: Option<i64> = r.try_get("views").ok();
        let likes: Option<i32> = r.try_get("likes_count").ok();
        let comments: Option<i32> = r.try_get("comments_count").ok();
        let created_at: chrono::NaiveDateTime = r.get("created_at");
        RecommendedPost {
            id: r.get("id"),
            text: r.get("text"),
            media: r.get("media"),
            media_type: r.get("media_type"),
            created_at: created_at.and_utc().to_rfc3339(),
            user_id: r.get("user_id"),
            display_name: r.get("display_name"),
            avatar: r.get("avatar"),
            username: r.get("username"),
            views: views.unwrap_or(0),
            likes_count: likes.unwrap_or(0),
            comments_count: comments.unwrap_or(0),
            recommended_score: 0.0,
            matched_interests: vec![],
        }
    }).collect())
}

pub async fn get_trending_tags(
    pool: &DbPool,
    limit: i32,
) -> Result<Vec<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT pt.tag, COUNT(DISTINCT pi.user_id) as engagers
             FROM post_tags pt
             JOIN post_interactions pi ON pi.post_id = pt.post_id AND pi.created_at > NOW() - INTERVAL '24 hours'
             GROUP BY pt.tag ORDER BY engagers DESC FETCH FIRST $1 ROWS ONLY",
            &[&(limit as i64)],
        )
        .await?;
    Ok(rows.into_iter().map(|r| {
        serde_json::json!({"tag": r.get::<_, String>("tag"), "engagers": r.get::<_, i64>("engagers")})
    }).collect())
}

// --- PUSH NOTIFICATIONS ---
pub async fn add_push_subscription(
    pool: &DbPool,
    user_id: i64,
    endpoint: &str,
    keys: &serde_json::Value,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let id = snowflake::generate();
    client
        .execute(
            "INSERT INTO push_subscriptions (id, user_id, endpoint, keys) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, endpoint) DO NOTHING",
            &[&id, &user_id, &endpoint.to_string(), keys],
        )
        .await?;
    Ok(())
}

pub async fn remove_push_subscription(
    pool: &DbPool,
    user_id: i64,
    endpoint: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2",
            &[&user_id, &endpoint.to_string()],
        )
        .await?;
    Ok(())
}

pub async fn get_all_push_subscriptions(
    pool: &DbPool,
) -> Result<Vec<(i64, String, serde_json::Value)>, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let rows = client
        .query(
            "SELECT user_id, endpoint, keys FROM push_subscriptions",
            &[],
        )
        .await?;
    Ok(rows.into_iter().map(|r| {
        (r.get("user_id"), r.get("endpoint"), r.get("keys"))
    }).collect())
}
