-- Consolidated migration for fresh database setup
-- All tables use BIGINT with Snowflake IDs (no SERIAL/BIGSERIAL)
-- For production use: run this file on a fresh DB, then skip 001-007

CREATE SEQUENCE IF NOT EXISTS snowflake_seq START 1;

-- ============================================================
-- Base tables (from 001_init.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  country_code TEXT DEFAULT '',
  delete_at TIMESTAMP DEFAULT NULL,
  auto_delete_days INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verification_codes (
  id BIGINT PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  device_id TEXT DEFAULT '',
  device_name TEXT DEFAULT '',
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  contact_user_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, contact_user_id)
);

CREATE TABLE IF NOT EXISTS chats (
  id BIGINT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('private','group')),
  name TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  created_by BIGINT,
  pinned INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_members (
  id BIGINT PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES chats(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES chats(id),
  sender_id BIGINT NOT NULL REFERENCES users(id),
  text TEXT DEFAULT '',
  type TEXT DEFAULT 'text' CHECK(type IN ('text','image','system','voice','video')),
  voice_duration INTEGER DEFAULT 0,
  reply_to_id BIGINT REFERENCES messages(id),
  forwarded INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_reads (
  id BIGINT PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES messages(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  text TEXT DEFAULT '',
  media TEXT DEFAULT '',
  media_type TEXT DEFAULT 'text',
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS post_views (
  id BIGINT PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_likes (
  id BIGINT PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id BIGINT PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  parent_id BIGINT REFERENCES post_comments(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calls (
  id BIGINT PRIMARY KEY,
  caller_id BIGINT NOT NULL REFERENCES users(id),
  callee_id BIGINT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('audio','video')),
  status TEXT NOT NULL CHECK(status IN ('missed','completed','incoming','outgoing')),
  duration INTEGER DEFAULT 0,
  screen_sharing INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS two_step_settings (
  id BIGINT PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL REFERENCES users(id),
  password_hash TEXT NOT NULL,
  hint TEXT DEFAULT '',
  enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS blocked_users (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  blocked_user_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, blocked_user_id)
);

CREATE TABLE IF NOT EXISTS privacy_settings (
  id BIGINT PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL REFERENCES users(id),
  last_seen TEXT DEFAULT 'everyone' CHECK(last_seen IN ('everyone','contacts','nobody')),
  profile_photo TEXT DEFAULT 'everyone' CHECK(profile_photo IN ('everyone','contacts','nobody')),
  bio TEXT DEFAULT 'everyone' CHECK(bio IN ('everyone','contacts','nobody')),
  status TEXT DEFAULT 'contacts' CHECK(status IN ('everyone','contacts','nobody')),
  calls TEXT DEFAULT 'everyone' CHECK(calls IN ('everyone','contacts','nobody')),
  read_receipts INTEGER DEFAULT 1,
  message_history INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS videos (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  video_url TEXT NOT NULL,
  thumbnail TEXT DEFAULT '',
  caption TEXT DEFAULT '',
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS video_likes (
  id BIGINT PRIMARY KEY,
  video_id BIGINT NOT NULL REFERENCES videos(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(video_id, user_id)
);

CREATE TABLE IF NOT EXISTS video_comments (
  id BIGINT PRIMARY KEY,
  video_id BIGINT NOT NULL REFERENCES videos(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lives (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  title TEXT DEFAULT '',
  status TEXT DEFAULT 'live' CHECK(status IN ('live','ended')),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP
);

-- ============================================================
-- Vibe tables (from 002_vibe_tables.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS channels (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  owner_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS channel_subscribers (
  id BIGINT PRIMARY KEY,
  channel_id BIGINT NOT NULL REFERENCES channels(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS channel_posts (
  id BIGINT PRIMARY KEY,
  channel_id BIGINT NOT NULL REFERENCES channels(id),
  sender_id BIGINT NOT NULL REFERENCES users(id),
  text TEXT DEFAULT '',
  media TEXT DEFAULT '',
  media_type TEXT DEFAULT 'text',
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS communities (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  owner_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS community_members (
  id BIGINT PRIMARY KEY,
  community_id BIGINT NOT NULL REFERENCES communities(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  role TEXT DEFAULT 'member' CHECK(role IN ('admin','member')),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(community_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_groups (
  id BIGINT PRIMARY KEY,
  community_id BIGINT NOT NULL REFERENCES communities(id),
  chat_id BIGINT NOT NULL REFERENCES chats(id),
  UNIQUE(community_id, chat_id)
);

CREATE TABLE IF NOT EXISTS polls (
  id BIGINT PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES chats(id),
  creator_id BIGINT NOT NULL REFERENCES users(id),
  question TEXT NOT NULL,
  multiple_choice INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS poll_options (
  id BIGINT PRIMARY KEY,
  poll_id BIGINT NOT NULL REFERENCES polls(id),
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id BIGINT PRIMARY KEY,
  poll_id BIGINT NOT NULL REFERENCES polls(id),
  option_id BIGINT NOT NULL REFERENCES poll_options(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(poll_id, user_id, option_id)
);

CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY,
  seller_id BIGINT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  images TEXT DEFAULT '',
  category TEXT DEFAULT '',
  stock INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT PRIMARY KEY,
  buyer_id BIGINT NOT NULL REFERENCES users(id),
  product_id BIGINT NOT NULL REFERENCES products(id),
  quantity INTEGER DEFAULT 1,
  total NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','shipped','delivered','cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wishlists (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  name TEXT DEFAULT 'Wishlist',
  is_public INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id BIGINT PRIMARY KEY,
  wishlist_id BIGINT NOT NULL REFERENCES wishlists(id),
  product_id BIGINT NOT NULL REFERENCES products(id),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(wishlist_id, product_id)
);

CREATE TABLE IF NOT EXISTS flash_deals (
  id BIGINT PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id),
  discount_percent INTEGER NOT NULL,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  max_quantity INTEGER DEFAULT 0,
  sold INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS affiliate_links (
  id BIGINT PRIMARY KEY,
  creator_id BIGINT NOT NULL REFERENCES users(id),
  product_id BIGINT NOT NULL REFERENCES products(id),
  commission_percent NUMERIC(5,2) DEFAULT 0,
  code TEXT UNIQUE NOT NULL,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS live_products (
  id BIGINT PRIMARY KEY,
  live_id BIGINT NOT NULL REFERENCES lives(id),
  product_id BIGINT NOT NULL REFERENCES products(id),
  discount_percent INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voice_transcripts (
  id BIGINT PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES messages(id),
  transcription TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS games (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('wordle','trivia','karaoke')),
  max_players INTEGER DEFAULT 4,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id BIGINT PRIMARY KEY,
  game_id BIGINT NOT NULL REFERENCES games(id),
  chat_id BIGINT NOT NULL REFERENCES chats(id),
  creator_id BIGINT NOT NULL REFERENCES users(id),
  status TEXT DEFAULT 'waiting' CHECK(status IN ('waiting','playing','finished')),
  winner_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_players (
  id BIGINT PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES game_sessions(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  score INTEGER DEFAULT 0,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, user_id)
);

CREATE TABLE IF NOT EXISTS memes (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  image_url TEXT NOT NULL,
  caption TEXT DEFAULT '',
  template TEXT DEFAULT '',
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meme_likes (
  id BIGINT PRIMARY KEY,
  meme_id BIGINT NOT NULL REFERENCES memes(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(meme_id, user_id)
);

CREATE TABLE IF NOT EXISTS sticker_packs (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  author_id BIGINT NOT NULL REFERENCES users(id),
  price NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stickers (
  id BIGINT PRIMARY KEY,
  pack_id BIGINT NOT NULL REFERENCES sticker_packs(id),
  image_url TEXT NOT NULL,
  emoji TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_stickers (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  sticker_id BIGINT NOT NULL REFERENCES stickers(id),
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, sticker_id)
);

-- Legacy alias: sticker_purchases (referenced by 004_snowflake)
CREATE TABLE IF NOT EXISTS sticker_purchases (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  pack_id BIGINT NOT NULL REFERENCES sticker_packs(id),
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS avatar_customizations (
  id BIGINT PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL REFERENCES users(id),
  avatar_json TEXT DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Legacy alias: avatar_3d (referenced by 004_snowflake)
CREATE TABLE IF NOT EXISTS avatar_3d (
  id BIGINT PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL REFERENCES users(id),
  avatar_json TEXT DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vibe_balance (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  stars INTEGER DEFAULT 0,
  messaging_minutes INTEGER DEFAULT 0,
  feed_minutes INTEGER DEFAULT 0,
  live_minutes INTEGER DEFAULT 0,
  shop_minutes INTEGER DEFAULT 0,
  games_minutes INTEGER DEFAULT 0,
  calls_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  mode TEXT NOT NULL CHECK(mode IN ('focus','work','sleep')),
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  duration_minutes INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS smart_notifications (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  notification_type TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK(priority IN ('high','normal','low')),
  read INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shared_notes (
  id BIGINT PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES chats(id),
  title TEXT DEFAULT 'Notes',
  content TEXT DEFAULT '',
  updated_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_tasks (
  id BIGINT PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES chats(id),
  title TEXT NOT NULL,
  assigned_to BIGINT REFERENCES users(id),
  created_by BIGINT NOT NULL REFERENCES users(id),
  due_date TIMESTAMP,
  completed INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watch_sessions (
  id BIGINT PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES chats(id),
  creator_id BIGINT NOT NULL REFERENCES users(id),
  video_url TEXT NOT NULL,
  playback_time REAL DEFAULT 0,
  playing INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- WebRTC tables (from 003_webrtc.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS active_calls (
  id BIGINT PRIMARY KEY,
  caller_id BIGINT NOT NULL REFERENCES users(id),
  callee_id BIGINT NOT NULL REFERENCES users(id),
  call_type TEXT NOT NULL CHECK(call_type IN ('audio','video')),
  status TEXT NOT NULL DEFAULT 'ringing' CHECK(status IN ('ringing','connecting','connected','ended')),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'live' CHECK(status IN ('live','ended')),
  viewer_count INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS broadcast_viewers (
  id BIGINT PRIMARY KEY,
  broadcast_id BIGINT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(broadcast_id, user_id)
);

-- ============================================================
-- Live comments & reactions (from 005_live_comments.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS live_comments (
  id BIGINT PRIMARY KEY,
  live_id BIGINT NOT NULL REFERENCES lives(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS live_reactions (
  id BIGINT PRIMARY KEY,
  live_id BIGINT NOT NULL REFERENCES lives(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  reaction TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(live_id, user_id, reaction)
);

-- ============================================================
-- Stars & gifts (from 006_stars_gifts.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS live_gifts (
  id BIGINT PRIMARY KEY,
  live_id BIGINT NOT NULL REFERENCES lives(id),
  sender_id BIGINT NOT NULL REFERENCES users(id),
  recipient_id BIGINT NOT NULL REFERENCES users(id),
  stars INTEGER NOT NULL DEFAULT 1,
  message TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Recommendations (from 007_recommendations.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS post_tags (
  id BIGINT PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag VARCHAR(100) NOT NULL,
  UNIQUE(post_id, tag)
);

CREATE TABLE IF NOT EXISTS post_interactions (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  interaction_type VARCHAR(20) NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, post_id, interaction_type)
);
CREATE INDEX IF NOT EXISTS idx_pi_user ON post_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pi_post ON post_interactions(post_id);
CREATE INDEX IF NOT EXISTS idx_pi_type ON post_interactions(interaction_type);

CREATE TABLE IF NOT EXISTS user_interests (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  keyword VARCHAR(100) NOT NULL,
  score FLOAT NOT NULL DEFAULT 1.0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, keyword)
);
CREATE INDEX IF NOT EXISTS idx_ui_user ON user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_ui_keyword ON user_interests(keyword);

CREATE TABLE IF NOT EXISTS user_embeddings (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  embedding JSONB NOT NULL,
  momentum JSONB NOT NULL DEFAULT '[]',
  total_interactions INTEGER NOT NULL DEFAULT 0,
  slot_counter INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS global_embeddings (
  id BIGINT PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE UNIQUE,
  embedding JSONB NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ge_post ON global_embeddings(post_id);

-- ============================================================
-- Indexes & functions (from 007_image_classification.sql)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag);

CREATE OR REPLACE FUNCTION save_post_tags(
  p_post_id BIGINT,
  p_tags TEXT[]
) RETURNS VOID AS $$
DECLARE
  tag TEXT;
  tag_id BIGINT;
BEGIN
  FOREACH tag IN ARRAY p_tags LOOP
    INSERT INTO post_tags (id, post_id, tag)
    VALUES (nextval('snowflake_seq'), p_post_id, tag)
    ON CONFLICT (post_id, tag) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_post_tags(p_post_id BIGINT)
RETURNS TEXT[] AS $$
  SELECT COALESCE(ARRAY_AGG(tag ORDER BY tag), '{}')
  FROM post_tags
  WHERE post_id = p_post_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION recommend_posts_by_tags(
  p_user_id BIGINT,
  p_limit INT DEFAULT 20,
  p_exclude_ids BIGINT[] DEFAULT '{}'
) RETURNS TABLE(
  post_id BIGINT,
  user_id BIGINT,
  media_url TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH user_tags AS (
    SELECT DISTINCT pt.tag
    FROM post_interactions pi
    JOIN post_tags pt ON pt.post_id = pi.post_id
    WHERE pi.user_id = p_user_id
      AND pi.interaction_type IN ('like', 'comment')
  ),
  tag_scores AS (
    SELECT
      p.id AS post_id,
      p.user_id,
      p.media_url,
      p.caption,
      p.created_at,
      p.expires_at,
      COUNT(DISTINCT ut.tag)::NUMERIC * 2.0
        + COUNT(DISTINCT pt.tag)::NUMERIC * 0.5
        - EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0 * 0.1
        AS score
    FROM posts p
    JOIN post_tags pt ON pt.post_id = p.id
    LEFT JOIN user_tags ut ON ut.tag = pt.tag
    WHERE p.expires_at > NOW()
      AND p.id <> ALL(p_exclude_ids)
      AND (p.user_id = p_user_id OR p.user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE user_id = p_user_id
      ))
    GROUP BY p.id
  )
  SELECT * FROM tag_scores
  ORDER BY score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
