use serde::{Deserialize, Serialize};
use tokio_postgres::Row;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub phone: String,
    pub username: String,
    pub display_name: String,
    pub avatar: String,
    pub bio: Option<String>,
    pub country_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub online: Option<bool>,
}

impl From<Row> for User {
    fn from(row: Row) -> Self {
        Self {
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chat {
    pub id: i64,
    #[serde(rename = "type")]
    pub chat_type: String,
    pub name: String,
    pub avatar: String,
    pub last_message: Option<String>,
    pub last_message_time: Option<String>,
    pub last_sender_id: Option<i64>,
    pub created_at: Option<String>,
    pub unread: Option<i64>,
    pub members: Option<Vec<User>>,
    pub pinned: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: i64,
    pub chat_id: i64,
    pub sender_id: i64,
    pub sender_name: Option<String>,
    pub sender_avatar: Option<String>,
    pub text: String,
    #[serde(rename = "type")]
    pub msg_type: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply_to_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forwarded: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Post {
    pub id: i64,
    pub user_id: i64,
    pub text: Option<String>,
    pub media: Option<String>,
    pub media_type: Option<String>,
    pub likes_count: Option<i32>,
    pub comments_count: Option<i32>,
    pub created_at: String,
    pub expires_at: Option<String>,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    pub views: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostComment {
    pub id: i64,
    pub post_id: i64,
    pub user_id: i64,
    pub text: String,
    pub parent_id: Option<i64>,
    pub created_at: String,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    pub username: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveComment {
    pub id: i64,
    pub live_id: i64,
    pub user_id: i64,
    pub text: String,
    pub created_at: String,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    pub username: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveReaction {
    pub id: i64,
    pub live_id: i64,
    pub user_id: i64,
    pub reaction: String,
    pub created_at: String,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    pub username: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveGift {
    pub id: i64,
    pub live_id: i64,
    pub sender_id: i64,
    pub recipient_id: i64,
    pub stars: i32,
    pub message: Option<String>,
    pub created_at: String,
    pub sender_name: Option<String>,
    pub sender_avatar: Option<String>,
    pub sender_username: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Call {
    pub id: i64,
    pub caller_id: i64,
    pub callee_id: i64,
    #[serde(rename = "type")]
    pub call_type: String,
    pub status: String,
    pub duration: i32,
    pub created_at: String,
    pub direction: Option<String>,
    pub other_id: Option<i64>,
    pub other_name: Option<String>,
    pub other_avatar: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: i64,
    pub device_name: Option<String>,
    pub device_id: Option<String>,
    pub created_at: String,
    pub last_active: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TwoStepStatus {
    pub enabled: i32,
    pub hint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacySettings {
    pub user_id: i64,
    pub last_seen: String,
    pub profile_photo: String,
    pub bio: String,
    pub status: String,
    pub calls: String,
    pub read_receipts: i32,
    pub message_history: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Video {
    pub id: i64,
    pub user_id: i64,
    pub video_url: String,
    pub thumbnail: Option<String>,
    pub caption: Option<String>,
    pub likes_count: Option<i32>,
    pub comments_count: Option<i32>,
    pub created_at: String,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    pub username: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoComment {
    pub id: i64,
    pub video_id: i64,
    pub user_id: i64,
    pub text: String,
    pub created_at: String,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    pub username: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Live {
    pub id: i64,
    pub user_id: i64,
    pub title: Option<String>,
    pub status: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    pub username: Option<String>,
}

// Socket event payloads
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendCodePayload {
    pub phone: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyCodePayload {
    pub phone: String,
    pub code: String,
    pub username: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "countryCode")]
    pub country_code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreSessionPayload {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<User>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_new: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OkResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactStatusPayload {
    pub user_id: i64,
    pub online: bool,
}

// Additional Vibe types

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Channel {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub avatar: Option<String>,
    pub owner_id: i64,
    pub subscribers: Option<i64>,
    pub display_name: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelPost {
    pub id: i64,
    pub channel_id: i64,
    pub sender_id: i64,
    pub text: Option<String>,
    pub media: Option<String>,
    pub media_type: Option<String>,
    pub likes_count: Option<i32>,
    pub comments_count: Option<i32>,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Community {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub avatar: Option<String>,
    pub owner_id: i64,
    pub display_name: Option<String>,
    pub members_count: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Poll {
    pub id: i64,
    pub chat_id: i64,
    pub creator_id: i64,
    pub question: String,
    pub multiple_choice: i32,
    pub options: Vec<PollOption>,
    pub votes: Vec<PollVote>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PollOption {
    pub id: i64,
    pub poll_id: i64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PollVote {
    pub option_id: i64,
    pub votes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: i64,
    pub seller_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub price: serde_json::Value,
    pub currency: Option<String>,
    pub images: Option<String>,
    pub category: Option<String>,
    pub stock: Option<i32>,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: i64,
    pub buyer_id: i64,
    pub product_id: i64,
    pub quantity: i32,
    pub total: serde_json::Value,
    pub status: Option<String>,
    pub name: Option<String>,
    pub images: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wishlist {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub is_public: Option<i32>,
    pub items: Option<serde_json::Value>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlashDeal {
    pub id: i64,
    pub product_id: i64,
    pub discount_percent: i32,
    pub starts_at: String,
    pub ends_at: String,
    pub max_quantity: Option<i32>,
    pub sold: Option<i32>,
    pub name: Option<String>,
    pub price: Option<serde_json::Value>,
    pub images: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Meme {
    pub id: i64,
    pub user_id: i64,
    pub image_url: String,
    pub caption: Option<String>,
    pub template: Option<String>,
    pub likes_count: Option<i32>,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StickerPack {
    pub id: i64,
    pub name: String,
    pub author_id: i64,
    pub price: Option<serde_json::Value>,
    pub display_name: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sticker {
    pub id: i64,
    pub pack_id: i64,
    pub image_url: String,
    pub emoji: Option<String>,
    pub pack_name: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VibeBalance {
    pub messaging_minutes: Option<i32>,
    pub feed_minutes: Option<i32>,
    pub live_minutes: Option<i32>,
    pub shop_minutes: Option<i32>,
    pub games_minutes: Option<i32>,
    pub calls_minutes: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusSession {
    pub id: i64,
    pub user_id: i64,
    pub mode: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_minutes: Option<i32>,
    pub active: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartNotification {
    pub id: i64,
    pub user_id: i64,
    pub notification_type: String,
    pub message: String,
    pub priority: Option<String>,
    pub read: Option<i32>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SharedNote {
    pub id: i64,
    pub chat_id: i64,
    pub title: Option<String>,
    pub content: Option<String>,
    pub updated_by: i64,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupTask {
    pub id: i64,
    pub chat_id: i64,
    pub title: String,
    pub assigned_to: Option<i64>,
    pub created_by: i64,
    pub due_date: Option<String>,
    pub completed: Option<i32>,
    pub creator_name: Option<String>,
    pub assignee_name: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchSession {
    pub id: i64,
    pub chat_id: i64,
    pub creator_id: i64,
    pub video_url: String,
    pub playback_time: Option<f64>,
    pub playing: Option<i32>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    pub id: i64,
    pub name: String,
    pub game_type: String,
    pub max_players: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameSession {
    pub id: i64,
    pub game_id: i64,
    pub chat_id: i64,
    pub creator_id: i64,
    pub status: Option<String>,
    pub winner_id: Option<i64>,
    pub created_at: String,
}

// --- MISSING TYPES (Node parity) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveCall {
    pub id: i64,
    pub caller_id: i64,
    pub callee_id: i64,
    pub call_type: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Broadcast {
    pub id: i64,
    pub user_id: i64,
    pub title: Option<String>,
    pub status: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    pub username: Option<String>,
    pub viewers: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvatarCustomization {
    pub id: i64,
    pub user_id: i64,
    pub customization: serde_json::Value,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushSubscription {
    pub endpoint: String,
    pub keys: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendedPost {
    pub id: i64,
    pub text: Option<String>,
    pub media: Option<String>,
    pub media_type: Option<String>,
    pub created_at: String,
    pub user_id: i64,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    pub username: Option<String>,
    pub views: i64,
    pub likes_count: i32,
    pub comments_count: i32,
    pub recommended_score: f64,
    pub matched_interests: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameActionPayload {
    pub session_id: i64,
    pub action: String,
    pub data: Option<serde_json::Value>,
}
