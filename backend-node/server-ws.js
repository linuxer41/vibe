// Vibe Server — Native WebSocket (no Socket.IO)
// Binary Frame protocol + FlatBuffers payloads
// Single centralized message dispatch

const http = require('http')
const { WebSocketServer } = require('ws')
const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
require('dotenv').config()

const db = require('./db/init')
const kafka = require('./lib/kafka')
const logger = require('./lib/logger')
const tracer = require('./lib/tracer')
const ph = require('./protocol-handler')
const cm = require('./lib/connection-manager')

const { decodeFrame, createPongFrame } = require('./lib/frame')
const { Flags } = require('./lib/flags')
const { MessageType } = require('./lib/message-types')

const PORT = process.env.WS_PORT || 3000
const TEMP_DIR = path.resolve(__dirname, 'tmp_upload')
const CHUNK_DIR = path.resolve(__dirname, 'tmp_chunks')
;[TEMP_DIR, CHUNK_DIR].forEach(d => { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }) })

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))
const server = http.createServer(app)
const wss = new WebSocketServer({ server, maxPayload: 100 * 1024 * 1024 })

// ── WebSocket connection ──
wss.on('connection', async (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const token = url.searchParams.get('token')
  let user = null

  if (token) {
    try { user = await db.getSession(token) } catch {}
  }

  if (!user) {
    tracer.authEvent('ws', 0, req.socket.remoteAddress, false)
    logger.warn({ ip: req.socket.remoteAddress }, 'WS conexión rechazada — sin token')
    ws.close(4001, 'Autenticación requerida')
    return
  }
  tracer.authEvent('ws', user.id, req.socket.remoteAddress, true)

  ws.__auth = user
  ws.__userId = user.id
  let wsSessionId = null

  ws.on('message', async (raw) => {
    try {
      const frame = decodeFrame(raw)
      if (!frame) return
      tracer.msgReceived('ws', user.id, frame.type, raw.length)
      if (frame.type === MessageType.Ping) { ws.send(createPongFrame()); return }
      ph.handle(ws, ws.__auth, frame)
    } catch (e) {
      logger.error({ err: e.message }, 'Frame error')
    }
  })

  tracer.connConnect('ws', user.id, req.socket.remoteAddress)

  ws.on('close', () => {
    tracer.connDisconnect('ws', ws.__userId, req.socket.remoteAddress)
    if (wsSessionId) cm.removeConnection(ws.__userId, wsSessionId)
    db.setOffline(ws.__userId).catch(() => {})
    kafka.produce('user-presence', String(ws.__userId), { userId: ws.__userId, online: false })
  })

  wsSessionId = cm.addConnection(user.id, (buf) => ws.send(buf), 'ws')
  db.setOnline(user.id).catch(() => {})
  db.updateLastSeen(user.id).catch(() => {})
  kafka.produce('user-presence', String(user.id), { userId: user.id, online: true })
  logger.info({ userId: user.id, displayName: user.display_name, action: 'connect' }, 'Conectado')
})

// Valkey subscriber is started by connection-manager (shared with TCP server)
// See lib/connection-manager.js: startValkeySubscriber()

// ── Start ──
server.listen(PORT, () => {
  logger.info({ port: PORT, action: 'startup' }, 'Servidor Vibe WS iniciado')
})
