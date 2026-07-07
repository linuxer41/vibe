const crypto = require('crypto');
const http = require('http');
const { pool } = require('./pool');
const logger = require('../lib/logger');
const snowflake = require('../lib/snowflake');
const { retryQuery } = require('./pool');
const recommend = require('../lib/recommend');
const STORAGE_URL = process.env.STORAGE_URL || 'http://localhost:3002';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function init() {
  const MAX_RETRIES = 30;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      await pool.query('SELECT 1');
      logger.info({ component: 'db' }, 'Database connected');
      return;
    } catch (err) {
      logger.warn({ attempt: i + 1, err: err.message, action: 'db_connect' }, 'Esperando base de datos...');
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error(`No se pudo conectar a la base de datos tras ${MAX_RETRIES} intentos`);
}

async function close() {
  await pool.end();
  logger.info({ component: 'db' }, 'Database connection closed');
}

async function cleanupExpiredSessions() {
  try {
    const { rowCount } = await pool.query("DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '30 days'");
    if (rowCount > 0) logger.info({ deleted: rowCount, action: 'cleanup_sessions' }, 'Sesiones expiradas eliminadas');
  } catch (e) { logger.error({ err: e.message, action: 'cleanup_sessions' }, 'Error limpiando sesiones'); }
}

// --- AUTH ---

async function sendCode(phone) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const id = snowflake.generate();
  await pool.query(
    'INSERT INTO verification_codes (id, phone, code, expires_at) VALUES ($1, $2, $3, $4)',
    [id, phone, code, expires]
  );
  return code;
}

async function verifyCode(phone, code) {
  const { rows } = await pool.query(
    'SELECT id, expires_at FROM verification_codes WHERE phone = $1 AND code = $2 AND used = 0 ORDER BY id DESC FETCH FIRST 1 ROWS ONLY',
    [phone, code]
  );
  if (rows.length > 0 && new Date(rows[0].expires_at) > new Date()) {
    await pool.query('UPDATE verification_codes SET used = 1 WHERE id = $1', [rows[0].id]);
    return true;
  }
  return false;
}

async function findOrCreateUser(phone, username, displayName, countryCode = '') {
  const { rows } = await pool.query(
    'SELECT id, username, display_name, avatar, bio, country_code FROM users WHERE phone = $1',
    [phone]
  );
  if (rows.length > 0) {
    return { user: rows[0], isNew: false };
  }
  const userId = snowflake.generate();
  logger.info({ userId, phone, action: 'register' }, 'Nuevo usuario registrado con Snowflake ID');
  const { rows: newRows } = await pool.query(
    'INSERT INTO users (id, phone, username, display_name, country_code) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, display_name, avatar, bio, country_code',
    [userId, phone, username, displayName, countryCode]
  );
  return { user: newRows[0], isNew: true };
}

async function createSession(userId, deviceId = '', deviceName = '') {
  const token = generateToken();
  await pool.query(
    'INSERT INTO sessions (user_id, token, device_id, device_name) VALUES ($1, $2, $3, $4)',
    [userId, token, deviceId, deviceName]
  );
  return token;
}

async function getSession(token) {
  const { rows } = await pool.query(
    `SELECT u.id, u.phone, u.username, u.display_name, u.avatar, u.bio, u.country_code, p.created_at
     FROM sessions p JOIN users u ON p.user_id = u.id WHERE p.token = $1
     AND p.created_at > NOW() - INTERVAL '30 days'`,
    [token]
  );
  return rows.length > 0 ? rows[0] : null;
}

// --- USERS / CONTACTS ---

async function getUserById(id) {
  const { rows } = await pool.query(
    'SELECT id, phone, username, display_name, avatar, bio, country_code FROM users WHERE id = $1',
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

async function searchUsers(query) {
  const like = `%${query}%`;
  const { rows } = await pool.query(
    'SELECT id, phone, username, display_name, avatar FROM users WHERE phone LIKE $1 OR username LIKE $2 OR display_name LIKE $3 FETCH FIRST 20 ROWS ONLY',
    [like, like, like]
  );
  return rows;
}

async function addContact(userId, contactUserId) {
  try {
    await pool.query(
      'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, contactUserId]
    );
    await pool.query(
      'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [contactUserId, userId]
    );
    return true;
  } catch { return false; }
}

async function getContacts(userId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.phone, u.username, u.display_name, u.avatar, u.bio
     FROM contacts c JOIN users u ON c.contact_user_id = u.id WHERE c.user_id = $1 ORDER BY u.display_name`,
    [userId]
  );
  return rows;
}

// --- CHATS ---

async function createPrivateChat(user1Id, user2Id) {
  const existing = await getPrivateChat(user1Id, user2Id);
  if (existing) return existing;
  const { rows } = await pool.query(
    'INSERT INTO chats (type, name, created_by) VALUES ($1, $2, $3) RETURNING id',
    ['private', '', user1Id]
  );
  const chatId = rows[0].id;
  await pool.query('INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2), ($3, $4)',
    [chatId, user1Id, chatId, user2Id]);
  return chatId;
}

async function getPrivateChat(user1Id, user2Id) {
  const { rows } = await pool.query(
    `SELECT c.id FROM chats c
     WHERE c.type = 'private'
     AND (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id) = 2
     AND (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id AND user_id IN ($1, $2)) = 2`,
    [user1Id, user2Id]
  );
  return rows.length > 0 ? rows[0].id : null;
}

async function createGroup(name, createdBy, memberIds) {
  const { rows } = await pool.query(
    'INSERT INTO chats (type, name, created_by) VALUES ($1, $2, $3) RETURNING id',
    ['group', name, createdBy]
  );
  const chatId = rows[0].id;
  const allMembers = [...new Set([createdBy, ...memberIds])];
  for (const uid of allMembers) {
    try {
      await pool.query(
        'INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [chatId, uid]
      );
    } catch {}
  }
  return chatId;
}

async function getUserChats(userId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.type, c.name, c.avatar, c.created_at, c.pinned,
     (SELECT text FROM messages WHERE chat_id = c.id ORDER BY id DESC FETCH FIRST 1 ROWS ONLY) as last_message,
     (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY id DESC FETCH FIRST 1 ROWS ONLY) as last_message_time,
     (SELECT sender_id FROM messages WHERE chat_id = c.id ORDER BY id DESC FETCH FIRST 1 ROWS ONLY) as last_sender_id
     FROM chats c JOIN chat_members cm ON c.id = cm.chat_id WHERE cm.user_id = $1
     ORDER BY c.pinned DESC, last_message_time DESC NULLS LAST`,
    [userId]
  );
  for (const chat of rows) {
    const { rows: unreadRows } = await pool.query(
      `SELECT COUNT(*) as cnt FROM messages m
       WHERE m.chat_id = $1 AND m.id > COALESCE(
         (SELECT MAX(mr.message_id) FROM message_reads mr WHERE mr.user_id = $2 AND mr.message_id IN (SELECT id FROM messages WHERE chat_id = $1)), 0
       ) AND m.sender_id != $2`,
      [chat.id, userId]
    );
    chat.unread = parseInt(unreadRows[0].cnt, 10);
    if (chat.type === 'private') {
      const { rows: memberRows } = await pool.query(
        'SELECT u.id, u.display_name, u.avatar FROM chat_members cm JOIN users u ON cm.user_id = u.id WHERE cm.chat_id = $1 AND cm.user_id != $2',
        [chat.id, userId]
      );
      if (memberRows.length > 0) {
        const other = memberRows[0];
        chat.name = chat.name || other.display_name;
        chat.avatar = chat.avatar || other.avatar;
      }
    }
  }
  return rows;
}

async function getChatMembers(chatId) {
  const { rows } = await pool.query(
    'SELECT u.id, u.phone, u.username, u.display_name, u.avatar FROM chat_members cm JOIN users u ON cm.user_id = u.id WHERE cm.chat_id = $1',
    [chatId]
  );
  return rows;
}

async function addChatMember(chatId, userId) {
  try {
    await pool.query(
      'INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [chatId, userId]
    );
    return true;
  } catch { return false; }
}

// --- MESSAGES ---

async function addMessage(chatId, senderId, text, type = 'text', replyToId = null) {
  const msgId = snowflake.generate();
  await pool.query(
    'INSERT INTO messages (id, chat_id, sender_id, text, type, reply_to_id) VALUES ($1, $2, $3, $4, $5, $6)',
    [msgId, chatId, senderId, text, type, replyToId]
  );
  return msgId;
}

async function getMessages(chatId, limit = 50, cursor = null) {
  let sql = `SELECT m.*, u.display_name as sender_name, u.avatar as sender_avatar
     FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.chat_id = $1`;
  const params = [chatId];
  if (cursor) {
    sql += ' AND m.created_at < $2';
    params.push(cursor);
  }
  sql += ' ORDER BY m.created_at DESC FETCH FIRST $' + (params.length + 1) + ' ROWS ONLY';
  params.push(limit);
  const { rows } = await pool.query(sql, params);
  return rows.reverse();
}

async function markRead(messageId, userId) {
  try {
    await pool.query(
      'INSERT INTO message_reads (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [messageId, userId]
    );
  } catch {}
}

async function searchMessages(chatId, query, limit = 50) {
  const { rows } = await pool.query(
    `SELECT m.*, u.display_name as sender_name, u.avatar as sender_avatar
     FROM messages m JOIN users u ON m.sender_id = u.id
     WHERE m.chat_id = $1 AND m.text ILIKE $2
     ORDER BY m.created_at DESC FETCH FIRST $3 ROWS ONLY`,
    [chatId, `%${query}%`, limit]
  );
  return rows.reverse();
}

async function deleteMessage(messageId, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM messages WHERE id = $1 AND sender_id = $2',
    [messageId, userId]
  );
  return rowCount > 0;
}

// --- CALLS ---

async function addCall(callerId, calleeId, type, status, duration = 0) {
  const { rows } = await pool.query(
    'INSERT INTO calls (caller_id, callee_id, type, status, duration) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [callerId, calleeId, type, status, duration]
  );
  return rows[0].id;
}

async function getUserCalls(userId, limit = 30) {
  const { rows } = await pool.query(
    `SELECT c.*,
     CASE WHEN c.caller_id = $1 THEN 'outgoing' WHEN c.callee_id = $1 THEN 'incoming' ELSE c.status END as direction,
     u.id as other_id, u.display_name as other_name, u.avatar as other_avatar
     FROM calls c JOIN users u ON (CASE WHEN c.caller_id = $1 THEN c.callee_id ELSE c.caller_id END) = u.id
     WHERE c.caller_id = $1 OR c.callee_id = $1
     ORDER BY c.id DESC FETCH FIRST $2 ROWS ONLY`,
    [userId, limit]
  );
  return rows;
}

// --- WEBRTC CALLS ---

async function createActiveCall(callerId, calleeId, callType) {
  const { rows } = await pool.query(
    'INSERT INTO active_calls (caller_id, callee_id, call_type) VALUES ($1, $2, $3) RETURNING *',
    [callerId, calleeId, callType]
  );
  return rows[0];
}

async function getActiveCall(callId) {
  const { rows } = await pool.query(
    `SELECT ac.*, u1.display_name as caller_name, u1.avatar as caller_avatar,
     u2.display_name as callee_name, u2.avatar as callee_avatar
     FROM active_calls ac
     JOIN users u1 ON ac.caller_id = u1.id
     JOIN users u2 ON ac.callee_id = u2.id
     WHERE ac.id = $1`,
    [callId]
  );
  return rows[0];
}

async function getActiveCallBetweenUsers(user1, user2) {
  const { rows } = await pool.query(
    `SELECT * FROM active_calls
     WHERE ((caller_id = $1 AND callee_id = $2) OR (caller_id = $2 AND callee_id = $1))
     AND status != 'ended'`,
    [user1, user2]
  );
  return rows[0];
}

async function getUserActiveCalls(userId) {
  const { rows } = await pool.query(
    `SELECT ac.*, u1.display_name as caller_name, u1.avatar as caller_avatar,
     u2.display_name as callee_name, u2.avatar as callee_avatar
     FROM active_calls ac
     JOIN users u1 ON ac.caller_id = u1.id
     JOIN users u2 ON ac.callee_id = u2.id
     WHERE (ac.caller_id = $1 OR ac.callee_id = $1) AND ac.status != 'ended'
     ORDER BY ac.started_at DESC`,
    [userId]
  );
  return rows;
}

async function updateCallStatus(callId, status) {
  await pool.query(
    'UPDATE active_calls SET status = $1 WHERE id = $2',
    [status, callId]
  );
}

async function endActiveCall(callId) {
  const { rows } = await pool.query(
    `UPDATE active_calls SET status = 'ended', ended_at = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING *`,
    [callId]
  );
  return rows[0];
}

// --- BROADCASTS (LIVE STREAMING) ---

async function startBroadcast(userId, title = '') {
  const { rows } = await pool.query(
    'INSERT INTO broadcasts (user_id, title) VALUES ($1, $2) RETURNING *',
    [userId, title]
  );
  return rows[0];
}

async function stopBroadcast(broadcastId) {
  const { rows } = await pool.query(
    `UPDATE broadcasts SET status = 'ended', ended_at = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING *`,
    [broadcastId]
  );
  return rows[0];
}

async function getActiveBroadcasts() {
  const { rows } = await pool.query(
    `SELECT b.*, u.display_name, u.avatar
     FROM broadcasts b JOIN users u ON b.user_id = u.id
     WHERE b.status = 'live'
     ORDER BY b.started_at DESC`,
  );
  return rows;
}

async function getBroadcast(broadcastId) {
  const { rows } = await pool.query(
    `SELECT b.*, u.display_name, u.avatar
     FROM broadcasts b JOIN users u ON b.user_id = u.id
     WHERE b.id = $1`,
    [broadcastId]
  );
  return rows[0];
}

async function addBroadcastViewer(broadcastId, userId) {
  await pool.query(
    'INSERT INTO broadcast_viewers (broadcast_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [broadcastId, userId]
  );
  await pool.query(
    'UPDATE broadcasts SET viewer_count = (SELECT COUNT(*) FROM broadcast_viewers WHERE broadcast_id = $1) WHERE id = $1',
    [broadcastId]
  );
}

async function removeBroadcastViewer(broadcastId, userId) {
  await pool.query(
    'DELETE FROM broadcast_viewers WHERE broadcast_id = $1 AND user_id = $2',
    [broadcastId, userId]
  );
  await pool.query(
    'UPDATE broadcasts SET viewer_count = (SELECT COUNT(*) FROM broadcast_viewers WHERE broadcast_id = $1) WHERE id = $1',
    [broadcastId]
  );
}

async function getBroadcastViewers(broadcastId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.display_name, u.avatar FROM broadcast_viewers bv
     JOIN users u ON bv.user_id = u.id WHERE bv.broadcast_id = $1`,
    [broadcastId]
  );
  return rows;
}

// --- POSTS ---

async function classifyMedia(mediaUrl) {
  if (!mediaUrl || mediaUrl.startsWith('https://i.pravatar.cc')) return [];
  const filename = mediaUrl.split('/').pop();
  return new Promise((resolve) => {
    const urlObj = new URL(`${STORAGE_URL}/classify`);
    const data = JSON.stringify({ filename });
    const req = http.request(urlObj, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 5000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try { const r = JSON.parse(body); resolve(r.tags || []); }
        catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.write(data);
    req.end();
  });
}

async function storeVisualTags(postId, tags) {
  if (!tags.length) return;
  for (const tag of tags) {
    await pool.query(
      'INSERT INTO post_tags (id, post_id, tag) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [snowflake.generate(), postId, `__vis_${tag}`]
    ).catch(() => {});
  }
  const tagToIdx = await getOrBuildTagIndex();
  const existing = await pool.query('SELECT tags FROM global_embeddings WHERE post_id = $1', [postId]);
  const existingTags = existing.rows.length ? existing.rows[0].tags || [] : [];
  const allTags = [...new Set([...existingTags, ...tags.map(t => `__vis_${t}`)])];
  const emb = recommend.buildPostEmbedding(allTags, tagToIdx);
  await pool.query(
    `INSERT INTO global_embeddings (id, post_id, embedding, tags)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (post_id) DO UPDATE SET embedding = $3, tags = $4`,
    [snowflake.generate(), postId, JSON.stringify(emb), allTags]
  ).catch(() => {});
}

async function createPost(userId, text, media = '', mediaType = 'text') {
  const postId = snowflake.generate();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { rows } = await pool.query(
    'INSERT INTO posts (id, user_id, text, media, media_type, expires_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, text, media, media_type, created_at',
    [postId, userId, text, media, mediaType, expires]
  );
  storePostTags(postId, text).catch(() => {});
  if (media && mediaType === 'image') {
    classifyMedia(media).then(tags => {
      if (tags.length) {
        storeVisualTags(postId, tags).catch(e => logger.error({ err: e.message, postId, action: 'store_visual_tags' }, 'Error guardando tags visuales'));
      }
    }).catch(() => {});
  }
  return { ...rows[0], likes_count: 0, comments_count: 0 };
}

async function getPosts(userId, filter = 'all', cursor = null, limit = 20) {
  const conditions = ["p.expires_at > NOW()"];
  const params = [];
  let idx = 1;

  params.push(limit);
  const limitP = `$${idx++}`;

  if (cursor) {
    conditions.push(`p.created_at < $${idx++}`);
    params.push(cursor);
  }

  if (filter === 'contacts') {
    conditions.push(`(p.user_id = $${idx++} OR p.user_id IN (SELECT contact_user_id FROM contacts WHERE user_id = $${idx++}))`);
    params.push(userId, userId);
  } else if (filter === 'mine') {
    conditions.push(`p.user_id = $${idx++}`);
    params.push(userId);
  }

  let sql;
  if (filter === 'all') {
    sql = `SELECT p.*, u.display_name, u.avatar,
      (SELECT COUNT(*) FROM post_views WHERE post_id = p.id) as views,
      NULL as live_title, NULL as live_status
      FROM posts p JOIN users u ON p.user_id = u.id
      WHERE ${conditions.join(' AND ')}
      UNION ALL
      SELECT l.id AS id, l.user_id, l.title AS text, '' AS media, 'live' AS media_type,
        u.display_name, u.avatar, l.started_at AS created_at,
        l.started_at + INTERVAL '24 hours' AS expires_at,
        0 AS views, 0 AS likes_count, 0 AS comments_count,
        l.title AS live_title, l.status AS live_status
      FROM lives l JOIN users u ON l.user_id = u.id
      WHERE l.status = 'live'
      ORDER BY created_at DESC FETCH FIRST ${limitP} ROWS ONLY`;
  } else {
    sql = `SELECT p.*, u.display_name, u.avatar,
      (SELECT COUNT(*) FROM post_views WHERE post_id = p.id) as views,
      NULL as live_title, NULL as live_status
      FROM posts p JOIN users u ON p.user_id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.created_at DESC FETCH FIRST ${limitP} ROWS ONLY`;
  }
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function viewPost(statusId, userId) {
  try {
    await pool.query(
      'INSERT INTO post_views (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [statusId, userId]
    );
  } catch {}
}

async function getPostViews(statusId) {
  const { rows } = await pool.query(
    'SELECT u.id, u.display_name, u.avatar, sv.viewed_at FROM post_views sv JOIN users u ON sv.user_id = u.id WHERE sv.post_id = $1',
    [statusId]
  );
  return rows;
}

async function likePost(postId, userId) {
  try {
    await pool.query(
      'INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [postId, userId]
    );
    await pool.query(
      'UPDATE posts SET likes_count = (SELECT COUNT(*) FROM post_likes WHERE post_id = $1) WHERE id = $1',
      [postId]
    );
    return true;
  } catch { return false; }
}

async function unlikePost(postId, userId) {
  try {
    await pool.query(
      'DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );
    await pool.query(
      'UPDATE posts SET likes_count = (SELECT COUNT(*) FROM post_likes WHERE post_id = $1) WHERE id = $1',
      [postId]
    );
    return true;
  } catch { return false; }
}

async function hasUserLikedPost(postId, userId) {
  const { rows } = await pool.query(
    'SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2',
    [postId, userId]
  );
  return rows.length > 0;
}

async function addPostComment(postId, userId, text, parentId = null) {
  const { rows } = await pool.query(
    'INSERT INTO post_comments (post_id, user_id, text, parent_id) VALUES ($1, $2, $3, $4) RETURNING id, post_id, user_id, text, parent_id, created_at',
    [postId, userId, text, parentId]
  );
  await pool.query(
    'UPDATE posts SET comments_count = (SELECT COUNT(*) FROM post_comments WHERE post_id = $1) WHERE id = $1',
    [postId]
  );
  return rows[0];
}

async function getPostComments(statusId) {
  const { rows } = await pool.query(
    `SELECT sc.*, u.display_name, u.avatar, u.username
     FROM post_comments sc JOIN users u ON sc.user_id = u.id WHERE sc.post_id = $1 ORDER BY sc.created_at ASC`,
    [statusId]
  );
  return rows;
}

// --- RECOMMENDATION ENGINE v3 (Advanced Two-Tower + MMR + Bandit) ---

async function storePostTags(postId, text, mediaType = 'text') {
  const textTags = recommend.extractTags(text, mediaType);
  for (const tag of textTags) {
    await pool.query(
      'INSERT INTO post_tags (id, post_id, tag) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [snowflake.generate(), postId, tag]
    );
  }
  const tagToIdx = await getOrBuildTagIndex();
  const existing = await pool.query('SELECT tags FROM global_embeddings WHERE post_id = $1', [postId]);
  const existingTags = existing.rows.length ? existing.rows[0].tags || [] : [];
  const allTags = [...new Set([...existingTags, ...textTags])];
  const emb = recommend.buildPostEmbedding(allTags, tagToIdx);
  await pool.query(
    `INSERT INTO global_embeddings (id, post_id, embedding, tags)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (post_id) DO UPDATE SET embedding = $3, tags = $4`,
    [snowflake.generate(), postId, JSON.stringify(emb), allTags]
  );
}

async function getOrBuildTagIndex() {
  const { rows } = await pool.query('SELECT DISTINCT tag FROM post_tags');
  const idx = {};
  rows.forEach((r, i) => { idx[r.tag] = i; });
  return idx;
}

async function getOrCreateUserEmbedding(userId) {
  const { rows } = await pool.query('SELECT embedding, momentum, total_interactions, slot_counter FROM user_embeddings WHERE user_id = $1', [userId]);
  if (rows.length) {
    return {
      embedding: rows[0].embedding,
      momentum: rows[0].momentum || [],
      totalInteractions: rows[0].total_interactions,
      slotCounter: rows[0].slot_counter,
    };
  }
  // Cold start: build initial embedding from profile text
  const dim = recommend.D;
  const { rows: userRows } = await pool.query('SELECT bio, display_name, username FROM users WHERE id = $1', [userId]);
  let emb = new Array(dim).fill(0);
  if (userRows.length) {
    const profileTags = new Set();
    const u = userRows[0];
    if (u.display_name) recommend.extractTags(u.display_name, 'text').forEach(t => profileTags.add(t));
    if (u.bio) recommend.extractTags(u.bio, 'text').forEach(t => profileTags.add(t));
    if (u.username) profileTags.add(`@${u.username.toLowerCase()}`);
    if (profileTags.size) {
      const tagToIdx = await getOrBuildTagIndex();
      emb = recommend.buildPostEmbedding([...profileTags], tagToIdx);
    }
  }
  const zeroMom = new Array(dim).fill(0);
  await pool.query(
    'INSERT INTO user_embeddings (id, user_id, embedding, momentum, total_interactions, slot_counter) VALUES ($1, $2, $3, $4, 0, 0)',
    [snowflake.generate(), userId, JSON.stringify(emb), JSON.stringify(zeroMom)]
  );
  return { embedding: emb, momentum: zeroMom, totalInteractions: 0, slotCounter: 0 };
}

async function saveUserEmbedding(userId, embedding, momentum, totalInteractions, slotCounter) {
  await pool.query(
    `UPDATE user_embeddings SET embedding = $1, momentum = $2, total_interactions = $3, slot_counter = $4, updated_at = NOW()
     WHERE user_id = $5`,
    [JSON.stringify(embedding), JSON.stringify(momentum), totalInteractions, slotCounter, userId]
  );
}

async function recordInteraction(userId, postId, type, value = 1) {
  const id = snowflake.generate();
  const weight = recommend.interactionWeight(type, value);
  const upsert = type === 'dwell'
    ? `INSERT INTO post_interactions (id, user_id, post_id, interaction_type, weight, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, post_id, interaction_type) DO UPDATE SET weight = $5, created_at = NOW()`
    : `INSERT INTO post_interactions (id, user_id, post_id, interaction_type, weight, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, post_id, interaction_type) DO NOTHING`;
  await pool.query(upsert, [id, userId, postId, type, weight]);

  // Decay old interests
  await pool.query('UPDATE user_interests SET score = score * $2 WHERE user_id = $1', [userId, 0.85]);

  // Update interest keywords
  const { rows: postRows } = await pool.query('SELECT text, media_type FROM posts WHERE id = $1', [postId]);
  if (postRows.length) {
    const tags = recommend.extractTags(postRows[0].text, postRows[0].media_type);
    for (const tag of tags) {
      await pool.query(
        `INSERT INTO user_interests (id, user_id, keyword, score)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, keyword) DO UPDATE
         SET score = user_interests.score + $4, updated_at = NOW()`,
        [snowflake.generate(), userId, tag, weight * 0.5]
      );
    }
  }

  // Online learning: update user embedding
  try {
    const { rows: ge } = await pool.query('SELECT embedding, tags FROM global_embeddings WHERE post_id = $1', [postId]);
    if (ge.length && ge[0].embedding) {
      const userData = await getOrCreateUserEmbedding(userId);
      const postEmb = JSON.parse(ge[0].embedding);
      const momentum = userData.momentum.length ? userData.momentum : new Array(recommend.D).fill(0);

      // Negative interactions invert the update direction
      const effWeight = type === 'negative' ? -Math.abs(weight) : weight;

      const newEmb = recommend.updateUserEmbedding(
        userData.embedding, postEmb, effWeight, momentum
      );
      const newMom = momentum; // updated in-place by updateUserEmbedding's momentumBuf concept
      // Simple momentum update: blend old and new
      for (let i = 0; i < newMom.length; i++) {
        newMom[i] = recommend.MOMENTUM * (newMom[i] || 0) + (1 - recommend.MOMENTUM) * (newEmb[i] - userData.embedding[i]);
      }

      await saveUserEmbedding(
        userId, newEmb, newMom,
        userData.totalInteractions + 1,
        userData.slotCounter + 1
      );
    }
  } catch (e) {
    // Non-critical; log but don't fail
    console.error('Embedding update error:', e.message);
  }
}

async function getRecommendedPosts(userId, cursor = null, limit = 10, seenPostIds = []) {
  const client = await pool.connect();
  try {
    const excludeIds = new Set([...seenPostIds]);
    const { rows: alreadySeen } = await client.query(
      'SELECT DISTINCT post_id FROM post_interactions WHERE user_id = $1', [userId]
    );
    alreadySeen.forEach(r => excludeIds.add(r.post_id));

    // 1. Get or build tag index
    const tagToIdx = await getOrBuildTagIndex();

    // 2. Get user embedding and training state
    const userData = await getOrCreateUserEmbedding(userId);
    const userEmb = userData.embedding;
    const totalInteractions = userData.totalInteractions;
    const slotCounter = userData.slotCounter;
    const isColdStart = totalInteractions < 3;
    const mmrLambda = isColdStart ? 0.4 : 0.65; // more diversity for cold users

    // 3. Candidate pool: global_embeddings NOT seen + fresh posts
    const { rows: candidates } = await client.query(`
      SELECT ge.post_id, ge.embedding, ge.tags, p.text, p.media, p.media_type, p.created_at, p.user_id,
        p.user_id AS creator_id,
        u.display_name, u.avatar, u.username,
        (SELECT COUNT(*) FROM post_views WHERE post_id = p.id) as views,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comments_count,
        COALESCE((SELECT SUM(weight) FROM post_interactions WHERE post_id = p.id AND created_at > NOW() - INTERVAL '24 hours'), 0) as recent_engagement
      FROM global_embeddings ge
      JOIN posts p ON p.id = ge.post_id
      JOIN users u ON u.id = p.user_id
      WHERE p.expires_at > NOW()
      AND ge.post_id != ALL($1::bigint[])
      ORDER BY p.created_at DESC
      FETCH FIRST 30 ROWS ONLY0
    `, [excludeIds.size ? [...excludeIds] : [0]]);

    if (!candidates.length) return [];

    // 4. Get user interests and creator counts for scoring
    const { rows: interests } = await client.query(
      'SELECT keyword FROM user_interests WHERE user_id = $1 ORDER BY score DESC FETCH FIRST 30 ROWS ONLY', [userId]
    );
    const userKeywords = new Set(interests.map(r => r.keyword));

    const { rows: creatorInteractions } = await client.query(`
      SELECT p.user_id as creator_id, COUNT(*) as cnt
      FROM post_interactions pi JOIN posts p ON p.id = pi.post_id
      WHERE pi.user_id = $1
      GROUP BY p.user_id
    `, [userId]);
    const creatorCounts = Object.fromEntries(creatorInteractions.map(r => [r.creator_id, parseInt(r.cnt)]));

    // 5. Score all candidates
    const maxPop = Math.max(...candidates.map(c => parseFloat(c.recent_engagement) || 0), 1);
    const coldRatio = isColdStart ? Math.max(0, 1 - totalInteractions / 5) : 0;
    const scored = [];

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const postEmb = JSON.parse(c.embedding);
      const hoursAge = (Date.now() - new Date(c.created_at).getTime()) / 3600000;
      const tags = c.tags || [];

      // Core relevance: dot product
      const relevance = recommend.scoreUserPost(userEmb, postEmb);

      // Freshness kernel
      const freshness = recommend.freshnessScore(hoursAge);

      // Short-term engagement prediction
      const shortTerm = Math.tanh((parseFloat(c.recent_engagement) || 0) * 0.05);

      // Long-term value: creators with history + text posts
      const longTerm = (c.text && c.text.length > 50) ? 0.6 : 0.3;

      // Creator diversity: penalize if seen this creator a lot
      const creatorCnt = creatorCounts[c.creator_id] || 0;
      const creatorDiversity = Math.max(0, 1 - creatorCnt / 20);

      // Tag novelty: check overlap with user interests
      const knownTags = tags.filter(t => userKeywords.has(t)).length;
      const tagNovelty = tags.length ? 1 - knownTags / tags.length : 1;

      const normalScore = recommend.computeFinalScoreAdvanced({
        relevance,
        freshness,
        globalPop: parseFloat(c.recent_engagement) || 0,
        maxPop,
        position: i,
        shortTerm,
        longTerm,
        creatorDiversity,
        tagNovelty,
      });

      // Cold-start blend: favor freshness + novelty when user has no history
      const coldScore = freshness * 0.35 + tagNovelty * 0.20 + creatorDiversity * 0.15
        + Math.tanh(parseFloat(c.recent_engagement) || 0) * 0.20
        + relevance * 0.10;
      const finalScore = (1 - coldRatio) * normalScore + coldRatio * coldScore;

      scored.push({
        id: c.post_id,
        text: c.text,
        media: c.media,
        media_type: c.media_type,
        created_at: c.created_at,
        user_id: c.user_id,
        display_name: c.display_name,
        avatar: c.avatar,
        username: c.username,
        views: parseInt(c.views) || 0,
        likes_count: parseInt(c.likes_count) || 0,
        comments_count: parseInt(c.comments_count) || 0,
        recommended_score: Math.round(finalScore * 10000) / 10000,
        matched_interests: tags.filter(t => userKeywords.has(t)).slice(0, 5),
        post_embedding: postEmb,
      });
    }

    // 5. Sort by score descending
    scored.sort((a, b) => b.recommended_score - a.recommended_score);

    // 6. MMR re-ranking for diversity
    const postEmbs = scored.map(p => p.post_embedding);
    const relevanceScores = scored.map(p => p.recommended_score);
    const postIds = scored.map(p => p.id);
    const mmrOrderedIds = recommend.mmrSelect(postIds, relevanceScores, postEmbs, mmrLambda, limit * 2);

    // 7. Apply bandit: force exploration
    const banditExplore = recommend.shouldExplore(totalInteractions, slotCounter);
    let finalOrder;
    if (banditExplore && candidates.length > limit) {
      // Pick a random high-freshness post from bottom half
      const explorePool = scored.filter(p => !mmrOrderedIds.slice(0, limit).includes(p.id));
      const freshPool = explorePool.filter(p => (Date.now() - new Date(p.created_at).getTime()) < 7200000);
      const pool = freshPool.length >= 3 ? freshPool : explorePool;
      const explorePick = pool[Math.floor(Math.random() * pool.length)];
      if (explorePick) {
        finalOrder = mmrOrderedIds.slice(0, limit - 1);
        finalOrder.push(explorePick.id);
      } else {
        finalOrder = mmrOrderedIds.slice(0, limit);
      }
    } else {
      finalOrder = mmrOrderedIds.slice(0, limit);
    }

    // 8. Reconstruct result in MMR order
    const resultMap = Object.fromEntries(scored.map(p => [p.id, p]));
    const result = finalOrder.map(id => resultMap[id]).filter(Boolean);

    // 9. Clean embeddings before returning
    return result.map(({ post_embedding, ...rest }) => rest);
  } finally {
    client.release();
  }
}

async function getTrendingTags(limit = 20) {
  const { rows } = await pool.query(
    `SELECT pt.tag, COUNT(DISTINCT pi.user_id) as engagers
     FROM post_tags pt
     JOIN post_interactions pi ON pi.post_id = pt.post_id AND pi.created_at > NOW() - INTERVAL '24 hours'
     GROUP BY pt.tag ORDER BY engagers DESC FETCH FIRST $1 ROWS ONLY`,
    [limit]
  );
  return rows;
}
async function addLiveComment(liveId, userId, text) {
  const id = snowflake.generate();
  const { rows } = await pool.query(
    'INSERT INTO live_comments (id, live_id, user_id, text) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, liveId, userId, text]
  );
  return rows[0];
}

async function getLiveComments(liveId, cursor = null, limit = 50) {
  const { rows } = await pool.query(
    `SELECT lc.*, u.display_name, u.avatar, u.username
     FROM live_comments lc JOIN users u ON lc.user_id = u.id
     WHERE lc.live_id = $1 ${cursor ? 'AND lc.created_at > $3' : ''}
     ORDER BY lc.created_at ASC FETCH FIRST $2 ROWS ONLY`,
    cursor ? [liveId, limit, cursor] : [liveId, limit]
  );
  return rows;
}

async function addLiveReaction(liveId, userId, reaction) {
  const id = snowflake.generate();
  const { rows } = await pool.query(
    'INSERT INTO live_reactions (id, live_id, user_id, reaction) VALUES ($1, $2, $3, $4) ON CONFLICT (live_id, user_id, reaction) DO NOTHING RETURNING *',
    [id, liveId, userId, reaction]
  );
  return rows[0] || null;
}

async function getLiveReactions(liveId) {
  const { rows } = await pool.query(
    `SELECT lr.*, u.display_name, u.avatar, u.username
     FROM live_reactions lr JOIN users u ON lr.user_id = u.id
     WHERE lr.live_id = $1 ORDER BY lr.created_at DESC`,
    [liveId]
  );
  return rows;
}

// --- LIVE STARS / GIFTS ---
async function getUserStars(userId) {
  const today = new Date().toISOString().split('T')[0];
  const { rows } = await pool.query(
    'SELECT stars FROM vibe_balance WHERE user_id = $1 AND date = $2',
    [userId, today]
  );
  return rows.length > 0 ? rows[0].stars : 0;
}

async function spendStars(userId, amount) {
  const today = new Date().toISOString().split('T')[0];
  const { rows } = await pool.query(
    `INSERT INTO vibe_balance (user_id, date, stars) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, date) DO UPDATE SET stars = vibe_balance.stars + $3
     RETURNING stars`,
    [userId, today, -amount]
  );
  return rows[0]?.stars ?? 0;
}

async function sendLiveGift(liveId, senderId, recipientId, stars, message = '') {
  const id = snowflake.generate();
  const balance = await spendStars(senderId, stars);
  if (balance < 0) return null;
  const { rows } = await pool.query(
    'INSERT INTO live_gifts (id, live_id, sender_id, recipient_id, stars, message) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [id, liveId, senderId, recipientId, stars, message]
  );
  return rows[0];
}

async function getLiveGifts(liveId) {
  const { rows } = await pool.query(
    `SELECT lg.*, su.display_name as sender_name, su.avatar as sender_avatar, su.username as sender_username,
            ru.display_name as recipient_name, ru.avatar as recipient_avatar
     FROM live_gifts lg
     JOIN users su ON lg.sender_id = su.id
     JOIN users ru ON lg.recipient_id = ru.id
     WHERE lg.live_id = $1 ORDER BY lg.created_at DESC`,
    [liveId]
  );
  return rows;
}

// --- ONLINE USERS ---
const onlineUsers = new Set();

function setOnline(userId) { onlineUsers.add(userId); }
function setOffline(userId) { onlineUsers.delete(userId); }
function isOnline(userId) { return onlineUsers.has(userId); }
function getOnlineUsers() { return [...onlineUsers]; }

// --- PROFILE ---

async function updateProfile(userId, fields) {
  const sets = [];
  const params = [];
  let idx = 1;
  if (fields.display_name !== undefined) { sets.push(`display_name = $${idx++}`); params.push(fields.display_name); }
  if (fields.username !== undefined) { sets.push(`username = $${idx++}`); params.push(fields.username); }
  if (fields.avatar !== undefined) { sets.push(`avatar = $${idx++}`); params.push(fields.avatar); }
  if (fields.bio !== undefined) { sets.push(`bio = $${idx++}`); params.push(fields.bio); }
  if (sets.length === 0) return;
  params.push(userId);
  await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`, params);
}

// --- TWO-STEP VERIFICATION ---

async function setTwoStepPassword(userId, password, hint = '') {
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  await pool.query(
    `INSERT INTO two_step_settings (user_id, password_hash, hint, enabled)
     VALUES ($1, $2, $3, 1) ON CONFLICT(user_id) DO UPDATE SET password_hash = $2, hint = $3, enabled = 1`,
    [userId, hash, hint]
  );
}

async function verifyTwoStepPassword(userId, password) {
  const { rows } = await pool.query(
    'SELECT password_hash, enabled FROM two_step_settings WHERE user_id = $1',
    [userId]
  );
  if (rows.length > 0) {
    if (!rows[0].enabled) return true;
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    return hash === rows[0].password_hash;
  }
  return true;
}

async function disableTwoStep(userId) {
  await pool.query('UPDATE two_step_settings SET enabled = 0 WHERE user_id = $1', [userId]);
}

async function getTwoStepStatus(userId) {
  const { rows } = await pool.query(
    'SELECT enabled, hint FROM two_step_settings WHERE user_id = $1',
    [userId]
  );
  return rows.length > 0 ? rows[0] : { enabled: 0, hint: '' };
}

// --- BLOCKED USERS ---

async function blockUser(userId, blockedUserId) {
  try {
    await pool.query(
      'INSERT INTO blocked_users (user_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, blockedUserId]
    );
    return true;
  } catch { return false; }
}

async function unblockUser(userId, blockedUserId) {
  await pool.query(
    'DELETE FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2',
    [userId, blockedUserId]
  );
}

async function getBlockedUsers(userId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.phone, u.username, u.display_name, u.avatar, u.bio
     FROM blocked_users b JOIN users u ON b.blocked_user_id = u.id WHERE b.user_id = $1`,
    [userId]
  );
  return rows;
}

async function isBlocked(userId, targetUserId) {
  const { rows: r1 } = await pool.query(
    'SELECT id FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2',
    [userId, targetUserId]
  );
  if (r1.length > 0) return true;
  const { rows: r2 } = await pool.query(
    'SELECT id FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2',
    [targetUserId, userId]
  );
  return r2.length > 0;
}

// --- SESSIONS MANAGEMENT ---

async function getUserSessions(userId) {
  const { rows } = await pool.query(
    'SELECT id, device_name, device_id, created_at, last_active FROM sessions WHERE user_id = $1 ORDER BY last_active DESC',
    [userId]
  );
  return rows;
}

async function updateSessionActivity(token) {
  await pool.query(
    'UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE token = $1',
    [token]
  );
}

async function terminateSession(sessionId, userId) {
  await pool.query(
    'DELETE FROM sessions WHERE id = $1 AND user_id = $2',
    [sessionId, userId]
  );
}

async function terminateOtherSessions(currentToken, userId) {
  await pool.query(
    'DELETE FROM sessions WHERE user_id = $1 AND token != $2',
    [userId, currentToken]
  );
}

// --- PRIVACY SETTINGS ---

async function getPrivacySettings(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM privacy_settings WHERE user_id = $1',
    [userId]
  );
  if (rows.length > 0) return rows[0];
  await pool.query('INSERT INTO privacy_settings (user_id) VALUES ($1)', [userId]);
  return {
    last_seen: 'everyone', profile_photo: 'everyone', bio: 'everyone',
    status: 'contacts', calls: 'everyone', read_receipts: 1, message_history: 1
  };
}

async function updatePrivacySettings(userId, fields) {
  const sets = [];
  const params = [];
  let idx = 1;
  const allowed = ['last_seen', 'profile_photo', 'bio', 'status', 'calls', 'read_receipts', 'message_history'];
  for (const k of allowed) {
    if (fields[k] !== undefined) { sets.push(`${k} = $${idx++}`); params.push(fields[k]); }
  }
  if (sets.length === 0) return;
  params.push(userId);
  await pool.query(
    `INSERT INTO privacy_settings (user_id) VALUES ($${idx}) ON CONFLICT(user_id) DO UPDATE SET ${sets.join(', ')}`,
    [userId]
  );
  await pool.query(
    `UPDATE privacy_settings SET ${sets.join(', ')} WHERE user_id = $${idx}`,
    [...params.slice(0, -1), userId]
  );
}

// --- DELETE ACCOUNT ---

async function scheduleAccountDeletion(userId, days) {
  const deleteAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  await pool.query('UPDATE users SET delete_at = $1, auto_delete_days = $2 WHERE id = $3', [deleteAt, days, userId]);
}

async function cancelAccountDeletion(userId) {
  await pool.query('UPDATE users SET delete_at = NULL, auto_delete_days = 0 WHERE id = $1', [userId]);
}

async function getAccountDeletion(userId) {
  const { rows } = await pool.query('SELECT delete_at, auto_delete_days FROM users WHERE id = $1', [userId]);
  return rows.length > 0 ? rows[0] : null;
}

// --- VIDEOS ---

async function createVideo(userId, videoUrl, thumbnail = '', caption = '') {
  const vid = snowflake.generate();
  const { rows } = await pool.query(
    'INSERT INTO videos (id, user_id, video_url, thumbnail, caption) VALUES ($1, $2, $3, $4, $5) RETURNING id, video_url, thumbnail, caption, created_at',
    [vid, userId, videoUrl, thumbnail, caption]
  );
  return { ...rows[0], likes_count: 0, comments_count: 0 };
}

async function getVideos(cursor = null, limit = 10) {
  const { rows } = await pool.query(
    `SELECT v.*, u.display_name, u.avatar, u.username
     FROM videos v JOIN users u ON v.user_id = u.id
     WHERE $1::timestamp IS NULL OR v.created_at < $1
     ORDER BY v.created_at DESC FETCH FIRST $2 ROWS ONLY`,
    [cursor, limit]
  );
  return rows;
}

async function likeVideo(videoId, userId) {
  try {
    await pool.query(
      'INSERT INTO video_likes (video_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [videoId, userId]
    );
    await pool.query(
      'UPDATE videos SET likes_count = (SELECT COUNT(*) FROM video_likes WHERE video_id = $1) WHERE id = $1',
      [videoId]
    );
    return true;
  } catch { return false; }
}

async function unlikeVideo(videoId, userId) {
  try {
    await pool.query(
      'DELETE FROM video_likes WHERE video_id = $1 AND user_id = $2',
      [videoId, userId]
    );
    await pool.query(
      'UPDATE videos SET likes_count = (SELECT COUNT(*) FROM video_likes WHERE video_id = $1) WHERE id = $1',
      [videoId]
    );
    return true;
  } catch { return false; }
}

async function getVideoLikes(videoId) {
  const { rows } = await pool.query(
    'SELECT u.id, u.display_name, u.avatar FROM video_likes vl JOIN users u ON vl.user_id = u.id WHERE vl.video_id = $1',
    [videoId]
  );
  return rows;
}

async function addVideoComment(videoId, userId, text) {
  const { rows } = await pool.query(
    'INSERT INTO video_comments (video_id, user_id, text) VALUES ($1, $2, $3) RETURNING id, video_id, user_id, text, created_at',
    [videoId, userId, text]
  );
  await pool.query(
    'UPDATE videos SET comments_count = (SELECT COUNT(*) FROM video_comments WHERE video_id = $1) WHERE id = $1',
    [videoId]
  );
  return rows[0];
}

async function getVideoComments(videoId) {
  const { rows } = await pool.query(
    `SELECT vc.*, u.display_name, u.avatar, u.username
     FROM video_comments vc JOIN users u ON vc.user_id = u.id WHERE vc.video_id = $1 ORDER BY vc.created_at DESC`,
    [videoId]
  );
  return rows;
}

async function hasUserLiked(videoId, userId) {
  const { rows } = await pool.query(
    'SELECT id FROM video_likes WHERE video_id = $1 AND user_id = $2',
    [videoId, userId]
  );
  return rows.length > 0;
}

// --- LIVES ---

async function startLive(userId, title = '') {
  const lid = snowflake.generate();
  const { rows } = await pool.query(
    'INSERT INTO lives (id, user_id, title) VALUES ($1, $2, $3) RETURNING id, user_id, title, status, started_at',
    [lid, userId, title]
  );
  return rows[0];
}

async function endLive(liveId, userId) {
  await pool.query(
    'UPDATE lives SET status = $1, ended_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
    ['ended', liveId, userId]
  );
}

async function getActiveLives() {
  const { rows } = await pool.query(
    `SELECT l.*, u.display_name, u.avatar, u.username
     FROM lives l JOIN users u ON l.user_id = u.id WHERE l.status = 'live' ORDER BY l.started_at DESC`
  );
  return rows;
}

// --- STORIES ---

async function createStory(userId, mediaUrl) {
  const id = snowflake.generate();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { rows } = await pool.query(
    'INSERT INTO stories (id, user_id, media_url, expires_at) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, userId, mediaUrl, expires]
  );
  return rows[0];
}

async function getStories(userId) {
  const { rows } = await pool.query(
    `SELECT s.*, u.display_name, u.avatar, u.username
     FROM stories s JOIN users u ON s.user_id = u.id
     WHERE s.expires_at > NOW()
       AND (s.user_id = $1 OR s.user_id IN (SELECT contact_user_id FROM contacts WHERE user_id = $1))
     ORDER BY s.user_id, s.created_at DESC`,
    [userId]
  );
  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.user_id]) grouped[r.user_id] = { user: { id: r.user_id, display_name: r.display_name, avatar: r.avatar, username: r.username }, stories: [] };
    grouped[r.user_id].stories.push({ id: r.id, media_url: r.media_url, created_at: r.created_at, expires_at: r.expires_at, views_count: r.views_count });
  }
  return Object.values(grouped);
}

async function getMyActiveStory(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM stories WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC FETCH FIRST 1 ROWS ONLY',
    [userId]
  );
  return rows[0] || null;
}

async function viewStory(storyId, userId) {
  await pool.query(
    'UPDATE stories SET views_count = views_count + 1 WHERE id = $1',
    [storyId]
  );
}

// --- CHANNELS ---

async function createChannel(name, description, ownerId) {
  const { rows } = await pool.query(
    'INSERT INTO channels (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
    [name, description || '', ownerId]
  );
  return rows[0];
}

async function getChannels() {
  const { rows } = await pool.query(
    `SELECT ch.*, u.display_name, u.avatar,
     (SELECT COUNT(*) FROM channel_subscribers WHERE channel_id = ch.id) as subscribers
     FROM channels ch JOIN users u ON ch.owner_id = u.id ORDER BY ch.created_at DESC`
  );
  return rows;
}

async function subscribeChannel(channelId, userId) {
  try {
    await pool.query(
      'INSERT INTO channel_subscribers (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [channelId, userId]
    );
    return true;
  } catch { return false; }
}

async function unsubscribeChannel(channelId, userId) {
  await pool.query(
    'DELETE FROM channel_subscribers WHERE channel_id = $1 AND user_id = $2',
    [channelId, userId]
  );
}

async function createChannelPost(channelId, senderId, text, media = '', mediaType = 'text') {
  const { rows } = await pool.query(
    'INSERT INTO channel_posts (channel_id, sender_id, text, media, media_type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [channelId, senderId, text, media, mediaType]
  );
  return rows[0];
}

async function getChannelPosts(channelId, cursor = null, limit = 20) {
  const { rows } = await pool.query(
    `SELECT cp.*, u.display_name, u.avatar
     FROM channel_posts cp JOIN users u ON cp.sender_id = u.id
     WHERE cp.channel_id = $1 ${cursor ? 'AND cp.created_at < $3' : ''}
     ORDER BY cp.created_at DESC FETCH FIRST $2 ROWS ONLY`,
    cursor ? [channelId, limit, cursor] : [channelId, limit]
  );
  return rows;
}

// --- COMMUNITIES ---

async function createCommunity(name, description, ownerId) {
  const { rows } = await pool.query(
    'INSERT INTO communities (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
    [name, description || '', ownerId]
  );
  return rows[0];
}

async function getCommunities(userId) {
  const { rows } = await pool.query(
    `SELECT c.*, u.display_name,
     (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as members_count
     FROM communities c JOIN users u ON c.owner_id = u.id
     WHERE c.owner_id = $1 OR c.id IN (SELECT community_id FROM community_members WHERE user_id = $1)
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return rows;
}

async function joinCommunity(communityId, userId) {
  try {
    await pool.query(
      'INSERT INTO community_members (community_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [communityId, userId]
    );
    return true;
  } catch { return false; }
}

async function leaveCommunity(communityId, userId) {
  await pool.query(
    'DELETE FROM community_members WHERE community_id = $1 AND user_id = $2',
    [communityId, userId]
  );
}

// --- POLLS ---

async function createPoll(chatId, creatorId, question, options, multipleChoice = false) {
  const { rows } = await pool.query(
    'INSERT INTO polls (chat_id, creator_id, question, multiple_choice) VALUES ($1, $2, $3, $4) RETURNING id',
    [chatId, creatorId, question, multipleChoice ? 1 : 0]
  );
  const pollId = rows[0].id;
  for (const opt of options) {
    await pool.query('INSERT INTO poll_options (poll_id, text) VALUES ($1, $2)', [pollId, opt]);
  }
  return pollId;
}

async function getPoll(pollId) {
  const { rows: pollRows } = await pool.query('SELECT * FROM polls WHERE id = $1', [pollId]);
  if (pollRows.length === 0) return null;
  const { rows: optionRows } = await pool.query('SELECT * FROM poll_options WHERE poll_id = $1', [pollId]);
  const { rows: voteRows } = await pool.query(
    `SELECT option_id, COUNT(*) as votes FROM poll_votes WHERE poll_id = $1 GROUP BY option_id`,
    [pollId]
  );
  return { ...pollRows[0], options: optionRows, votes: voteRows };
}

async function votePoll(pollId, optionId, userId) {
  try {
    await pool.query(
      'INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [pollId, optionId, userId]
    );
    return true;
  } catch { return false; }
}

// --- PRODUCTS / SHOP ---

async function createProduct(sellerId, name, description, price, images = '', category = '', stock = 0) {
  const { rows } = await pool.query(
    'INSERT INTO products (seller_id, name, description, price, images, category, stock) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [sellerId, name, description, price, images, category, stock]
  );
  return rows[0];
}

async function getProducts(category = '', cursor = null, limit = 20) {
  let sql = `SELECT p.*, u.display_name, u.avatar FROM products p JOIN users u ON p.seller_id = u.id`;
  const params = [];
  let idx = 1;
  const conds = [];
  if (category) {
    conds.push(`p.category = $${idx++}`);
    params.push(category);
  }
  if (cursor) {
    conds.push(`p.created_at < $${idx++}`);
    params.push(cursor);
  }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ` ORDER BY p.created_at DESC FETCH FIRST $${idx} ROWS ONLY`;
  params.push(limit);
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function createOrder(buyerId, productId, quantity = 1) {
  const { rows: prod } = await pool.query('SELECT price FROM products WHERE id = $1', [productId]);
  if (prod.length === 0) return null;
  const total = parseFloat(prod[0].price) * quantity;
  const { rows } = await pool.query(
    'INSERT INTO orders (buyer_id, product_id, quantity, total) VALUES ($1, $2, $3, $4) RETURNING *',
    [buyerId, productId, quantity, total]
  );
  return rows[0];
}

async function getMyOrders(userId) {
  const { rows } = await pool.query(
    `SELECT o.*, p.name, p.images FROM orders o JOIN products p ON o.product_id = p.id WHERE o.buyer_id = $1 ORDER BY o.created_at DESC`,
    [userId]
  );
  return rows;
}

// --- WISHLIST ---

async function createWishlist(userId, name = 'Wishlist') {
  const { rows } = await pool.query(
    'INSERT INTO wishlists (user_id, name) VALUES ($1, $2) RETURNING *',
    [userId, name]
  );
  return rows[0];
}

async function addToWishlist(wishlistId, productId) {
  try {
    await pool.query(
      'INSERT INTO wishlist_items (wishlist_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [wishlistId, productId]
    );
    return true;
  } catch { return false; }
}

async function getWishlists(userId) {
  const { rows } = await pool.query(
    `SELECT w.*,
     (SELECT json_agg(json_build_object('id', p.id, 'name', p.name, 'price', p.price, 'images', p.images))
      FROM wishlist_items wi JOIN products p ON wi.product_id = p.id WHERE wi.wishlist_id = w.id) as items
     FROM wishlists w WHERE w.user_id = $1`,
    [userId]
  );
  return rows;
}

// --- FLASH DEALS ---

async function getFlashDeals() {
  const { rows } = await pool.query(
    `SELECT fd.*, p.name, p.price, p.images FROM flash_deals fd
     JOIN products p ON fd.product_id = p.id
     WHERE fd.starts_at <= NOW() AND fd.ends_at >= NOW()`,
  );
  return rows;
}

// --- MEMES ---

async function createMeme(userId, imageUrl, caption = '', template = '') {
  const { rows } = await pool.query(
    'INSERT INTO memes (user_id, image_url, caption, template) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, imageUrl, caption, template]
  );
  return rows[0];
}

async function getMemes(cursor = null, limit = 20) {
  const { rows } = await pool.query(
    `SELECT m.*, u.display_name, u.avatar FROM memes m JOIN users u ON m.user_id = u.id
     WHERE $1::timestamp IS NULL OR m.created_at < $1
     ORDER BY m.created_at DESC FETCH FIRST $2 ROWS ONLY`,
    [cursor, limit]
  );
  return rows;
}

async function likeMeme(memeId, userId) {
  try {
    await pool.query(
      'INSERT INTO meme_likes (meme_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [memeId, userId]
    );
    await pool.query('UPDATE memes SET likes_count = (SELECT COUNT(*) FROM meme_likes WHERE meme_id = $1) WHERE id = $1', [memeId]);
    return true;
  } catch { return false; }
}

// --- STICKERS ---

async function getStickerPacks() {
  const { rows } = await pool.query(
    `SELECT sp.*, u.display_name FROM sticker_packs sp JOIN users u ON sp.author_id = u.id ORDER BY sp.created_at DESC`
  );
  return rows;
}

async function getStickers(packId) {
  const { rows } = await pool.query('SELECT * FROM stickers WHERE pack_id = $1', [packId]);
  return rows;
}

async function purchaseSticker(userId, stickerId) {
  try {
    await pool.query(
      'INSERT INTO user_stickers (user_id, sticker_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, stickerId]
    );
    return true;
  } catch { return false; }
}

async function getMyStickers(userId) {
  const { rows } = await pool.query(
    `SELECT s.*, sp.name as pack_name FROM user_stickers us
     JOIN stickers s ON us.sticker_id = s.id
     JOIN sticker_packs sp ON s.pack_id = sp.id
     WHERE us.user_id = $1`,
    [userId]
  );
  return rows;
}

// --- AVATAR 3D ---

async function saveAvatarCustomization(userId, avatarJson) {
  await pool.query(
    `INSERT INTO avatar_customizations (user_id, avatar_json) VALUES ($1, $2)
     ON CONFLICT(user_id) DO UPDATE SET avatar_json = $2, updated_at = CURRENT_TIMESTAMP`,
    [userId, avatarJson]
  );
}

async function getAvatarCustomization(userId) {
  const { rows } = await pool.query(
    'SELECT avatar_json FROM avatar_customizations WHERE user_id = $1',
    [userId]
  );
  return rows.length > 0 ? rows[0].avatar_json : '{}';
}

// --- VIBE BALANCE / FOCUS ---

async function trackActivity(userId, type, minutes = 1) {
  const today = new Date().toISOString().split('T')[0];
  const colMap = {
    messaging: 'messaging_minutes', feed: 'feed_minutes', live: 'live_minutes',
    shop: 'shop_minutes', games: 'games_minutes', calls: 'calls_minutes'
  };
  const col = colMap[type];
  if (!col) return;
  await pool.query(
    `INSERT INTO vibe_balance (user_id, date, ${col}) VALUES ($1, $2, $3)
     ON CONFLICT(user_id, date) DO UPDATE SET ${col} = vibe_balance.${col} + $3`,
    [userId, today, minutes]
  );
}

async function getVibeBalance(userId) {
  const today = new Date().toISOString().split('T')[0];
  const { rows } = await pool.query(
    'SELECT * FROM vibe_balance WHERE user_id = $1 AND date = $2',
    [userId, today]
  );
  if (rows.length > 0) return rows[0];
  return {
    messaging_minutes: 0, feed_minutes: 0, live_minutes: 0,
    shop_minutes: 0, games_minutes: 0, calls_minutes: 0
  };
}

async function startFocusSession(userId, mode) {
  const { rows } = await pool.query(
    'INSERT INTO focus_sessions (user_id, mode) VALUES ($1, $2) RETURNING *',
    [userId, mode]
  );
  return rows[0];
}

async function endFocusSession(userId) {
  const { rows } = await pool.query(
    `UPDATE focus_sessions SET ended_at = CURRENT_TIMESTAMP,
     duration_minutes = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) / 60,
     active = 0 WHERE user_id = $1 AND active = 1 RETURNING *`,
    [userId]
  );
  return rows[0] || null;
}

async function getActiveFocusSession(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM focus_sessions WHERE user_id = $1 AND active = 1 ORDER BY started_at DESC FETCH FIRST 1 ROWS ONLY',
    [userId]
  );
  return rows.length > 0 ? rows[0] : null;
}

async function addSmartNotification(userId, type, message, priority = 'normal') {
  const { rows } = await pool.query(
    'INSERT INTO smart_notifications (user_id, notification_type, message, priority) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, type, message, priority]
  );
  return rows[0];
}

async function getSmartNotifications(userId, cursor = null, limit = 20) {
  const { rows } = await pool.query(
    `SELECT * FROM smart_notifications WHERE user_id = $1 ${cursor ? 'AND created_at < $3' : ''}
     ORDER BY created_at DESC FETCH FIRST $2 ROWS ONLY`,
    cursor ? [userId, limit, cursor] : [userId, limit]
  );
  return rows;
}

async function markNotificationRead(notificationId) {
  await pool.query('UPDATE smart_notifications SET read = 1 WHERE id = $1', [notificationId]);
}

// --- SHARED NOTES ---

async function saveSharedNote(chatId, content, updatedBy) {
  const { rows } = await pool.query(
    `INSERT INTO shared_notes (chat_id, content, updated_by)
     VALUES ($1, $2, $3)
     ON CONFLICT(chat_id) DO UPDATE SET content = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [chatId, content, updatedBy]
  );
  return rows[0];
}

async function getSharedNote(chatId) {
  const { rows } = await pool.query(
    'SELECT * FROM shared_notes WHERE chat_id = $1',
    [chatId]
  );
  return rows.length > 0 ? rows[0] : null;
}

// --- TASKS ---

async function createTask(chatId, title, createdBy, assignedTo = null, dueDate = null) {
  const { rows } = await pool.query(
    'INSERT INTO group_tasks (chat_id, title, created_by, assigned_to, due_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [chatId, title, createdBy, assignedTo, dueDate]
  );
  return rows[0];
}

async function getTasks(chatId) {
  const { rows } = await pool.query(
    `SELECT gt.*, creator.display_name as creator_name,
     assignee.display_name as assignee_name
     FROM group_tasks gt
     JOIN users creator ON gt.created_by = creator.id
     LEFT JOIN users assignee ON gt.assigned_to = assignee.id
     WHERE gt.chat_id = $1 ORDER BY gt.created_at DESC`,
    [chatId]
  );
  return rows;
}

async function completeTask(taskId) {
  await pool.query('UPDATE group_tasks SET completed = 1 WHERE id = $1', [taskId]);
}

// --- WATCH TOGETHER ---

async function createWatchSession(chatId, creatorId, videoUrl) {
  const { rows } = await pool.query(
    'INSERT INTO watch_sessions (chat_id, creator_id, video_url) VALUES ($1, $2, $3) RETURNING *',
    [chatId, creatorId, videoUrl]
  );
  return rows[0];
}

async function updateWatchSession(sessionId, currentTime, playing) {
  await pool.query(
    'UPDATE watch_sessions SET playback_time = $1, playing = $2 WHERE id = $3',
    [currentTime, playing, sessionId]
  );
}

async function getWatchSession(chatId) {
  const { rows } = await pool.query(
    'SELECT * FROM watch_sessions WHERE chat_id = $1 ORDER BY created_at DESC FETCH FIRST 1 ROWS ONLY',
    [chatId]
  );
  return rows.length > 0 ? rows[0] : null;
}

// --- PIN CHAT ---

async function togglePinChat(chatId, userId) {
  const { rows } = await pool.query(
    `UPDATE chats SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END
     WHERE id = $1 AND id IN (SELECT chat_id FROM chat_members WHERE user_id = $2) RETURNING pinned`,
    [chatId, userId]
  );
  return rows.length > 0 ? rows[0].pinned : 0;
}

// --- GAMES ---

async function getAvailableGames() {
  const { rows } = await pool.query('SELECT * FROM games ORDER BY name');
  return rows;
}

async function createGameSession(gameId, chatId, creatorId) {
  const { rows } = await pool.query(
    'INSERT INTO game_sessions (game_id, chat_id, creator_id) VALUES ($1, $2, $3) RETURNING *',
    [gameId, chatId, creatorId]
  );
  return rows[0];
}

async function joinGameSession(sessionId, userId) {
  try {
    await pool.query(
      'INSERT INTO game_players (session_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [sessionId, userId]
    );
    return true;
  } catch { return false; }
}

async function updateGameScore(sessionId, userId, score) {
  await pool.query(
    'UPDATE game_players SET score = $1 WHERE session_id = $2 AND user_id = $3',
    [score, sessionId, userId]
  );
}

async function endGameSession(sessionId, winnerId) {
  await pool.query(
    'UPDATE game_sessions SET status = $1, winner_id = $2 WHERE id = $3',
    ['finished', winnerId, sessionId]
  );
}

// --- MESSAGE REPLIES / FORWARD ---

async function forwardMessage(messageId, targetChatId) {
  const { rows } = await pool.query(
    'SELECT text, type FROM messages WHERE id = $1',
    [messageId]
  );
  if (rows.length === 0) return null;
  const msg = rows[0];
  const { rows: newRows } = await pool.query(
    'INSERT INTO messages (chat_id, sender_id, text, type, forwarded) VALUES ($1, $2, $3, $4, 1) RETURNING id',
    [targetChatId, 0, msg.text, msg.type]
  );
  return newRows[0].id;
}

module.exports = {
  init,
  sendCode, verifyCode, findOrCreateUser, createSession, getSession,
  getUserById, searchUsers, addContact, getContacts,
  createPrivateChat, getPrivateChat, createGroup, getUserChats, getChatMembers, addChatMember,
  addMessage, getMessages, markRead, searchMessages, deleteMessage,
  createPost, getPosts, viewPost, getPostViews, likePost, unlikePost, hasUserLikedPost, addPostComment, getPostComments,
  setOnline, setOffline, isOnline, getOnlineUsers,
  updateProfile, close,
  addCall, getUserCalls,
  createActiveCall, getActiveCall, getActiveCallBetweenUsers, getUserActiveCalls, updateCallStatus, endActiveCall,
  startBroadcast, stopBroadcast, getActiveBroadcasts, getBroadcast, addBroadcastViewer, removeBroadcastViewer, getBroadcastViewers,
  setTwoStepPassword, verifyTwoStepPassword, disableTwoStep, getTwoStepStatus,
  blockUser, unblockUser, getBlockedUsers, isBlocked,
  getUserSessions, updateSessionActivity, terminateSession, terminateOtherSessions,
  getPrivacySettings, updatePrivacySettings,
  scheduleAccountDeletion, cancelAccountDeletion, getAccountDeletion,
  createVideo, getVideos, likeVideo, unlikeVideo, getVideoLikes, addVideoComment, getVideoComments, hasUserLiked,
  startLive, endLive, getActiveLives,
  addLiveComment, getLiveComments, addLiveReaction, getLiveReactions,
  getUserStars, spendStars, sendLiveGift, getLiveGifts,
  // Channels
  createChannel, getChannels, subscribeChannel, unsubscribeChannel, createChannelPost, getChannelPosts,
  // Communities
  createCommunity, getCommunities, joinCommunity, leaveCommunity,
  // Polls
  createPoll, getPoll, votePoll,
  // Shop
  createProduct, getProducts, createOrder, getMyOrders,
  // Wishlist
  createWishlist, addToWishlist, getWishlists,
  // Flash Deals
  getFlashDeals,
  // Memes
  createMeme, getMemes, likeMeme,
  // Stickers
  getStickerPacks, getStickers, purchaseSticker, getMyStickers,
  // Avatar 3D
  saveAvatarCustomization, getAvatarCustomization,
  // Vibe Balance
  trackActivity, getVibeBalance, startFocusSession, endFocusSession, getActiveFocusSession,
  addSmartNotification, getSmartNotifications, markNotificationRead,
  // Notes & Tasks
  saveSharedNote, getSharedNote, createTask, getTasks, completeTask,
  // Watch Together
  createWatchSession, updateWatchSession, getWatchSession,
  // Pin
  togglePinChat,
  // Games
  getAvailableGames, createGameSession, joinGameSession, updateGameScore, endGameSession,
  // Forward
  forwardMessage,
  // Stories
  createStory, getStories, getMyActiveStory, viewStory,
  cleanupExpiredSessions,
  // Recommendations
  storePostTags, recordInteraction, getRecommendedPosts, getTrendingTags,
};
