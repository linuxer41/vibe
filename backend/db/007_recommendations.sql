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
