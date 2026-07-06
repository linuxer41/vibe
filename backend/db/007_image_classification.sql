-- Image classification: tags for ML-powered recommendations
-- Each post gets auto-generated tags from image analysis (color, brightness, content type)
-- These tags power the "For You" recommendation engine

-- post_tags table already exists (created in 001_init.sql)
-- This migration adds functions for managing tags and recommendations

-- Add tag index for faster tag-based lookups
CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag);

-- Save tags for a post (idempotent, uses ON CONFLICT)
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

-- Get tags for a post
CREATE OR REPLACE FUNCTION get_post_tags(p_post_id BIGINT)
RETURNS TEXT[] AS $$
  SELECT COALESCE(ARRAY_AGG(tag ORDER BY tag), '{}')
  FROM post_tags
  WHERE post_id = p_post_id;
$$ LANGUAGE sql;

-- Recommend posts by tag similarity to a user's interaction history
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