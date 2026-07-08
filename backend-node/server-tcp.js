// Vibe Server — Raw TCP Transport (no WebSocket, no Socket.IO)
// Same binary frame protocol as WS server, same handlers
// Frame format: MAGIC(2) + type(2) + flags(2) + streamId(4) + length(4) + payload

const net = require('net')
require('dotenv').config()

const db = require('./db/init')
const kafka = require('./lib/kafka')
const logger = require('./lib/logger')
const tracer = require('./lib/tracer')
const ph = require('./protocol-handler')
const cm = require('./lib/connection-manager')

const { decodeFrame, createPongFrame, HEADER_SIZE, MAGIC } = require('./lib/frame')
const { Flags } = require('./lib/flags')
const { MessageType } = require('./lib/message-types')

const PORT = process.env.TCP_PORT || 4000

// ── Frame parser state ──
function createFrameParser(socket, onFrame) {
  let buffer = Buffer.alloc(0)

  function append(data) {
    buffer = Buffer.concat([buffer, data])
    parse()
  }

  function parse() {
    while (buffer.length >= HEADER_SIZE) {
      // Check magic
      if (buffer.readUInt16BE(0) !== MAGIC) {
        // Scan forward for magic byte
        const idx = buffer.indexOf(MAGIC & 0xFF)
        if (idx < 0 || idx + 1 >= buffer.length) { buffer = Buffer.alloc(0); return }
        const magic = buffer.readUInt16BE(idx)
        if (magic !== MAGIC) { buffer = buffer.slice(idx + 1); continue }
        buffer = buffer.slice(idx)
        if (buffer.length < HEADER_SIZE) return
      }

      const payloadLength = buffer.readUInt32BE(10)
      const frameSize = HEADER_SIZE + payloadLength

      if (buffer.length < frameSize) return

      const frameBuf = buffer.slice(0, frameSize)
      buffer = buffer.slice(frameSize)

      const frame = decodeFrame(frameBuf)
      if (frame) onFrame(frame)
    }
  }

  return { append }
}

// ── TCP Server ──
const server = net.createServer((socket) => {
  let user = null
  let userId = null
  let sessionId = null
  let authTimedOut = false

  const peer = `${socket.remoteAddress}:${socket.remotePort}`
  tracer.connConnect('tcp', 0, peer)

  socket.setKeepAlive(true, 30000)
  socket.setNoDelay(true)

  // Auth timeout — disconnect if no restore in 5s
  const authTimer = setTimeout(() => {
    if (!user) {
      authTimedOut = true
      logger.warn({ ip: socket.remoteAddress }, 'TCP auth timeout')
      socket.destroy()
    }
  }, 5000)

  const parser = createFrameParser(socket, async (frame) => {
    try {
      tracer.msgReceived('tcp', userId || 0, frame.type, HEADER_SIZE + frame.payloadLength)
      if (frame.type === MessageType.Ping) {
        socket.write(createPongFrame())
        return
      }

      if (!user) {
        if (frame.type === MessageType.AuthRestore) {
          await handleAuthRestore(socket, frame)
          return
        }
        return
      }

      ph.handle(socket, user, frame)
    } catch (e) {
      logger.error({ err: e.message }, 'TCP frame error')
    }
  })

  socket.on('data', (data) => {
    if (!authTimedOut) parser.append(data)
  })

  // ── Auth handlers ──
  async function handleAuthRestore(socket, frame) {
    const restoreHandler = ph.getHandler(MessageType.AuthRestore)
    if (!restoreHandler) return

    const origWrite = socket.write.bind(socket)
    let firstSend = true
    socket.write = (data) => {
      if (firstSend) {
        firstSend = false
        try {
          const respFrame = decodeFrame(data)
          if (respFrame && (respFrame.flags & Flags.RESPONSE)) {
            const text = new TextDecoder().decode(respFrame.payload)
            const resp = JSON.parse(text)
            if (resp.ok && resp.user) {
              clearTimeout(authTimer)
              user = resp.user
              userId = resp.user.id
              tracer.authEvent('tcp', userId, peer, true)
              sessionId = cm.addConnection(userId, (buf) => socket.write(buf), 'tcp')
              db.setOnline(userId).catch(() => {})
              db.updateLastSeen(userId).catch(() => {})
              kafka.produce('user-presence', String(userId), { userId, online: true })
              logger.info({ userId, action: 'auth_restore' }, 'Sesión restaurada via TCP')
            }
          }
        } catch {}
        socket.write = origWrite
      }
      origWrite(data)
    }
    restoreHandler(socket, null, frame)
  }

  socket.on('close', () => {
    clearTimeout(authTimer)
    tracer.connDisconnect('tcp', userId || 0, peer)
    if (sessionId) cm.removeConnection(userId, sessionId)
    if (userId) {
      db.setOffline(userId).catch(() => {})
      kafka.produce('user-presence', String(userId), { userId, online: false })
    }
  })

  socket.on('error', () => {})
})

server.listen(PORT, () => {
  logger.info({ port: PORT, action: 'startup' }, 'Servidor Vibe TCP iniciado')
})

module.exports = server
