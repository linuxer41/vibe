// Connection Manager — shared session tracking for WS and TCP transports
// Delivers frames to connected clients. Kafka handles cross-instance message bus.
// Redis stays only for TCP socket gateway state (connection registry).

const { decode } = require('@msgpack/msgpack')
const db = require('../db/init')
const logger = require('./logger')
const kafka = require('./kafka')
const { encodeFrame, decodeFrame } = require('./frame')
const { MessageType } = require('./message-types')
const { Flags } = require('./flags')

const sessions = new Map()
let sessionCounter = 0

function addConnection(userId, sendFn, transport = 'ws') {
  if (!userId) return null
  const sessionId = ++sessionCounter
  if (!sessions.has(userId)) sessions.set(userId, new Map())
  sessions.get(userId).set(sessionId, { send: sendFn, transport })
  return sessionId
}

function removeConnection(userId, sessionId) {
  if (!userId || !sessions.has(userId)) return
  const userSessions = sessions.get(userId)
  userSessions.delete(sessionId)
  if (userSessions.size === 0) sessions.delete(userId)
}

function sendToUser(userId, frame) {
  const userSessions = sessions.get(userId)
  if (!userSessions) return
  const buf = Buffer.isBuffer(frame) ? frame : Buffer.from(frame)
  for (const { send } of userSessions.values()) {
    try { send(buf) } catch {}
  }
}

async function sendToChat(chatId, frame, excludeUserId) {
  try {
    const members = await db.getChatMembers(chatId)
    for (const m of members) {
      if (m.id !== excludeUserId) sendToUser(m.id, frame)
    }
  } catch {}
}

function getUserCount() { return sessions.size }

// ── Kafka consumer (replaces Valkey pub/sub for cross-instance delivery) ──
async function startKafkaConsumer() {
  await kafka.connectProducer()

  const consumer = await kafka.startConsumer('vibe-server-group', {
    'chat-messages': async (key, value) => {
      // New chat message — fanout to chat members
      try {
        const { chatId, msg, senderId } = decode(value)
        if (!chatId || !msg) return
        const members = await db.getChatMembers(chatId)
        for (const m of members) {
          db.getUserChat(chatId, m.id).then(chatData => {
            if (!chatData) return
            const payload = { ...chatData, message: msg }
            const frame = encodeFrame(MessageType.ChatNewMessage, Flags.NONE, 0, Buffer.from(JSON.stringify(payload)))
            sendToUser(m.id, frame)
          }).catch(() => {})
          if (m.id !== senderId) {
            db.addSmartNotification(m.id, 'new_message', `Nuevo mensaje de ${msg.sender_name}`).then(notif => {
              if (!notif) return
              sendToUser(m.id, encodeFrame(MessageType.NotifNew, Flags.NONE, 0, Buffer.from(JSON.stringify(notif))))
            }).catch(() => {})
          }
        }
      } catch {}
    },

    'chat-new': async (key, value) => {
      // New chat created — notify user
      try {
        const { chatId, userId } = decode(value)
        if (!userId) return
        db.getUserChat(chatId, userId).then(chatData => {
          if (!chatData) return
          const frame = encodeFrame(MessageType.ChatNewMessage, Flags.NONE, 0, Buffer.from(JSON.stringify({ ...chatData, message: null })))
          sendToUser(userId, frame)
        }).catch(() => {})
      } catch {}
    },

    'chat-events': async (key, value) => {
      // Typing, status, delete, edit events — raw frame delivery
      try {
        const { chatId, targetUserId, frameBase64, senderId } = decode(value)
        if (!frameBase64) return
        const buf = Buffer.from(frameBase64, 'base64')

        if (targetUserId) {
          sendToUser(targetUserId, buf)
        } else if (chatId) {
          const members = await db.getChatMembers(chatId)
          for (const m of members) {
            if (m.id !== senderId) sendToUser(m.id, buf)
          }
        }
      } catch {}
    },

    'user-presence': async (key, value) => {
      // Online/offline status
      try {
        const { userId, online } = decode(value)
        if (!userId) return
        const payload = JSON.stringify({ userId, online })
        sendToUser(userId, encodeFrame(MessageType.PresenceStatus, Flags.NONE, 0, Buffer.from(payload)))
      } catch {}
    },
  })

  if (consumer) {
    logger.info({ action: 'kafka_consumer_start' }, 'Connection manager Kafka consumer started')
  }
  return consumer
}

module.exports = { addConnection, removeConnection, sendToUser, sendToChat, getUserCount, startKafkaConsumer }
