CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
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
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  device_id TEXT DEFAULT '',
  device_name TEXT DEFAULT '',
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  contact_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, contact_user_id)
);

CREATE TABLE IF NOT EXISTS chats (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('private','group')),
  name TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_members (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(id),
  sender_id INTEGER NOT NULL REFERENCES users(id),
  text TEXT DEFAULT '',
  type TEXT DEFAULT 'text' CHECK(type IN ('text','image','system')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_reads (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  text TEXT DEFAULT '',
  media TEXT DEFAULT '',
  media_type TEXT DEFAULT 'text',
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS post_views (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_likes (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calls (
  id SERIAL PRIMARY KEY,
  caller_id INTEGER NOT NULL REFERENCES users(id),
  callee_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('audio','video')),
  status TEXT NOT NULL CHECK(status IN ('missed','completed','incoming','outgoing')),
  duration INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS two_step_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
  password_hash TEXT NOT NULL,
  hint TEXT DEFAULT '',
  enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS blocked_users (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  blocked_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, blocked_user_id)
);

CREATE TABLE IF NOT EXISTS privacy_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
  last_seen TEXT DEFAULT 'everyone' CHECK(last_seen IN ('everyone','contacts','nobody')),
  profile_photo TEXT DEFAULT 'everyone' CHECK(profile_photo IN ('everyone','contacts','nobody')),
  bio TEXT DEFAULT 'everyone' CHECK(bio IN ('everyone','contacts','nobody')),
  status TEXT DEFAULT 'contacts' CHECK(status IN ('everyone','contacts','nobody')),
  calls TEXT DEFAULT 'everyone' CHECK(calls IN ('everyone','contacts','nobody')),
  read_receipts INTEGER DEFAULT 1,
  message_history INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  video_url TEXT NOT NULL,
  thumbnail TEXT DEFAULT '',
  caption TEXT DEFAULT '',
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS video_likes (
  id SERIAL PRIMARY KEY,
  video_id INTEGER NOT NULL REFERENCES videos(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(video_id, user_id)
);

CREATE TABLE IF NOT EXISTS video_comments (
  id SERIAL PRIMARY KEY,
  video_id INTEGER NOT NULL REFERENCES videos(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lives (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT DEFAULT '',
  status TEXT DEFAULT 'live' CHECK(status IN ('live','ended')),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP
);
