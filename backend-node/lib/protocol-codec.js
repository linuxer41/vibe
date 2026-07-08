// FlatBuffers codec using the runtime API directly
// Matches byte layout from shared/fbs/*.fbs exactly
// Same bytes = compatible with frontend TS and Rust generated code

const flatbuffers = require('flatbuffers')
const { Builder, ByteBuffer } = flatbuffers

// ── Auth ──

function authSendCodeRequest(data) {
  const fbb = new Builder(64)
  const phoneOff = fbb.createString(data.phone)
  fbb.finish(phoneOff)
  return { bytes: fbb.asUint8Array(), getRoot: (buf) => {
    const bb = new ByteBuffer(new Uint8Array(buf))
    const off = bb.readInt32(bb.position()) + bb.position()
    return { phone: (() => { const so = bb.readInt32(off + 4) + off; return bb.readString(so + 4, bb.readInt32(so)) })() }
  }}
}

function authSendCodeResponse(ok, code, error) {
  const fbb = new Builder(64)
  const codeOff = code ? fbb.createString(code) : 0
  const errOff = error ? fbb.createString(error) : 0
  fbb.startObject(3)
  fbb.addBool(ok, 0)
  if (code) fbb.addOffset(codeOff, 1)
  if (error) fbb.addOffset(errOff, 2)
  const end = fbb.endObject()
  fbb.finish(end)
  return fbb.asUint8Array()
}

function authVerifyCodeRequest(buf) {
  const bb = new ByteBuffer(new Uint8Array(buf))
  bb.setPosition(bb.readInt32(bb.position()) + bb.position())
  const phone = (() => { const o = bb.__offset(4); return o ? bb.readString(o + bb.pos) : '' })()
  const code = (() => { const o = bb.__offset(6); return o ? bb.readString(o + bb.pos) : '' })()
  const username = (() => { const o = bb.__offset(8); return o ? bb.readString(o + bb.pos) : '' })()
  const displayName = (() => { const o = bb.__offset(10); return o ? bb.readString(o + bb.pos) : '' })()
  const countryCode = (() => { const o = bb.__offset(12); return o ? bb.readString(o + bb.pos) : '' })()
  return { phone, code, username, displayName, countryCode }
}

function authVerifyCodeResponse(ok, token, userId, displayName, avatar, isNew, error) {
  const fbb = new Builder(256)
  const tokenOff = fbb.createString(token || '')
  const nameOff = fbb.createString(displayName || '')
  const avatarOff = avatar ? fbb.createString(avatar) : 0
  const errOff = error ? fbb.createString(error) : 0
  fbb.startObject(7)
  fbb.addBool(ok, 0)
  fbb.addOffset(tokenOff, 1)
  fbb.addInt64(userId, 2)
  fbb.addOffset(nameOff, 3)
  if (avatar) fbb.addOffset(avatarOff, 4)
  fbb.addBool(isNew, 5)
  if (error) fbb.addOffset(errOff, 6)
  return fbb.endObject()
}

function authRestoreRequest(buf) {
  const bb = new ByteBuffer(new Uint8Array(buf))
  bb.setPosition(bb.readInt32(bb.position()) + bb.position())
  const token = (() => { const o = bb.__offset(4); return o ? bb.readString(o + bb.pos) : '' })()
  return { token }
}

function authRestoreResponse(ok, userId, displayName, phone, avatar, bio) {
  const fbb = new Builder(256)
  const nameOff = fbb.createString(displayName || '')
  const phoneOff = fbb.createString(phone || '')
  const avatarOff = avatar ? fbb.createString(avatar) : 0
  const bioOff = bio ? fbb.createString(bio) : 0
  fbb.startObject(6)
  fbb.addBool(ok, 0)
  fbb.addInt64(userId, 1)
  fbb.addOffset(nameOff, 2)
  fbb.addOffset(phoneOff, 3)
  if (avatar) fbb.addOffset(avatarOff, 4)
  if (bio) fbb.addOffset(bioOff, 5)
  return fbb.endObject()
}

// ── Chat ──

function chatSendMessageRequest(buf) {
  const bb = new ByteBuffer(new Uint8Array(buf))
  bb.setPosition(bb.readInt32(bb.position()) + bb.position())
  return {
    chatId: (() => { const o = bb.__offset(4); return o ? bb.readInt64(o + bb.pos) : 0 })(),
    text: (() => { const o = bb.__offset(6); return o ? bb.readString(o + bb.pos) : '' })(),
    contentType: (() => { const o = bb.__offset(8); return o ? bb.readInt16(o + bb.pos) : 0 })(),
    replyToId: (() => { const o = bb.__offset(10); return o ? bb.readInt64(o + bb.pos) : 0 })(),
  }
}

// Note: flatbuffers JS wrapper for Builder doesn't support addInt64 directly
// We need to handle int64 specially for Snowflake IDs
// For JS Number-safe IDs (< 2^53), we use prepWrite with 8 bytes

function packInt64(builder, value) {
  const hi = Math.floor(Number(value) / 0x100000000)
  const lo = Number(value) >>> 0
  builder.prep(8, 0)
  builder.writeInt32(lo)  // little-endian: lo first
  builder.writeInt32(hi)
}

function addInt64Field(builder, value, fieldIndex) {
  if (!value) return
  const offset = builder.offset()
  packInt64(builder, value)
  builder.addOffset(offset, fieldIndex)
}

function chatSendMessageResponse(messageId, createdAt) {
  const fbb = new Builder(64)
  fbb.startObject(2)
  fbb.addInt64(messageId, 0)
  fbb.addInt32(createdAt, 1)
  const end = fbb.endObject()
  fbb.finish(end)
  return fbb.asUint8Array()
}

function chatMarkReadRequest(buf) {
  const bb = new ByteBuffer(new Uint8Array(buf))
  bb.setPosition(bb.readInt32(bb.position()) + bb.position())
  const o = bb.__offset(4)
  return { messageId: o ? Number(bb.readInt64(o + bb.pos)) : 0 }
}

function chatTyping(chatId, userId, name) {
  const fbb = new Builder(128)
  const nameOff = fbb.createString(name)
  fbb.startObject(3)
  fbb.addInt64(chatId, 0)
  fbb.addInt64(userId, 1)
  fbb.addOffset(nameOff, 2)
  const end = fbb.endObject()
  fbb.finish(end)
  return fbb.asUint8Array()
}

function chatMessageStatus(messageId, status) {
  const fbb = new Builder(32)
  fbb.startObject(2)
  fbb.addInt64(messageId, 0)
  fbb.addInt16(status, 1)
  const end = fbb.endObject()
  fbb.finish(end)
  return fbb.asUint8Array()
}

function chatDeliveredRequest(buf) {
  const bb = new ByteBuffer(new Uint8Array(buf))
  bb.setPosition(bb.readInt32(bb.position()) + bb.position())
  return {
    messageId: (() => { const o = bb.__offset(4); return o ? Number(bb.readInt64(o + bb.pos)) : 0 })(),
    senderId: (() => { const o = bb.__offset(6); return o ? Number(bb.readInt64(o + bb.pos)) : 0 })(),
  }
}

// ── Presence ──

function presenceStatus(userId, online) {
  const fbb = new Builder(32)
  fbb.startObject(2)
  fbb.addInt64(userId, 0)
  fbb.addBool(online, 1)
  const end = fbb.endObject()
  fbb.finish(end)
  return fbb.asUint8Array()
}

module.exports = {
  auth: {
    sendCodeRequest: (buf) => authSendCodeRequest(buf),
    sendCodeResponse: authSendCodeResponse,
    verifyCodeRequest: authVerifyCodeRequest,
    verifyCodeResponse: authVerifyCodeResponse,
    restoreRequest: authRestoreRequest,
    restoreResponse: authRestoreResponse,
  },
  chat: {
    sendMessageRequest: chatSendMessageRequest,
    sendMessageResponse: chatSendMessageResponse,
    markReadRequest: chatMarkReadRequest,
    typing: chatTyping,
    messageStatus: chatMessageStatus,
    deliveredRequest: chatDeliveredRequest,
  },
  presence: {
    status: presenceStatus,
  },
}
