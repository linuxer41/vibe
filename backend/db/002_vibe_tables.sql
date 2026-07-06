-- Vibe App: New tables for WhatsApp + TikTok hybrid

-- Channels (broadcast)
CREATE TABLE IF NOT EXISTS channels (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  owner_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS channel_subscribers (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER NOT NULL REFERENCES channels(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS channel_posts (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER NOT NULL REFERENCES channels(id),
  sender_id INTEGER NOT NULL REFERENCES users(id),
  text TEXT DEFAULT '',
  media TEXT DEFAULT '',
  media_type TEXT DEFAULT 'text',
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Communities (nested groups)
CREATE TABLE IF NOT EXISTS communities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  owner_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS community_members (
  id SERIAL PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT DEFAULT 'member' CHECK(role IN ('admin','member')),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(community_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_groups (
  id SERIAL PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id),
  chat_id INTEGER NOT NULL REFERENCES chats(id),
  UNIQUE(community_id, chat_id)
);

-- Polls
CREATE TABLE IF NOT EXISTS polls (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(id),
  creator_id INTEGER NOT NULL REFERENCES users(id),
  question TEXT NOT NULL,
  multiple_choice INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS poll_options (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES polls(id),
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES polls(id),
  option_id INTEGER NOT NULL REFERENCES poll_options(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(poll_id, user_id, option_id)
);

-- Vibe Shop (products)
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES users(id),
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
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER DEFAULT 1,
  total NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','shipped','delivered','cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wishlist
CREATE TABLE IF NOT EXISTS wishlists (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT DEFAULT 'Wishlist',
  is_public INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id SERIAL PRIMARY KEY,
  wishlist_id INTEGER NOT NULL REFERENCES wishlists(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(wishlist_id, product_id)
);

-- Flash Deals
CREATE TABLE IF NOT EXISTS flash_deals (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  discount_percent INTEGER NOT NULL,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  max_quantity INTEGER DEFAULT 0,
  sold INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Affiliates
CREATE TABLE IF NOT EXISTS affiliate_links (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  commission_percent NUMERIC(5,2) DEFAULT 0,
  code TEXT UNIQUE NOT NULL,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Live Shopping (products linked to lives)
CREATE TABLE IF NOT EXISTS live_products (
  id SERIAL PRIMARY KEY,
  live_id INTEGER NOT NULL REFERENCES lives(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  discount_percent INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Voice to Text transcriptions
CREATE TABLE IF NOT EXISTS voice_transcripts (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id),
  transcription TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games (minigames)
CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('wordle','trivia','karaoke')),
  max_players INTEGER DEFAULT 4,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  chat_id INTEGER NOT NULL REFERENCES chats(id),
  creator_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT DEFAULT 'waiting' CHECK(status IN ('waiting','playing','finished')),
  winner_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_players (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES game_sessions(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  score INTEGER DEFAULT 0,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, user_id)
);

-- Meme Generator
CREATE TABLE IF NOT EXISTS memes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  image_url TEXT NOT NULL,
  caption TEXT DEFAULT '',
  template TEXT DEFAULT '',
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meme_likes (
  id SERIAL PRIMARY KEY,
  meme_id INTEGER NOT NULL REFERENCES memes(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(meme_id, user_id)
);

-- Stickers
CREATE TABLE IF NOT EXISTS sticker_packs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES users(id),
  price NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stickers (
  id SERIAL PRIMARY KEY,
  pack_id INTEGER NOT NULL REFERENCES sticker_packs(id),
  image_url TEXT NOT NULL,
  emoji TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_stickers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  sticker_id INTEGER NOT NULL REFERENCES stickers(id),
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, sticker_id)
);

-- Avatar 3D customizations
CREATE TABLE IF NOT EXISTS avatar_customizations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
  avatar_json TEXT DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Focus Mode / Work Mode / Vibe Balance
CREATE TABLE IF NOT EXISTS vibe_balance (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
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
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  mode TEXT NOT NULL CHECK(mode IN ('focus','work','sleep')),
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  duration_minutes INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS smart_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  notification_type TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK(priority IN ('high','normal','low')),
  read INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Calendar sync / Shared notes / Tasks
CREATE TABLE IF NOT EXISTS shared_notes (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(id),
  title TEXT DEFAULT 'Notes',
  content TEXT DEFAULT '',
  updated_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_tasks (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(id),
  title TEXT NOT NULL,
  assigned_to INTEGER REFERENCES users(id),
  created_by INTEGER NOT NULL REFERENCES users(id),
  due_date TIMESTAMP,
  completed INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Watch Together
CREATE TABLE IF NOT EXISTS watch_sessions (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(id),
  creator_id INTEGER NOT NULL REFERENCES users(id),
  video_url TEXT NOT NULL,
  playback_time REAL DEFAULT 0,
  playing INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pinned chats (persistent)
ALTER TABLE chats ADD COLUMN IF NOT EXISTS pinned INTEGER DEFAULT 0;

-- Voice message support
ALTER TABLE messages ADD COLUMN IF NOT EXISTS voice_duration INTEGER DEFAULT 0;

-- Screen sharing (calls extension)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS screen_sharing INTEGER DEFAULT 0;

-- Message replies
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER REFERENCES messages(id);

-- Forwarded messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded INTEGER DEFAULT 0;
