const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();
const db = require('./db/init');
const valkey = require('./valkey');
const logger = require('./lib/logger');
const webpush = require('./lib/webpush');

const STORAGE_URL = process.env.STORAGE_URL || 'http://localhost:3002';
const TEMP_DIR = path.resolve(__dirname, 'tmp_upload');
const CHUNK_DIR = path.resolve(__dirname, 'tmp_chunks');
[TEMP_DIR, CHUNK_DIR].forEach(d => { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); });

const MAX_TEXT_LENGTH = 2000;
const MAX_TITLE_LENGTH = 120;
const MAX_USERNAME_LENGTH = 30;
const MAX_DISPLAY_NAME_LENGTH = 50;
const MAX_BIO_LENGTH = 300;
const MAX_COMMENT_LENGTH = 500;
const MAX_MESSAGE_LENGTH = 5000;

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim().slice(0, MAX_TEXT_LENGTH);
}

process.on('uncaughtException', (err) => logger.fatal({ err }, 'Excepción no capturada'));
process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Promesa rechazada no manejada'));

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const server = http.createServer({ maxHeaderSize: 65536 }, app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] }, maxHttpBufferSize: 1e8 });
valkey.startSubscriber(io);

function channelForEvent(event) {
  const map = {
    contact_added: 'contacts:status', contact_status: 'contacts:status',
    new_chat: 'chat:messages', new_message: 'chat:messages', new_poll: 'chat:messages', new_task: 'chat:messages', watch_session_started: 'chat:messages', game_started: 'chat:messages',
    new_post: 'posts:new', post_liked: 'posts:interactions', post_unliked: 'posts:interactions', new_post_comment: 'posts:interactions',
    new_story: 'stories:new',
    new_video: 'videos:new', video_liked: 'videos:interactions', new_video_comment: 'videos:interactions',
    live_started: 'lives:new', new_live_comment: 'lives:new', new_live_reaction: 'lives:new', new_live_gift: 'lives:new',
    incoming_call: 'calls:signaling', call_accepted: 'calls:signaling', call_rejected: 'calls:signaling', call_ended: 'calls:signaling', signal_data: 'calls:signaling',
    new_broadcast: 'broadcasts:signaling', broadcast_ended: 'broadcasts:signaling', broadcast_removed: 'broadcasts:signaling', viewer_joined: 'broadcasts:signaling', viewer_left: 'broadcasts:signaling', broadcast_chunk: 'broadcasts:signaling', broadcast_signal: 'broadcasts:signaling',
    player_joined: 'games:signaling', game_update: 'games:signaling', game_action: 'games:signaling',
    new_notification: 'notifications:user', focus_started: 'notifications:user', focus_ended: 'notifications:user',
    new_channel_post: 'channels:updates',
    new_meme: 'memes:new',
    poll_updated: 'polls:updates',
    watch_sync: 'watch:sync',
  };
  return map[event] || 'global:events';
}

function emitRoom(channel, room, event, data) {
  if (room) io.to(room).emit(event, data);
  else io.emit(event, data);
  valkey.publish(channel, room || '', event, data).catch(() => {});
}

function emitToUser(userId, event, data) {
  const room = `user:${userId}`;
  io.to(room).emit(event, data);
  valkey.publish(channelForEvent(event), room, event, data).catch(() => {});
}

function emitToRoom(room, event, data) {
  io.to(room).emit(event, data);
  valkey.publish(channelForEvent(event), room, event, data).catch(() => {});
}

function emitGlobal(event, data) {
  io.emit(event, data);
  valkey.publish(channelForEvent(event), '', event, data).catch(() => {});
}

function emitToRoomExceptSender(socket, room, event, data) {
  socket.to(room).emit(event, data);
  // Still publish to Valkey so other backends relay
  valkey.publish(channelForEvent(event), room, event, data).catch(() => {});
}

// NOTA: uploads se manejan via socket (evento 'upload'), no via HTTP

app.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: webpush.VAPID_PUBLIC_KEY });
});

app.post('/push/subscribe', express.json(), (req, res) => {
  const { userId, subscription } = req.body || {};
  if (!userId || !subscription) return res.status(400).json({ error: 'Faltan datos' });
  webpush.addSubscription(userId, subscription);
  logger.info({ userId, action: 'push_subscribe' }, 'Suscripción push registrada');
  res.json({ ok: true });
});

app.post('/push/unsubscribe', express.json(), (req, res) => {
  const { userId, endpoint } = req.body || {};
  if (!userId || !endpoint) return res.status(400).json({ error: 'Faltan datos' });
  webpush.removeSubscription(userId, endpoint);
  res.json({ ok: true });
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) { next(); return; }
  db.getSession(token).then((user) => {
    if (user) socket.user = user;
    next();
  }).catch(() => next());
});

io.on('connection', (socket) => {
  const user = socket.user;

  // --- AUTH ---
  socket.on('send_code', async (data, cb) => {
    const { phone } = data || {};
    if (!phone || phone.length < 10) return cb?.({ ok: false, error: 'Teléfono inválido' });
    try {
      const code = await db.sendCode(phone);
      logger.info({ phone, action: 'send_code' }, 'Código SMS enviado');
      cb?.({ ok: true, code });
    } catch (e) { logger.error({ err: e.message, phone, action: 'send_code' }, 'Error enviando código'); cb?.({ ok: false, error: e.message }); }
  });

  socket.on('verify_code', async (data, cb) => {
    const { phone, code, username, displayName, countryCode } = data || {};
    try {
      const valid = await db.verifyCode(phone, code);
      if (!valid) return cb?.({ ok: false, error: 'Código incorrecto o expirado' });
      const result = await db.findOrCreateUser(phone, username, displayName, countryCode || '');
      const token = await db.createSession(result.user.id, socket.handshake.auth?.deviceId || '');
      logger.info({ userId: result.user.id, phone, isNew: result.isNew, action: 'verify_code' }, 'Usuario verificado');
      cb?.({ ok: true, token, user: result.user, isNew: result.isNew });
    } catch (e) { logger.error({ err: e.message, phone, action: 'verify_code' }, 'Error verificando código'); cb?.({ ok: false, error: e.message }); }
  });

  socket.on('restore_session', async (data, cb) => {
    const { token } = data || {};
    try {
      const u = await db.getSession(token);
      if (!u) return cb?.({ ok: false });
      logger.info({ userId: u.id, action: 'restore_session' }, 'Sesión restaurada');
      cb?.({ ok: true, user: u });
    } catch (e) { cb?.({ ok: false }); }
  });

  // Chunked upload: upload_start → upload_chunk (×N) → auto-finaliza
  const uploads = new Map();
  const CHUNK_TIMEOUT = 60000;

  socket.on('upload_start', (data, cb) => {
    if (!data || !data.name || !data.totalChunks || !data.size)
      return cb?.({ ok: false, error: 'Faltan metadatos' });
    const allowed = /\.(jpg|jpeg|png|gif|webp|bmp|mp4|webm|mov|avi|mkv|mp3|wav|ogg|pdf|zip)$/i;
    if (!allowed.test(path.extname(data.name)))
      return cb?.({ ok: false, error: 'Tipo de archivo no permitido' });
    const uploadId = crypto.randomBytes(12).toString('hex');
    const chunkDir = path.join(CHUNK_DIR, uploadId);
    fs.mkdirSync(chunkDir, { recursive: true });
    const entry = { uploadId, name: data.name, type: data.mime || 'application/octet-stream', size: data.size, totalChunks: data.totalChunks, received: 0, chunkDir, chunks: new Set(), timer: null, complete: false };
    const resetTimer = () => {
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => {
        uploads.delete(uploadId);
        fs.rm(chunkDir, { recursive: true, force: true }, () => {});
        logger.warn({ uploadId, action: 'upload_timeout' }, 'Upload chunked expirado');
      }, CHUNK_TIMEOUT);
    };
    resetTimer();
    uploads.set(uploadId, entry);
    cb?.({ ok: true, uploadId });
  });

  socket.on('upload_chunk', async (data, cb) => {
    if (!data || !data.uploadId || data.index === undefined || !Buffer.isBuffer(data.data))
      return cb?.({ ok: false, error: 'Datos inválidos' });
    const entry = uploads.get(data.uploadId);
    if (!entry || entry.complete) return cb?.({ ok: false, error: 'Upload no encontrado o ya completado' });

    // Reset timeout
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      uploads.delete(data.uploadId);
      fs.rm(entry.chunkDir, { recursive: true, force: true }, () => {});
    }, CHUNK_TIMEOUT);

    const chunkPath = path.join(entry.chunkDir, String(data.index));
    if (entry.chunks.has(data.index)) return cb?.({ ok: true, received: entry.received, total: entry.totalChunks }); // dedup
    entry.chunks.add(data.index);
    entry.received += data.data.length;
    try {
      fs.writeFileSync(chunkPath, data.data);
    } catch (e) {
      return cb?.({ ok: false, error: 'Error escribiendo chunk' });
    }

    // Check if complete
    if (entry.chunks.size >= entry.totalChunks) {
      entry.complete = true;
      if (entry.timer) clearTimeout(entry.timer);
      uploads.delete(data.uploadId);

      // Assemble file
      const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${path.extname(entry.name)}`;
      const filePath = path.join(TEMP_DIR, uniqueName);
      try {
        const ws = fs.createWriteStream(filePath);
        for (let i = 0; i < entry.totalChunks; i++) {
          const cp = path.join(entry.chunkDir, String(i));
          if (fs.existsSync(cp)) ws.write(fs.readFileSync(cp));
        }
        ws.end();
        await new Promise(r => ws.on('finish', r));

        // Clean up chunk dir
        fs.rm(entry.chunkDir, { recursive: true, force: true }, () => {});

        // Forward to storage server
        const fileBuf = fs.readFileSync(filePath);
        const resp = await fetch(`${STORAGE_URL}/upload/raw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': entry.name, 'X-Mime': entry.type, 'Content-Length': String(fileBuf.length) },
          body: fileBuf,
        });
        const result = await resp.json();
        fs.unlink(filePath, () => {});
        cb?.({ ok: true, url: result.url, metadata: result.metadata, received: entry.received, total: entry.size });
      } catch (e) {
        fs.unlink(filePath, () => {});
        logger.error({ err: e.message, uploadId: data.uploadId, action: 'upload_assemble' }, 'Error ensamblando upload');
        cb?.({ ok: false, error: 'Error al procesar archivo' });
      }
    } else {
      cb?.({ ok: true, received: entry.received, total: entry.size });
    }
  });

  socket.on('upload_cancel', (data) => {
    if (!data || !data.uploadId) return;
    const entry = uploads.get(data.uploadId);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    uploads.delete(data.uploadId);
    fs.rm(entry.chunkDir, { recursive: true, force: true }, () => {});
  });

  if (!user) return;

  db.setOnline(user.id);
  db.updateLastSeen(user.id);
  socket.join(`user:${user.id}`);
  logger.info({ userId: user.id, displayName: user.display_name, action: 'connect' }, 'Usuario conectado');

  // Join all chat rooms for real-time message delivery
  db.getUserChatIds(user.id).then(ids => {
    for (const chatId of ids) {
      socket.join(`chat:${chatId}`);
    }
  }).catch(e => logger.error({ err: e.message, userId: user.id, action: 'join_chat_rooms' }, 'Error joining chat rooms'));

  valkey.publish('online:status', `user:${user.id}`, 'contact_status', { userId: user.id, online: true }).catch(() => {});

  const contacts = db.getContacts(user.id);
  contacts.then((list) => {
    list.forEach((c) => {
      emitToUser(c.id, 'contact_status', { userId: user.id, online: true });
    });
  }).catch(() => {});

  // --- CONTACTS ---
  socket.on('get_contacts', async (_, cb) => {
    try {
      const list = await db.getContacts(user.id);
      cb?.(list.map((c) => ({ ...c, online: db.isOnline(c.id) })));
    } catch (e) { cb?.([]); }
  });

  socket.on('get_suggested_users', async (_, cb) => {
    try {
      const list = await db.getSuggestedUsers(user.id);
      cb?.(list);
    } catch (e) { cb?.([]); }
  });

  socket.on('search_users', async (data, cb) => {
    const { query } = data || {};
    try {
      const results = (await db.searchUsers(query)).filter((u) => u.id !== user.id);
      cb?.(results);
    } catch (e) { cb?.([]); }
  });

  socket.on('search_posts', async (data, cb) => {
    const { query } = data || {};
    try {
      const results = await db.searchPosts(query);
      cb?.(results);
    } catch (e) { cb?.([]); }
  });

  socket.on('add_contact', async (data, cb) => {
    const { contactId } = data || {};
    try {
      const ok = await db.addContact(user.id, contactId);
      cb?.({ ok });
      const contact = await db.getUserById(contactId);
      if (contact) {
        emitToUser(user.id, 'contact_added', contact);
        emitToUser(contactId, 'contact_added', user);
        logger.info({ userId: user.id, contactId, action: 'add_contact' }, 'Contacto agregado');
      }
    } catch (e) { logger.error({ err: e.message, userId: user.id, contactId, action: 'add_contact' }, 'Error agregando contacto'); cb?.({ ok: false }); }
  });

  // --- CHATS ---
  socket.on('get_chats', async (_, cb) => {
    try {
      const list = await db.getUserChats(user.id);
      const result = [];
      for (const c of list) {
        const members = await db.getChatMembers(c.id);
        result.push({ ...c, members });
      }
      cb?.(result);
    } catch (e) { cb?.([]); }
  });

  socket.on('get_or_create_private_chat', async (data, cb) => {
    const { contactId } = data || {};
    try {
      const chatId = await db.createPrivateChat(user.id, contactId);
      socket.join(`chat:${chatId}`);
      const members = await db.getChatMembers(chatId);
      cb?.({ chatId, members });
      emitToUser(contactId, 'new_chat', { chatId, type: 'private', members });
    } catch (e) { cb?.({ ok: false }); }
  });

  socket.on('create_group', async (data, cb) => {
    const { name, memberIds } = data || {};
    if (!name || memberIds.length < 1) return cb?.({ ok: false, error: 'Nombre y al menos 1 miembro' });
    try {
      const chatId = await db.createGroup(name, user.id, memberIds);
      socket.join(`chat:${chatId}`);
      const members = await db.getChatMembers(chatId);
      cb?.({ ok: true, chatId, members });
      members.forEach((m) => {
        if (m.id !== user.id) emitToUser(m.id, 'new_chat', { chatId, type: 'group', members });
      });
      logger.info({ userId: user.id, chatId, groupName: name, memberCount: members.length, action: 'create_group' }, 'Grupo creado');
    } catch (e) { logger.error({ err: e.message, userId: user.id, action: 'create_group' }, 'Error creando grupo'); cb?.({ ok: false, error: e.message }); }
  });

  socket.on('get_messages', async (data, cb) => {
    const { chatId, cursor, limit } = data || {};
    try {
      const msgs = await db.getMessages(chatId, limit || 50, cursor || null, user.id);
      cb?.(msgs);
    } catch (e) { cb?.([]); }
  });

  socket.on('send_message', async (data, cb) => {
    const { chatId, text, type, replyToId } = data || {};
    const cleanText = sanitize(text).slice(0, MAX_MESSAGE_LENGTH);
    if (!cleanText && !['image', 'audio', 'video', 'document'].includes(type)) return;
    try {
      const msgId = await db.addMessage(chatId, user.id, cleanText, type || 'text', replyToId || null);
      const msg = {
        id: msgId, chat_id: chatId, sender_id: user.id,
        sender_name: user.display_name, sender_avatar: user.avatar,
        text: cleanText, type: type || 'text', reply_to_id: replyToId || null, forwarded: 0,
        created_at: new Date().toISOString(), status: 'sent'
      };
      db.trackActivity(user.id, 'messaging');
      valkey.publish('fanout:message', '', '', { chatId, msg, senderId: user.id }).catch(() => {});
      logger.info({ userId: user.id, chatId, msgId, msgType: type, textLength: cleanText.length, action: 'send_message' }, 'Mensaje enviado');
      cb?.(msg);
    } catch (e) { logger.error({ err: e.message, userId: user.id, chatId, action: 'send_message' }, 'Error enviando mensaje'); cb?.({ ok: false }); }
  });

  socket.on('forward_message', async (data, cb) => {
    const { messageId, targetChatId } = data || {};
    try {
      const newId = await db.forwardMessage(messageId, targetChatId);
      if (newId) {
        const msg = { id: newId, chat_id: targetChatId, sender_id: 0, text: 'Mensaje reenviado', type: 'text', forwarded: 1, created_at: new Date().toISOString(), status: 'sent' };
        emitToRoom(`chat:${targetChatId}`, 'new_message', msg);
        cb?.({ ok: true, id: newId });
      } else { cb?.({ ok: false }); }
    } catch (e) { cb?.({ ok: false }); }
  });

  socket.on('message_delivered', async (data) => {
    const { messageId, senderId } = data || {};
    if (!messageId || !senderId) return;
    try {
      await db.updateMessageStatus(messageId, 'delivered');
      emitToUser(senderId, 'message_status', { messageId, status: 'delivered' });
    } catch {}
  });

  socket.on('mark_read', async (data) => {
    const { messageId } = data || {};
    try {
      await db.markRead(messageId, user.id);
      await db.updateMessageStatus(messageId, 'read');
      const msg = await db.getMessageById(messageId);
      if (msg && msg.sender_id !== user.id) {
        emitToUser(msg.sender_id, 'message_status', { messageId, status: 'read' });
      }
    } catch {}
  });

  socket.on('typing', (data) => {
    const { chatId } = data || {};
    emitToRoomExceptSender(socket, `chat:${chatId}`, 'typing', { chatId, userId: user.id, name: user.display_name });
  });

  socket.on('stop_typing', (data) => {
    const { chatId } = data || {};
    emitToRoomExceptSender(socket, `chat:${chatId}`, 'stop_typing', { chatId, userId: user.id });
  });

  socket.on('pin_chat', async (data, cb) => {
    const { chatId } = data || {};
    try {
      const pinned = await db.togglePinChat(chatId, user.id);
      cb?.({ ok: true, pinned });
    } catch (e) { cb?.({ ok: false }); }
  });

  socket.on('search_messages', async (data, cb) => {
    const { chatId, query } = data || {};
    if (!query || !chatId) { cb?.([]); return; }
    try {
      const msgs = await db.searchMessages(chatId, query);
      cb?.(msgs);
    } catch (e) { cb?.([]); }
  });

  socket.on('delete_message', async (data, cb) => {
    const { messageId, chatId } = data || {};
    try {
      const msg = await db.getMessageById(messageId);
      if (!msg || msg.sender_id !== user.id) { cb?.({ ok: false }); return; }
      await db.deleteMessage(messageId, user.id);
      if (chatId) emitToRoom(`chat:${chatId}`, 'message_deleted', { messageId, deleteForAll: true });
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false }); }
  });

  socket.on('edit_message', async (data, cb) => {
    const { messageId, text, chatId } = data || {};
    try {
      const ok = await db.editMessage(messageId, user.id, text);
      if (ok) {
        emitToRoom(`chat:${chatId}`, 'message_edited', { messageId, text, edited_at: new Date().toISOString() });
      }
      cb?.({ ok });
    } catch (e) { cb?.({ ok: false }); }
  });

  socket.on('delete_for_me', async (data, cb) => {
    const { messageId, chatId } = data || {};
    try {
      await db.deleteForMe(messageId, user.id);
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false }); }
  });

  socket.on('delete_for_everyone', async (data, cb) => {
    const { messageId, chatId } = data || {};
    try {
      const msg = await db.getMessageById(messageId);
      if (!msg || msg.sender_id !== user.id) { cb?.({ ok: false }); return; }
      await db.deleteMessage(messageId, user.id);
      emitToRoom(`chat:${chatId}`, 'message_deleted', { messageId, deleteForAll: true });
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false }); }
  });

  socket.on('delete_chat', async (data, cb) => {
    const { chatId } = data || {};
    try {
      await db.deleteChat(chatId, user.id);
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  socket.on('clear_chat', async (data, cb) => {
    const { chatId } = data || {};
    try {
      await db.clearChat(chatId, user.id);
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  // --- POSTS ---
  socket.on('join_post', (data) => {
    const { postId } = data || {};
    if (postId) socket.join(`post:${postId}`);
  });

  socket.on('leave_post', (data) => {
    const { postId } = data || {};
    if (postId) socket.leave(`post:${postId}`);
  });

  socket.on('get_posts', async (data, cb) => {
    const { filter, cursor, limit } = data || {};
    try { cb?.(await db.getPosts(user.id, filter || 'all', cursor || null, limit || 20)); } catch { cb?.([]); }
  });

  socket.on('create_post', async (data, cb) => {
    const { text, media, mediaType } = data || {};
    const cleanText = sanitize(text).slice(0, MAX_TEXT_LENGTH);
    if (!cleanText && !media) { cb?.({ ok: false, error: 'Contenido vacío' }); return; }
    if (media && typeof media === 'string' && media.length > 10000000) { cb?.({ ok: false, error: 'Media demasiado grande' }); return; }
    try {
      const post = await db.createPost(user.id, cleanText, media || '', mediaType || 'text');
      cb?.({ ok: true, post });
      db.trackActivity(user.id, 'feed');
      const fullPost = { ...post, user_id: user.id, display_name: user.display_name, avatar: user.avatar };
      const contactsList = await db.getContacts(user.id);
      contactsList.forEach((c) => {
        emitToUser(c.id, 'new_post', fullPost);
      });
      logger.info({ userId: user.id, postId: post.id, hasMedia: !!media, action: 'create_post' }, 'Post creado');
    } catch (e) { logger.error({ err: e.message, userId: user.id, action: 'create_post' }, 'Error creando post'); cb?.({ ok: false }); }
  });

  socket.on('view_post', async (data, cb) => {
    const { postId } = data || {};
    try {
      await db.viewPost(postId, user.id);
      cb?.(await db.getPostViews(postId));
    } catch { cb?.([]); }
  });

  socket.on('like_post', async (data, cb) => {
    const { postId } = data || {};
    try {
      const liked = await db.likePost(postId, user.id);
      cb?.({ ok: liked });
      if (liked) emitToRoom(`post:${postId}`, 'post_liked', { postId, userId: user.id });
    } catch { cb?.({ ok: false }); }
  });

  socket.on('unlike_post', async (data, cb) => {
    const { postId } = data || {};
    try {
      await db.unlikePost(postId, user.id);
      cb?.({ ok: true });
      emitToRoom(`post:${postId}`, 'post_unliked', { postId, userId: user.id });
    } catch { cb?.({ ok: false }); }
  });

  socket.on('has_user_liked_post', async (data, cb) => {
    const { postId } = data || {};
    try { cb?.({ liked: await db.hasUserLikedPost(postId, user.id) }); } catch { cb?.({ liked: false }); }
  });

  socket.on('add_post_comment', async (data, cb) => {
    const { postId, text, parentId } = data || {};
    const cleanText = sanitize(text).slice(0, MAX_COMMENT_LENGTH);
    if (!cleanText) return cb?.({ ok: false, error: 'Comentario vacío' });
    try {
      const comment = await db.addPostComment(postId, user.id, cleanText, parentId || null);
      const full = { ...comment, display_name: user.display_name, avatar: user.avatar, username: user.username };
      cb?.({ ok: true, comment: full });
      emitToRoom(`post:${postId}`, 'new_post_comment', { postId, comment: full });
      logger.info({ userId: user.id, postId, commentId: comment.id, parentId: parentId || null, action: 'add_post_comment' }, 'Comentario añadido');
    } catch (e) { logger.error({ err: e.message, userId: user.id, action: 'add_post_comment' }, 'Error añadiendo comentario'); cb?.({ ok: false }); }
  });

  socket.on('get_post_comments', async (data, cb) => {
    const { postId } = data || {};
    try { cb?.(await db.getPostComments(postId)); } catch { cb?.([]); }
  });

  // --- RECOMMENDATIONS ---
  socket.on('record_interaction', async (data, cb) => {
    const { postId, type, value, weight } = data || {};
    if (!postId || !type) return;
    try {
      await db.recordInteraction(user.id, postId, type, value ?? weight ?? 1);
      cb?.({ ok: true });
    } catch { cb?.({ ok: false }); }
  });

  socket.on('get_recommended_posts', async (data, cb) => {
    const { cursor, limit, seenIds } = data || {};
    try {
      const posts = await db.getRecommendedPosts(user.id, cursor || null, limit || 10, seenIds || []);
      cb?.(posts);
    } catch { cb?.([]); }
  });

  socket.on('get_trending_tags', async (_, cb) => {
    try { cb?.(await db.getTrendingTags()); } catch { cb?.([]); }
  });

  // --- PROFILE ---
  socket.on('update_profile', async (fields, cb) => {
    if (!fields) return cb?.({ ok: false });
    const clean = {};
    if (fields.display_name) clean.display_name = sanitize(fields.display_name).slice(0, MAX_DISPLAY_NAME_LENGTH);
    if (fields.username) clean.username = sanitize(fields.username).slice(0, MAX_USERNAME_LENGTH);
    if (fields.bio) clean.bio = sanitize(fields.bio).slice(0, MAX_BIO_LENGTH);
    if (fields.avatar !== undefined) clean.avatar = fields.avatar;
    try {
      await db.updateProfile(user.id, clean);
      if (clean.display_name) user.display_name = clean.display_name;
      if (clean.avatar) user.avatar = clean.avatar;
      if (fields.username) user.username = fields.username;
      if (fields.bio) user.bio = fields.bio;
      logger.info({ userId: user.id, updatedFields: Object.keys(fields), action: 'update_profile' }, 'Perfil actualizado');
      cb?.({ ok: true });
    } catch (e) { logger.error({ err: e.message, userId: user.id, action: 'update_profile' }, 'Error actualizando perfil'); cb?.({ ok: false }); }
  });

  // --- WEBRTC CALLS (P2P Audio/Video via Socket.IO Signaling) ---

  socket.on('get_calls', async (_, cb) => {
    try { cb?.(await db.getUserCalls(user.id)); } catch { cb?.([]); }
  });

  socket.on('log_call', async (data, cb) => {
    const { calleeId, type, status, duration } = data || {};
    try {
      const id = await db.addCall(user.id, calleeId, type, status, duration || 0);
      cb?.({ id });
      db.trackActivity(user.id, 'calls');
      if (status === 'missed') {
        const notif = await db.addSmartNotification(calleeId, 'missed_call', `Llamada perdida de ${user.display_name}`);
        emitToUser(calleeId, 'new_notification', notif);
      }
    } catch { cb?.({ ok: false }); }
  });

  // Initiate a call
  socket.on('start_call', async (data, cb) => {
    const { calleeId, callType } = data || {};
    if (!calleeId) return cb?.({ ok: false, error: 'Destinatario requerido' });
    try {
      const existing = await db.getActiveCallBetweenUsers(user.id, calleeId);
      if (existing) return cb?.({ ok: false, error: 'Ya hay una llamada activa' });

      const call = await db.createActiveCall(user.id, calleeId, callType || 'audio');
      const calleeSocket = await db.getUserActiveCalls(calleeId);

      emitToUser(calleeId, 'incoming_call', {
        callId: call.id,
        callerId: user.id,
        callerName: user.display_name,
        callerAvatar: user.avatar,
        callType: call.call_type,
      });

      socket.join(`call:${call.id}`);
      logger.info({ userId: user.id, calleeId, callId: call.id, callType: call.call_type, action: 'start_call' }, 'Llamada iniciada');
      cb?.({ ok: true, callId: call.id });
    } catch (e) { logger.error({ err: e.message, userId: user.id, calleeId, action: 'start_call' }, 'Error iniciando llamada'); cb?.({ ok: false }); }
  });

  // Accept an incoming call
  socket.on('accept_call', async (data, cb) => {
    const { callId } = data || {};
    try {
      await db.updateCallStatus(callId, 'connected');
      const call = await db.getActiveCall(callId);
      if (!call) return cb?.({ ok: false });

      socket.join(`call:${callId}`);
      emitToRoom(`call:${callId}`, 'call_accepted', { callId, userId: user.id });
      logger.info({ userId: user.id, callId, action: 'accept_call' }, 'Llamada aceptada');
      cb?.({ ok: true, call });
    } catch (e) { logger.error({ err: e.message, userId: user.id, callId, action: 'accept_call' }, 'Error aceptando llamada'); cb?.({ ok: false }); }
  });

  // Reject an incoming call
  socket.on('reject_call', async (data, cb) => {
    const { callId } = data || {};
    try {
      const call = await db.getActiveCall(callId);
      if (call) {
        await db.endActiveCall(callId);
        emitToUser(call.caller_id, 'call_rejected', { callId, userId: user.id });
        emitToRoom(`call:${callId}`, 'call_ended', { callId, reason: 'rejected' });
        const notif = await db.addSmartNotification(call.caller_id, 'missed_call', `Llamada perdida de ${user.display_name}`);
        emitToUser(call.caller_id, 'new_notification', notif);
        logger.info({ userId: user.id, callId, callerId: call.caller_id, action: 'reject_call' }, 'Llamada rechazada');
      }
      cb?.({ ok: true });
    } catch (e) { logger.error({ err: e.message, userId: user.id, callId, action: 'reject_call' }, 'Error rechazando llamada'); cb?.({ ok: false }); }
  });

  // End a call
  socket.on('end_call', async (data, cb) => {
    const { callId } = data || {};
    try {
      const call = await db.getActiveCall(callId);
      if (call) {
        const duration = call.started_at
          ? Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000)
          : 0;
        await db.addCall(call.caller_id, call.callee_id, call.call_type, 'completed', duration);
        await db.endActiveCall(callId);
        emitToRoom(`call:${callId}`, 'call_ended', { callId, reason: 'ended' });
        socket.leave(`call:${callId}`);
        logger.info({ userId: user.id, callId, duration, action: 'end_call' }, 'Llamada finalizada');
      }
      cb?.({ ok: true });
    } catch (e) { logger.error({ err: e.message, userId: user.id, callId, action: 'end_call' }, 'Error finalizando llamada'); cb?.({ ok: false }); }
  });

  // WebRTC signaling relay (SDP / ICE candidates)
  socket.on('signal_data', (data) => {
    const { callId, signal } = data || {};
    if (!callId || !signal) return;
    emitToRoomExceptSender(socket, `call:${callId}`, 'signal_data', { userId: user.id, signal });
  });

  // --- LIVEKIT INTEGRATION (Group Calls & Live Streaming) ---
  // Only active if LIVEKIT_API_KEY and LIVEKIT_API_SECRET are set in .env
  let LiveKit = null;
  try { LiveKit = require('livekit-server-sdk'); } catch {}

  socket.on('livekit_token', async (data, cb) => {
    if (!LiveKit || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
      return cb?.({ ok: false, error: 'LiveKit no configurado' });
    }
    const { room, identity, metadata } = data || {};
    if (!room || !identity) return cb?.({ ok: false });
    try {
      const at = new LiveKit.AccessToken(
        process.env.LIVEKIT_API_KEY,
        process.env.LIVEKIT_API_SECRET,
        { identity, metadata: JSON.stringify(metadata || {}) }
      );
      at.addGrant({ roomJoin: true, room });
      cb?.({ ok: true, token: await at.toJwt() });
    } catch { cb?.({ ok: false }); }
  });

  // --- LIVE STREAMING (Socket.IO Relay) ---

  // Start a live broadcast
  socket.on('start_broadcast', async (data, cb) => {
    const { title } = data || {};
    try {
      const broadcast = await db.startBroadcast(user.id, title || '');
      await socket.join(`broadcast:${broadcast.id}`);
      emitGlobal('new_broadcast', broadcast);
      logger.info({ userId: user.id, broadcastId: broadcast.id, title, action: 'start_broadcast' }, 'Transmisión en vivo iniciada');
      cb?.({ ok: true, broadcast });
    } catch (e) { logger.error({ err: e.message, userId: user.id, action: 'start_broadcast' }, 'Error iniciando transmisión'); cb?.({ ok: false }); }
  });

  // Stop a live broadcast
  socket.on('stop_broadcast', async (data, cb) => {
    const { broadcastId } = data || {};
    try {
      const broadcast = await db.stopBroadcast(broadcastId);
      socket.leave(`broadcast:${broadcastId}`);
      emitToRoom(`broadcast:${broadcastId}`, 'broadcast_ended', { broadcastId });
      emitGlobal('broadcast_removed', { broadcastId });
      logger.info({ userId: user.id, broadcastId, action: 'stop_broadcast' }, 'Transmisión finalizada');
      cb?.({ ok: true });
    } catch (e) { logger.error({ err: e.message, userId: user.id, broadcastId, action: 'stop_broadcast' }, 'Error deteniendo transmisión'); cb?.({ ok: false }); }
  });

  // Get active broadcasts
  socket.on('get_broadcasts', async (_, cb) => {
    try { cb?.(await db.getActiveBroadcasts()); } catch { cb?.([]); }
  });

  // Join a broadcast as viewer
  socket.on('view_broadcast', async (data, cb) => {
    const { broadcastId } = data || {};
    try {
      const broadcast = await db.getBroadcast(broadcastId);
      if (!broadcast || broadcast.status !== 'live') return cb?.({ ok: false, error: 'Transmisión no disponible' });

      await db.addBroadcastViewer(broadcastId, user.id);
      socket.join(`broadcast:${broadcastId}`);

      emitToRoom(`broadcast:${broadcastId}`, 'viewer_joined', { userId: user.id, displayName: user.display_name });
      cb?.({ ok: true, broadcast });
    } catch { cb?.({ ok: false }); }
  });

  // Leave a broadcast
  socket.on('leave_broadcast', async (data) => {
    const { broadcastId } = data || {};
    await db.removeBroadcastViewer(broadcastId, user.id);
    socket.leave(`broadcast:${broadcastId}`);
    emitToRoom(`broadcast:${broadcastId}`, 'viewer_left', { userId: user.id });
  });

  // Relay media chunks from broadcaster to viewers
  socket.on('broadcast_chunk', (data) => {
    const { broadcastId, chunk } = data || {};
    if (!broadcastId || !chunk) return;
    emitToRoomExceptSender(socket, `broadcast:${broadcastId}`, 'broadcast_chunk', { userId: user.id, chunk });
  });

  // WebRTC signaling for broadcast (SFU-style)
  socket.on('broadcast_signal', (data) => {
    const { broadcastId, signal, targetId } = data || {};
    if (!broadcastId || !signal) return;
    if (targetId) {
      emitToUser(targetId, 'broadcast_signal', { broadcastId, signal, userId: user.id });
    } else {
      emitToRoomExceptSender(socket, `broadcast:${broadcastId}`, 'broadcast_signal', { broadcastId, signal, userId: user.id });
    }
  });

  // --- TWO-STEP ---
  socket.on('set_two_step', async (data, cb) => {
    const { password, hint } = data || {};
    if (!password || password.length < 4) return cb?.({ ok: false, error: 'Mínimo 4 caracteres' });
    try {
      await db.setTwoStepPassword(user.id, password, hint || '');
      cb?.({ ok: true });
    } catch { cb?.({ ok: false }); }
  });

  socket.on('verify_two_step', async (data, cb) => {
    const { password } = data || {};
    try { cb?.({ ok: await db.verifyTwoStepPassword(user.id, password) }); } catch { cb?.({ ok: false }); }
  });

  socket.on('disable_two_step', async (data, cb) => {
    const { password } = data || {};
    try {
      const valid = await db.verifyTwoStepPassword(user.id, password);
      if (!valid) return cb?.({ ok: false, error: 'Contraseña incorrecta' });
      await db.disableTwoStep(user.id);
      cb?.({ ok: true });
    } catch { cb?.({ ok: false }); }
  });

  socket.on('get_two_step_status', async (_, cb) => {
    try { cb?.(await db.getTwoStepStatus(user.id)); } catch { cb?.({ enabled: 0, hint: '' }); }
  });

  // --- BLOCKED ---
  socket.on('block_user', async (data, cb) => {
    const { userId } = data || {};
    try { cb?.({ ok: await db.blockUser(user.id, userId) }); } catch { cb?.({ ok: false }); }
  });

  socket.on('unblock_user', async (data, cb) => {
    const { userId } = data || {};
    try { await db.unblockUser(user.id, userId); cb?.({ ok: true }); } catch { cb?.({ ok: false }); }
  });

  socket.on('get_blocked_users', async (_, cb) => {
    try { cb?.(await db.getBlockedUsers(user.id)); } catch { cb?.([]); }
  });

  // --- SESSIONS ---
  socket.on('get_sessions', async (_, cb) => {
    try {
      await db.updateSessionActivity(socket.handshake.auth?.token || '');
      cb?.(await db.getUserSessions(user.id));
    } catch { cb?.([]); }
  });

  socket.on('terminate_session', async (data, cb) => {
    const { sessionId } = data || {};
    try { await db.terminateSession(sessionId, user.id); cb?.({ ok: true }); } catch { cb?.({ ok: false }); }
  });

  socket.on('terminate_other_sessions', async (_, cb) => {
    try {
      await db.terminateOtherSessions(socket.handshake.auth?.token, user.id);
      cb?.({ ok: true });
    } catch { cb?.({ ok: false }); }
  });

  // --- PRIVACY ---
  socket.on('get_privacy_settings', async (_, cb) => {
    try { cb?.(await db.getPrivacySettings(user.id)); } catch { cb?.(null); }
  });

  socket.on('update_privacy_settings', async (fields, cb) => {
    try { await db.updatePrivacySettings(user.id, fields); cb?.({ ok: true }); } catch { cb?.({ ok: false }); }
  });

  // --- DELETE ACCOUNT ---
  socket.on('get_account_deletion', async (_, cb) => {
    try { cb?.({ delete_at: await db.getAccountDeletion(user.id) }); } catch { cb?.({ delete_at: null }); }
  });

  socket.on('schedule_account_deletion', async (data, cb) => {
    const { days } = data || {};
    try { await db.scheduleAccountDeletion(user.id, days); cb?.({ ok: true }); } catch { cb?.({ ok: false }); }
  });

  socket.on('cancel_account_deletion', async (_, cb) => {
    try { await db.cancelAccountDeletion(user.id); cb?.({ ok: true }); } catch { cb?.({ ok: false }); }
  });

  // --- VIDEOS ---
  socket.on('create_video', async (data, cb) => {
    const { videoUrl, thumbnail, caption } = data || {};
    if (!videoUrl) return cb?.({ ok: false });
    try {
      const video = await db.createVideo(user.id, videoUrl, thumbnail || '', caption || '');
      cb?.({ ok: true, video });
      emitGlobal('new_video', { ...video, display_name: user.display_name, avatar: user.avatar, username: user.username });
      logger.info({ userId: user.id, videoId: video.id, action: 'create_video' }, 'Video subido');
    } catch (e) { logger.error({ err: e.message, userId: user.id, action: 'create_video' }, 'Error subiendo video'); cb?.({ ok: false }); }
  });

  socket.on('get_videos', async (data, cb) => {
    const { cursor, limit } = data || {};
    try { cb?.(await db.getVideos(cursor || null, limit || 10)); } catch { cb?.([]); }
  });

  socket.on('like_video', async (data, cb) => {
    const { videoId } = data || {};
    try {
      const liked = await db.likeVideo(videoId, user.id);
      cb?.({ ok: liked });
      if (liked) emitGlobal('video_liked', { videoId, userId: user.id });
    } catch { cb?.({ ok: false }); }
  });

  socket.on('unlike_video', async (data, cb) => {
    const { videoId } = data || {};
    try { await db.unlikeVideo(videoId, user.id); cb?.({ ok: true }); } catch { cb?.({ ok: false }); }
  });

  socket.on('get_video_likes', async (data, cb) => {
    const { videoId } = data || {};
    try { cb?.(await db.getVideoLikes(videoId)); } catch { cb?.([]); }
  });

  socket.on('add_video_comment', async (data, cb) => {
    const { videoId, text } = data || {};
    if (!text) return cb?.({ ok: false });
    try {
      const comment = await db.addVideoComment(videoId, user.id, text);
      cb?.({ ok: true, comment });
      const full = { ...comment, display_name: user.display_name, avatar: user.avatar, username: user.username };
      emitGlobal('new_video_comment', { videoId, comment: full });
    } catch { cb?.({ ok: false }); }
  });

  socket.on('get_video_comments', async (data, cb) => {
    const { videoId } = data || {};
    try { cb?.(await db.getVideoComments(videoId)); } catch { cb?.([]); }
  });

  socket.on('has_user_liked', async (data, cb) => {
    const { videoId } = data || {};
    try { cb?.({ liked: await db.hasUserLiked(videoId, user.id) }); } catch { cb?.({ liked: false }); }
  });

  // --- LIVES ---
  socket.on('start_live', async (data, cb) => {
    const { title } = data || {};
    const cleanTitle = sanitize(title).slice(0, MAX_TITLE_LENGTH);
    try {
      const live = await db.startLive(user.id, cleanTitle || '');
      cb?.({ ok: true, live });
      emitGlobal('live_started', { ...live, display_name: user.display_name, avatar: user.avatar, username: user.username });
      db.trackActivity(user.id, 'live');
      logger.info({ userId: user.id, liveId: live.id, title: cleanTitle, action: 'start_live' }, 'Live iniciado');
    } catch (e) { logger.error({ err: e.message, userId: user.id, action: 'start_live' }, 'Error iniciando live'); cb?.({ ok: false }); }
  });

  socket.on('end_live', async (data, cb) => {
    const { liveId } = data || {};
    try { await db.endLive(liveId, user.id); logger.info({ userId: user.id, liveId, action: 'end_live' }, 'Live finalizado'); cb?.({ ok: true }); } catch (e) { logger.error({ err: e.message, userId: user.id, liveId, action: 'end_live' }, 'Error finalizando live'); cb?.({ ok: false }); }
  });

  socket.on('get_active_lives', async (_, cb) => {
  try { cb?.(await db.getActiveLives()); } catch { cb?.([]); }
  });

  // --- STORIES ---
  socket.on('create_story', async (data, cb) => {
    const { media } = data || {};
    if (!media) { cb?.({ ok: false, error: 'Media requerida' }); return; }
    try {
      const story = await db.createStory(user.id, media);
      cb?.({ ok: true, story });
      const contactsList = await db.getContacts(user.id);
      contactsList.forEach((c) => {
        emitToUser(c.id, 'new_story', story);
      });
      logger.info({ userId: user.id, storyId: story.id, action: 'create_story' }, 'Story creada');
    } catch (e) { logger.error({ err: e.message, userId: user.id, action: 'create_story' }, 'Error creando story'); cb?.({ ok: false }); }
  });

  socket.on('get_stories', async (_, cb) => {
    try { cb?.(await db.getStories(user.id)); } catch { cb?.([]); }
  });

  socket.on('view_story', async (data, cb) => {
    const { storyId } = data || {};
    try {
      await db.viewStory(storyId, user.id);
      cb?.({ ok: true });
    } catch { cb?.({ ok: false }); }
  });

  // --- LIVE COMMENTS & REACTIONS ---
  socket.on('add_live_comment', async (data, cb) => {
    const { liveId, text } = data || {};
    const cleanText = sanitize(text).slice(0, MAX_COMMENT_LENGTH);
    if (!cleanText) return cb?.({ ok: false, error: 'Comentario vacío' });
    try {
      const comment = await db.addLiveComment(liveId, user.id, cleanText);
      cb?.({ ok: true, comment });
      const full = { ...comment, display_name: user.display_name, avatar: user.avatar, username: user.username };
      emitToRoom(`live:${liveId}`, 'new_live_comment', { liveId, comment: full });
      logger.info({ userId: user.id, liveId, commentId: comment.id, action: 'add_live_comment' }, 'Comentario en live');
    } catch (e) { logger.error({ err: e.message, userId: user.id, action: 'add_live_comment' }, 'Error comentando live'); cb?.({ ok: false }); }
  });

  socket.on('get_live_comments', async (data, cb) => {
    const { liveId, cursor, limit } = data || {};
    try { cb?.(await db.getLiveComments(liveId, cursor || null, limit || 50)); } catch { cb?.([]); }
  });

  socket.on('add_live_reaction', async (data, cb) => {
    const { liveId, reaction } = data || {};
    if (!reaction) return cb?.({ ok: false });
    try {
      const react = await db.addLiveReaction(liveId, user.id, reaction);
      cb?.({ ok: true, reaction: react });
      if (react) {
        const full = { ...react, display_name: user.display_name, avatar: user.avatar, username: user.username };
        emitToRoom(`live:${liveId}`, 'new_live_reaction', { liveId, reaction: full });
      }
      logger.info({ userId: user.id, liveId, reaction, action: 'add_live_reaction' }, 'Reacción en live');
    } catch (e) { logger.error({ err: e.message, userId: user.id, action: 'add_live_reaction' }, 'Error reaccionando live'); cb?.({ ok: false }); }
  });

  socket.on('get_live_reactions', async (data, cb) => {
    const { liveId } = data || {};
    try { cb?.(await db.getLiveReactions(liveId)); } catch { cb?.([]); }
  });

  // --- LIVE STARS / GIFTS ---
  socket.on('send_live_gift', async (data, cb) => {
    const { liveId, recipientId, stars, message } = data || {};
    if (!liveId || !recipientId || !stars) return cb?.({ ok: false, error: 'Faltan datos' });
    try {
      const gift = await db.sendLiveGift(liveId, user.id, recipientId, stars, message || '');
      if (!gift) return cb?.({ ok: false, error: 'Estrellas insuficientes' });
      cb?.({ ok: true, gift });
      const full = { ...gift, sender_name: user.display_name, sender_avatar: user.avatar, sender_username: user.username };
      emitToRoom(`live:${liveId}`, 'new_live_gift', { liveId, gift: full });
      logger.info({ userId: user.id, liveId, recipientId, stars, action: 'send_live_gift' }, 'Estrella enviada en live');
    } catch (e) { logger.error({ err: e.message, userId: user.id, action: 'send_live_gift' }, 'Error enviando estrella'); cb?.({ ok: false }); }
  });

  socket.on('get_live_gifts', async (data, cb) => {
    const { liveId } = data || {};
    try { cb?.(await db.getLiveGifts(liveId)); } catch { cb?.([]); }
  });

  socket.on('get_user_stars', async (_, cb) => {
    try { const stars = await db.getUserStars(user.id); cb?.({ stars }); } catch { cb?.({ stars: 0 }); }
  });

  // --- CHANNELS ---
  socket.on('create_channel', async (data, cb) => {
    const { name, description } = data || {};
    if (!name) return cb?.({ ok: false, error: 'Nombre requerido' });
    try {
      const ch = await db.createChannel(name, description || '', user.id);
      cb?.({ ok: true, channel: ch });
    } catch { cb?.({ ok: false }); }
  });

  socket.on('get_channels', async (_, cb) => {
    try { cb?.(await db.getChannels()); } catch { cb?.([]); }
  });

  socket.on('subscribe_channel', async (data, cb) => {
    const { channelId } = data || {};
    try {
      const ok = await db.subscribeChannel(channelId, user.id);
      cb?.({ ok });
      if (ok) {
        const channel = (await db.getChannels()).find((c) => c.id === channelId);
        if (channel && channel.owner_id !== user.id) {
          const notif = await db.addSmartNotification(channel.owner_id, 'channel_subscribe', `${user.display_name} se suscribió a ${channel.name}`);
          emitToUser(channel.owner_id, 'new_notification', notif);
        }
      }
    } catch { cb?.({ ok: false }); }
  });

  socket.on('unsubscribe_channel', async (data, cb) => {
    const { channelId } = data || {};
    try { await db.unsubscribeChannel(channelId, user.id); cb?.({ ok: true }); } catch { cb?.({ ok: false }); }
  });

  socket.on('create_channel_post', async (data, cb) => {
    const { channelId, text, media, mediaType } = data || {};
    try {
      const post = await db.createChannelPost(channelId, user.id, text || '', media || '', mediaType || 'text');
      cb?.({ ok: true, post });
      const subscribers = await db.getChannelSubscribers?.(channelId) || [];
      subscribers.forEach((s) => {
        emitToUser(s.id, 'new_channel_post', { ...post, channel_id: channelId, display_name: user.display_name, avatar: user.avatar });
      });
    } catch { cb?.({ ok: false }); }
  });

  socket.on('get_channel_posts', async (data, cb) => {
    const { channelId, cursor, limit } = data || {};
    try { cb?.(await db.getChannelPosts(channelId, cursor || null, limit || 20)); } catch { cb?.([]); }
  });

  // --- COMMUNITIES ---
  socket.on('create_community', async (data, cb) => {
    const { name, description } = data || {};
    if (!name) return cb?.({ ok: false, error: 'Nombre requerido' });
    try {
      const comm = await db.createCommunity(name, description || '', user.id);
      cb?.({ ok: true, community: comm });
    } catch { cb?.({ ok: false }); }
  });

  socket.on('get_communities', async (_, cb) => {
    try { cb?.(await db.getCommunities(user.id)); } catch { cb?.([]); }
  });

  socket.on('join_community', async (data, cb) => {
    const { communityId } = data || {};
    try {
      const ok = await db.joinCommunity(communityId, user.id);
      cb?.({ ok });
      if (ok) {
        const community = (await db.getCommunities(user.id)).find((c) => c.id === communityId);
        if (community && community.owner_id !== user.id) {
          const notif = await db.addSmartNotification(community.owner_id, 'community_join', `${user.display_name} se unió a ${community.name}`);
          emitToUser(community.owner_id, 'new_notification', notif);
        }
      }
    } catch { cb?.({ ok: false }); }
  });

  socket.on('leave_community', async (data, cb) => {
    const { communityId } = data || {};
    try { await db.leaveCommunity(communityId, user.id); cb?.({ ok: true }); } catch { cb?.({ ok: false }); }
  });

  // --- POLLS ---
  socket.on('create_poll', async (data, cb) => {
    const { chatId, question, options, multipleChoice } = data || {};
    if (!question || !options?.length) return cb?.({ ok: false, error: 'Pregunta y opciones requeridas' });
    try {
      const pollId = await db.createPoll(chatId, user.id, question, options, multipleChoice);
      const poll = await db.getPoll(pollId);
      cb?.({ ok: true, poll });
      emitToRoom(`chat:${chatId}`, 'new_poll', poll);
    } catch { cb?.({ ok: false }); }
  });

  socket.on('get_poll', async (data, cb) => {
    const { pollId } = data || {};
    try { cb?.(await db.getPoll(pollId)); } catch { cb?.(null); }
  });

  socket.on('vote_poll', async (data, cb) => {
    const { pollId, optionId } = data || {};
    try {
      const ok = await db.votePoll(pollId, optionId, user.id);
      cb?.({ ok });
      if (ok) emitGlobal('poll_updated', { pollId, optionId, userId: user.id });
    } catch { cb?.({ ok: false }); }
  });

  // --- SHOP ---
  socket.on('create_product', async (data, cb) => {
    const { name, description, price, images, category, stock } = data || {};
    if (!name || !price) return cb?.({ ok: false, error: 'Nombre y precio requeridos' });
    try {
      const product = await db.createProduct(user.id, name, description || '', price, images || '', category || '', stock || 0);
      cb?.({ ok: true, product });
      db.trackActivity(user.id, 'shop');
    } catch { cb?.({ ok: false }); }
  });

  socket.on('get_products', async (data, cb) => {
    const { category, cursor, limit } = data || {};
    try { cb?.(await db.getProducts(category || '', cursor || null, limit || 20)); } catch { cb?.([]); }
  });

  socket.on('buy_product', async (data, cb) => {
    const { productId, quantity } = data || {};
    try {
      const order = await db.createOrder(user.id, productId, quantity || 1);
      if (!order) return cb?.({ ok: false, error: 'Producto no encontrado' });
      cb?.({ ok: true, order });
    } catch { cb?.({ ok: false }); }
  });

  socket.on('get_my_orders', async (_, cb) => {
    try { cb?.(await db.getMyOrders(user.id)); } catch { cb?.([]); }
  });

  // --- WISHLIST ---
  socket.on('create_wishlist', async (data, cb) => {
    const { name } = data || {};
    try {
      const wl = await db.createWishlist(user.id, name || 'Wishlist');
      cb?.({ ok: true, wishlist: wl });
    } catch { cb?.({ ok: false }); }
  });

  socket.on('add_to_wishlist', async (data, cb) => {
    const { wishlistId, productId } = data || {};
    try { cb?.({ ok: await db.addToWishlist(wishlistId, productId) }); } catch { cb?.({ ok: false }); }
  });

  socket.on('get_wishlists', async (_, cb) => {
    try { cb?.(await db.getWishlists(user.id)); } catch { cb?.([]); }
  });

  // --- FLASH DEALS ---
  socket.on('get_flash_deals', async (_, cb) => {
    try { cb?.(await db.getFlashDeals()); } catch { cb?.([]); }
  });

  // --- MEMES ---
  socket.on('create_meme', async (data, cb) => {
    const { imageUrl, caption, template } = data || {};
    if (!imageUrl) return cb?.({ ok: false });
    try {
      const meme = await db.createMeme(user.id, imageUrl, caption || '', template || '');
      cb?.({ ok: true, meme });
      emitGlobal('new_meme', { ...meme, display_name: user.display_name, avatar: user.avatar });
    } catch { cb?.({ ok: false }); }
  });

  socket.on('get_memes', async (data, cb) => {
    const { cursor, limit } = data || {};
    try { cb?.(await db.getMemes(cursor || null, limit || 20)); } catch { cb?.([]); }
  });

  socket.on('like_meme', async (data, cb) => {
    const { memeId } = data || {};
    try { cb?.({ ok: await db.likeMeme(memeId, user.id) }); } catch { cb?.({ ok: false }); }
  });

  // --- STICKERS ---
  socket.on('get_sticker_packs', async (_, cb) => {
    try { cb?.(await db.getStickerPacks()); } catch { cb?.([]); }
  });

  socket.on('get_stickers', async (data, cb) => {
    const { packId } = data || {};
    try { cb?.(await db.getStickers(packId)); } catch { cb?.([]); }
  });

  socket.on('purchase_sticker', async (data, cb) => {
    const { stickerId } = data || {};
    try { cb?.({ ok: await db.purchaseSticker(user.id, stickerId) }); } catch { cb?.({ ok: false }); }
  });

  socket.on('get_my_stickers', async (_, cb) => {
    try { cb?.(await db.getMyStickers(user.id)); } catch { cb?.([]); }
  });

  // --- AVATAR 3D ---
  socket.on('save_avatar', async (data, cb) => {
    const { avatarJson } = data || {};
    try { await db.saveAvatarCustomization(user.id, avatarJson || '{}'); cb?.({ ok: true }); } catch { cb?.({ ok: false }); }
  });

  socket.on('get_avatar', async (_, cb) => {
    try { cb?.(JSON.parse(await db.getAvatarCustomization(user.id) || '{}')); } catch { cb?.({}); }
  });

  // --- VIBE BALANCE ---
  socket.on('get_vibe_balance', async (_, cb) => {
    try { cb?.(await db.getVibeBalance(user.id)); } catch { cb?.(null); }
  });

  socket.on('start_focus', async (data, cb) => {
    const { mode } = data || {};
    try {
      const fs = await db.startFocusSession(user.id, mode || 'focus');
      cb?.({ ok: true, session: fs });
      emitToUser(user.id, 'focus_started', fs);
    } catch { cb?.({ ok: false }); }
  });

  socket.on('end_focus', async (_, cb) => {
    try {
      const fs = await db.endFocusSession(user.id);
      cb?.({ ok: true, session: fs });
      emitToUser(user.id, 'focus_ended', fs);
    } catch { cb?.({ ok: false }); }
  });

  socket.on('get_focus_status', async (_, cb) => {
    try { cb?.(await db.getActiveFocusSession(user.id)); } catch { cb?.(null); }
  });

  socket.on('get_notifications', async (data, cb) => {
    const { cursor, limit } = data || {};
    try { cb?.(await db.getSmartNotifications(user.id, cursor || null, limit || 20)); } catch { cb?.([]); }
  });

  socket.on('mark_notification_read', async (data, cb) => {
    const { id } = data || {};
    try { await db.markNotificationRead(id); cb?.({ ok: true }); } catch { cb?.({ ok: false }); }
  });

  // --- SHARED NOTES ---
  socket.on('save_note', async (data, cb) => {
    const { chatId, content } = data || {};
    try {
      const note = await db.saveSharedNote(chatId, content || '', user.id);
      cb?.({ ok: true, note });
    } catch { cb?.({ ok: false }); }
  });

  socket.on('get_note', async (data, cb) => {
    const { chatId } = data || {};
    try { cb?.(await db.getSharedNote(chatId)); } catch { cb?.(null); }
  });

  // --- TASKS ---
  socket.on('create_task', async (data, cb) => {
    const { chatId, title, assignedTo, dueDate } = data || {};
    if (!title) return cb?.({ ok: false, error: 'Título requerido' });
    try {
      const task = await db.createTask(chatId, title, user.id, assignedTo || null, dueDate || null);
      cb?.({ ok: true, task });
      emitToRoom(`chat:${chatId}`, 'new_task', task);
    } catch { cb?.({ ok: false }); }
  });

  socket.on('get_tasks', async (data, cb) => {
    const { chatId } = data || {};
    try { cb?.(await db.getTasks(chatId)); } catch { cb?.([]); }
  });

  socket.on('complete_task', async (data, cb) => {
    const { taskId } = data || {};
    try { await db.completeTask(taskId); cb?.({ ok: true }); } catch { cb?.({ ok: false }); }
  });

  // --- WATCH TOGETHER ---
  socket.on('create_watch_session', async (data, cb) => {
    const { chatId, videoUrl } = data || {};
    try {
      const ws = await db.createWatchSession(chatId, user.id, videoUrl);
      cb?.({ ok: true, session: ws });
      emitToRoom(`chat:${chatId}`, 'watch_session_started', ws);
    } catch { cb?.({ ok: false }); }
  });

  socket.on('sync_watch', (data) => {
    const { sessionId, currentTime, playing } = data || {};
    db.updateWatchSession(sessionId, currentTime, playing);
    emitGlobal('watch_sync', { sessionId, currentTime, playing });
  });

  socket.on('get_watch_session', async (data, cb) => {
    const { chatId } = data || {};
    try { cb?.(await db.getWatchSession(chatId)); } catch { cb?.(null); }
  });

  // --- GAMES ---
  socket.on('get_games', async (_, cb) => {
    try { cb?.(await db.getAvailableGames()); } catch { cb?.([]); }
  });

  socket.on('create_game', async (data, cb) => {
    const { gameId, chatId } = data || {};
    try {
      const session = await db.createGameSession(gameId, chatId, user.id);
      await db.joinGameSession(session.id, user.id);
      db.trackActivity(user.id, 'games');
      cb?.({ ok: true, session });
      emitToRoom(`chat:${chatId}`, 'game_started', session);
    } catch { cb?.({ ok: false }); }
  });

  socket.on('join_game', async (data, cb) => {
    const { sessionId } = data || {};
    try {
      const ok = await db.joinGameSession(sessionId, user.id);
      cb?.({ ok, sessionId });
      emitToRoomExceptSender(socket, `game:${sessionId}`, 'player_joined', { userId: user.id, name: user.display_name });
      socket.join(`game:${sessionId}`);
    } catch { cb?.({ ok: false }); }
  });

  socket.on('game_action', (d) => {
    const { sessionId, action, data } = d || {};
    emitToRoomExceptSender(socket, `game:${sessionId}`, 'game_update', { userId: user.id, action, data });
  });

  // --- ROOMS ---
  socket.on('join_chat', (data) => { const { chatId } = data || {}; socket.join(`chat:${chatId}`); });
  socket.on('leave_chat', (data) => { const { chatId } = data || {}; socket.leave(`chat:${chatId}`); });
  socket.on('join_live', (data) => { const { liveId } = data || {}; if (liveId) socket.join(`live:${liveId}`); });
  socket.on('leave_live', (data) => { const { liveId } = data || {}; if (liveId) socket.leave(`live:${liveId}`); });

  // --- DISCONNECT ---
  socket.on('disconnect', async (reason) => {
    db.setOffline(user.id);
    db.updateLastSeen(user.id);
    logger.info({ userId: user.id, reason, action: 'disconnect' }, 'Usuario desconectado');
    // End active calls
    const activeCalls = await db.getUserActiveCalls(user.id).catch(() => []);
    for (const call of activeCalls) {
      await db.endActiveCall(call.id).catch(() => {});
      emitToRoom(`call:${call.id}`, 'call_ended', { callId: call.id, reason: 'disconnected' });
    }
    // End active broadcasts
    try {
      const broadcasts = await db.getActiveBroadcasts();
      for (const b of broadcasts) {
        if (b.user_id === user.id) {
          await db.stopBroadcast(b.id);
          emitToRoom(`broadcast:${b.id}`, 'broadcast_ended', { broadcastId: b.id });
          emitGlobal('broadcast_removed', { broadcastId: b.id });
        }
      }
    } catch {}
    // Notify contacts
    valkey.publish('online:status', `user:${user.id}`, 'contact_status', { userId: user.id, online: false }).catch(() => {});
    contacts.then((list) => {
      list.forEach((c) => {
        emitToUser(c.id, 'contact_status', { userId: user.id, online: false });
      });
    }).catch(() => {});
  });
});

const PORT = process.env.PORT || 3000;

db.init().then(() => {
  server.listen(PORT, () => logger.info({ port: PORT }, 'Servidor HTTP iniciado'));
  setInterval(() => db.cleanupExpiredSessions(), 6 * 60 * 60 * 1000);
}).catch((err) => {
  logger.fatal({ err }, 'No se pudo iniciar el servidor');
  process.exit(1);
});

process.on('SIGINT', () => {
  logger.info('Servidor deteniéndose');
  server.close(() => process.exit(0));
});

module.exports = { sanitize };
