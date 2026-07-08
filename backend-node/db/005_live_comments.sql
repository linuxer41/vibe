ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES post_comments(id);

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
