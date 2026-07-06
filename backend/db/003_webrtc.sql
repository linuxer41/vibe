-- WebRTC Calls & Live Streaming

CREATE TABLE IF NOT EXISTS active_calls (
  id SERIAL PRIMARY KEY,
  caller_id INTEGER NOT NULL REFERENCES users(id),
  callee_id INTEGER NOT NULL REFERENCES users(id),
  call_type TEXT NOT NULL CHECK(call_type IN ('audio','video')),
  status TEXT NOT NULL DEFAULT 'ringing' CHECK(status IN ('ringing','connecting','connected','ended')),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'live' CHECK(status IN ('live','ended')),
  viewer_count INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS broadcast_viewers (
  id SERIAL PRIMARY KEY,
  broadcast_id INTEGER NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(broadcast_id, user_id)
);
