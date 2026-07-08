const { MessageType } = require('./message-types')
const { Flags } = require('./flags')

const HEADER_SIZE = 14
const MAGIC = 0xEB01

function toArrayBuffer(buf) {
  if (buf instanceof ArrayBuffer) return buf
  if (Buffer.isBuffer(buf) || buf instanceof Uint8Array) {
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  }
  return buf
}

function encodeFrame(type, flags, streamId, payload) {
  const payloadLen = payload ? payload.byteLength || payload.length : 0
  const buf = Buffer.alloc(HEADER_SIZE + payloadLen)

  buf.writeUInt16BE(MAGIC, 0)
  buf.writeUInt16BE(type, 2)
  buf.writeUInt16BE(flags, 4)
  buf.writeUInt32BE(streamId, 6)
  buf.writeUInt32BE(payloadLen, 10)

  if (payload) {
    const src = Buffer.isBuffer(payload) ? payload : Buffer.from(payload)
    src.copy(buf, HEADER_SIZE)
  }

  return buf
}

function encodeResponse(frame, payload) {
  return encodeFrame(frame.type, Flags.RESPONSE, frame.streamId, payload)
}

function encodeError(frame, errorMsg) {
  const errBuf = Buffer.from(errorMsg, 'utf-8')
  return encodeFrame(frame.type, Flags.RESPONSE | Flags.ERROR, frame.streamId, errBuf)
}

function decodeFrame(buffer) {
  if (buffer.byteLength < HEADER_SIZE) return null
  const ab = toArrayBuffer(buffer)
  const view = new DataView(ab)

  const magic = view.getUint16(0, false)
  if (magic !== MAGIC) return null

  const payloadLength = view.getUint32(10, false)
  const payload = ab.byteLength > HEADER_SIZE
    ? ab.slice(HEADER_SIZE)
    : new ArrayBuffer(0)

  return {
    magic,
    type: view.getUint16(2, false),
    flags: view.getUint16(4, false),
    streamId: view.getUint32(6, false),
    payloadLength,
    payload,
  }
}

function createPingFrame() {
  return encodeFrame(MessageType.Ping, Flags.NONE, 0)
}

function createPongFrame() {
  return encodeFrame(MessageType.Pong, Flags.NONE, 0)
}

module.exports = { HEADER_SIZE, MAGIC, encodeFrame, encodeResponse, encodeError, decodeFrame, createPingFrame, createPongFrame }
