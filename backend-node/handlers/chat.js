const db = require('../db/init')
const kafka = require('../lib/kafka')
const logger = require('../lib/logger')
const codec = require('../lib/protocol-codec')
const { MessageType } = require('../lib/message-types')
const { encodeFrame, encodeResponse, encodeError } = require('../lib/frame')

const { Flags } = require('../lib/flags')
const MAX_MESSAGE_LENGTH = 5000

function sanitize(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/<[^>]*>/g, '').trim().slice(0, MAX_MESSAGE_LENGTH)
}

function register(registerHandler) {
  registerHandler(MessageType.ChatSend, handleSendMessage)
  registerHandler(MessageType.ChatMarkRead, handleMarkRead)
  registerHandler(MessageType.ChatMessageDelivered, handleMessageDelivered)
  registerHandler(MessageType.ChatGetChats, handleGetChats)
  registerHandler(MessageType.ChatGetMessages, handleGetMessages)
  registerHandler(MessageType.ChatTyping, handleTyping)
  registerHandler(MessageType.ChatStopTyping, handleStopTyping)
  registerHandler(MessageType.ChatDelete, handleDeleteMessage)
  registerHandler(MessageType.ChatEdit, handleEditMessage)
  registerHandler(MessageType.ChatCreatePrivate, handleCreatePrivate)
  registerHandler(MessageType.ChatCreateGroup, handleCreateGroup)
}

function sendResponse(ws, streamId, type, payload) {
  ws.send(encodeFrame(type, Flags.RESPONSE, streamId, payload))
}

async function handleSendMessage(ws, user, frame) {
  const data = codec.chat.sendMessageRequest(frame.payload)
  const cleanText = sanitize(data.text).slice(0, MAX_MESSAGE_LENGTH)
  if (!cleanText && data.contentType !== 1 && data.contentType !== 2 && data.contentType !== 3) {
    sendResponse(ws, frame.streamId, MessageType.ChatSendResp, Buffer.from(JSON.stringify({ ok: false, error: 'Texto inválido' })))
    return
  }
  try {
    const msgId = await db.addMessage(data.chatId, user.id, cleanText, String(data.contentType || 0), data.replyToId || null)
    db.trackActivity(user.id, 'messaging')
    kafka.produce('chat-messages', String(data.chatId), {
      chatId: data.chatId, msg: {
        id: msgId, chat_id: data.chatId, sender_id: user.id,
        sender_name: user.display_name, sender_avatar: user.avatar,
        text: cleanText, type: String(data.contentType || 'text'), reply_to_id: data.replyToId || null, forwarded: 0,
        created_at: new Date().toISOString(), status: 'sent'
      }, senderId: user.id
    })
    const resp = codec.chat.sendMessageResponse(msgId, Math.floor(Date.now() / 1000))
    sendResponse(ws, frame.streamId, MessageType.ChatSendResp, resp)
    logger.info({ userId: user.id, chatId: data.chatId, msgId, action: 'send_message' }, 'Mensaje enviado')
  } catch (e) {
    logger.error({ err: e.message, userId: user.id, chatId: data.chatId, action: 'send_message' }, 'Error')
    sendResponse(ws, frame.streamId, MessageType.ChatSendResp, Buffer.from(JSON.stringify({ ok: false, error: e.message })))
  }
}

async function handleMarkRead(ws, user, frame) {
  const { messageId } = codec.chat.markReadRequest(frame.payload)
  try {
    await db.markRead(messageId, user.id)
    await db.updateMessageStatus(messageId, 'read')
    const msg = await db.getMessageById(messageId)
    if (msg && msg.sender_id !== user.id) {
      const buf = codec.chat.messageStatus(messageId, 2)
      const target = encodeFrame(MessageType.ChatMessageStatus, Flags.NONE, 0, buf)
      kafka.produce('chat-events', String(messageId), { chatId: msg.chat_id, targetUserId: msg.sender_id, frameBase64: target.toString('base64') })
    }
  } catch {}
}

async function handleMessageDelivered(ws, user, frame) {
  const { messageId, senderId } = codec.chat.deliveredRequest(frame.payload)
  try {
    await db.updateMessageStatus(messageId, 'delivered')
    const buf = codec.chat.messageStatus(messageId, 1)
    const target = encodeFrame(MessageType.ChatMessageStatus, Flags.NONE, 0, buf)
    kafka.produce('chat-events', String(messageId), { chatId: 0, targetUserId: senderId, frameBase64: target.toString('base64') })
  } catch {}
}

async function handleGetChats(ws, user, frame) {
  try {
    const list = await db.getUserChats(user.id)
    ws.send(encodeFrame(MessageType.ChatGetChatsResp, Flags.RESPONSE, frame.streamId, Buffer.from(JSON.stringify(list))))
  } catch (e) {
    ws.send(encodeFrame(MessageType.ChatGetChatsResp, Flags.RESPONSE | Flags.ERROR, frame.streamId, Buffer.from(e.message)))
  }
}

async function handleGetMessages(ws, user, frame) {
  try {
    // Use the decode from flatbuffers bytebuffer
    const buf = new (require('flatbuffers')).ByteBuffer(new Uint8Array(frame.payload))
    buf.setPosition(buf.readInt32(buf.position()) + buf.position())
    const chatId = (() => { const o = buf.__offset(4); return o ? Number(buf.readInt64(o + buf.pos)) : 0 })()
    const limit = (() => { const o = buf.__offset(6); return o ? buf.readInt16(o + buf.pos) : 50 })()
    const cursor = (() => { const o = buf.__offset(8); return o ? Number(buf.readInt64(o + buf.pos)) : 0 })()
    const msgs = await db.getMessages(chatId, limit, cursor || null, user.id)
    ws.send(encodeFrame(MessageType.ChatGetMessagesResp, Flags.RESPONSE, frame.streamId, Buffer.from(JSON.stringify(msgs))))
  } catch (e) {
    ws.send(encodeFrame(MessageType.ChatGetMessagesResp, Flags.RESPONSE | Flags.ERROR, frame.streamId, Buffer.from(e.message)))
  }
}

function handleTyping(ws, user, frame) {
  const buf = new (require('flatbuffers')).ByteBuffer(new Uint8Array(frame.payload))
  buf.setPosition(buf.readInt32(buf.position()) + buf.position())
  const chatId = (() => { const o = buf.__offset(4); return o ? Number(buf.readInt64(o + buf.pos)) : 0 })()
  const frameBase64 = Buffer.from(frame.payload).toString('base64')
  kafka.produce('chat-events', String(chatId), { chatId, frameBase64, senderId: user.id, type: 'typing' })
}

function handleStopTyping(ws, user, frame) {
  const buf = new (require('flatbuffers')).ByteBuffer(new Uint8Array(frame.payload))
  buf.setPosition(buf.readInt32(buf.position()) + buf.position())
  const chatId = (() => { const o = buf.__offset(4); return o ? Number(buf.readInt64(o + buf.pos)) : 0 })()
  const frameBase64 = Buffer.from(frame.payload).toString('base64')
  kafka.produce('chat-events', String(chatId), { chatId, frameBase64, senderId: user.id, type: 'stop_typing' })
}

async function handleDeleteMessage(ws, user, frame) {
  const buf = new (require('flatbuffers')).ByteBuffer(new Uint8Array(frame.payload))
  buf.setPosition(buf.readInt32(buf.position()) + buf.position())
  const messageId = (() => { const o = buf.__offset(4); return o ? Number(buf.readInt64(o + buf.pos)) : 0 })()
  const chatId = (() => { const o = buf.__offset(6); return o ? Number(buf.readInt64(o + buf.pos)) : 0 })()
  try {
    await db.deleteMessage(messageId, user.id)
    const frameBase64 = Buffer.from(frame.payload).toString('base64')
    kafka.produce('chat-events', String(messageId), { chatId, frameBase64, senderId: user.id, type: 'delete' })
  } catch {}
}

async function handleEditMessage(ws, user, frame) {
  const buf = new (require('flatbuffers')).ByteBuffer(new Uint8Array(frame.payload))
  buf.setPosition(buf.readInt32(buf.position()) + buf.position())
  const messageId = (() => { const o = buf.__offset(4); return o ? Number(buf.readInt64(o + buf.pos)) : 0 })()
  const chatId = (() => { const o = buf.__offset(6); return o ? Number(buf.readInt64(o + buf.pos)) : 0 })()
  const text = (() => { const o = buf.__offset(8); return o ? buf.readString(o + buf.pos) : '' })()
  try {
    await db.editMessage(messageId, user.id, text)
    const frameBase64 = Buffer.from(frame.payload).toString('base64')
    kafka.produce('chat-events', String(messageId), { chatId, frameBase64, senderId: user.id, type: 'edit' })
  } catch {}
}

async function handleCreatePrivate(ws, user, frame) {
  const buf = new (require('flatbuffers')).ByteBuffer(new Uint8Array(frame.payload))
  buf.setPosition(buf.readInt32(buf.position()) + buf.position())
  const contactId = (() => { const o = buf.__offset(4); return o ? Number(buf.readInt64(o + buf.pos)) : 0 })()
  try {
    const chatId = await db.createPrivateChat(user.id, contactId)
    const chatData = await db.getUserChat(chatId, user.id)
    ws.send(encodeFrame(MessageType.ChatCreatePrivateResp, Flags.RESPONSE, frame.streamId, Buffer.from(JSON.stringify({ chatId, ...chatData }))))
    kafka.produce('chat-new', String(chatId), { chatId, userId: contactId, type: 'private' })
  } catch (e) {
    ws.send(encodeFrame(MessageType.ChatCreatePrivateResp, Flags.RESPONSE | Flags.ERROR, frame.streamId, Buffer.from(e.message)))
  }
}

async function handleCreateGroup(ws, user, frame) {
  const buf = new (require('flatbuffers')).ByteBuffer(new Uint8Array(frame.payload))
  buf.setPosition(buf.readInt32(buf.position()) + buf.position())
  const name = (() => { const o = buf.__offset(4); return o ? buf.readString(o + buf.pos) : '' })()
  const memberIds = []
  const vecOff = buf.__offset(6)
  if (vecOff) {
    const vecLen = buf.readInt32(vecOff + buf.pos)
    for (let i = 0; i < vecLen; i++) {
      memberIds.push(Number(buf.readInt64(buf.__vector(vecOff + buf.pos) + i * 8)))
    }
  }
  try {
    const chatId = await db.createGroup(name, user.id, memberIds)
    ws.send(encodeFrame(MessageType.ChatCreateGroupResp, Flags.RESPONSE, frame.streamId, Buffer.from(JSON.stringify({ chatId, memberIds }))))
    for (const mId of memberIds) {
      kafka.produce('chat-new', String(chatId), { chatId, userId: mId, type: 'group' })
    }
  } catch (e) {
    ws.send(encodeFrame(MessageType.ChatCreateGroupResp, Flags.RESPONSE | Flags.ERROR, frame.streamId, Buffer.from(e.message)))
  }
}

module.exports = { register }
