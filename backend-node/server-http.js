// Vibe HTTP Auth Server — port 2000
// Handles send-code, verify-code, restore-session via regular JSON
// After auth, clients connect via WS/TCP with the returned token

require('dotenv').config()
const express = require('express')
const cors = require('cors')
const db = require('./db/init')
const kafka = require('./lib/kafka')
const logger = require('./lib/logger')

const PORT = process.env.HTTP_PORT || 2000

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

// POST /auth/send-code
app.post('/auth/send-code', async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone || phone.length < 10) {
      return res.status(400).json({ ok: false, error: 'Teléfono inválido' })
    }
    const code = await db.sendCode(phone)
    logger.info({ phone, action: 'send_code' }, 'Código SMS enviado')
    res.json({ ok: true, code })
  } catch (e) {
    logger.error({ err: e.message, phone: req.body.phone, action: 'send_code' }, 'Error')
    res.status(500).json({ ok: false, error: e.message })
  }
})

// POST /auth/verify-code
app.post('/auth/verify-code', async (req, res) => {
  try {
    const { phone, code, username, displayName, countryCode } = req.body
    const valid = await db.verifyCode(phone, code)
    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Código incorrecto' })
    }
    const result = await db.findOrCreateUser(phone, username || '', displayName || phone, countryCode || '')
    const token = await db.createSession(result.user.id, '')
    logger.info({ userId: result.user.id, phone, isNew: result.isNew, action: 'verify_code' }, 'Usuario verificado')
    res.json({
      ok: true,
      token,
      userId: result.user.id,
      displayName: result.user.display_name,
      avatar: result.user.avatar,
      isNew: result.isNew,
    })
  } catch (e) {
    logger.error({ err: e.message, phone: req.body.phone, action: 'verify_code' }, 'Error')
    res.status(500).json({ ok: false, error: e.message })
  }
})

// POST /auth/restore
app.post('/auth/restore', async (req, res) => {
  try {
    const { token } = req.body
    if (!token) return res.status(400).json({ ok: false, error: 'Token requerido' })
    const user = await db.getSession(token)
    if (!user) return res.status(401).json({ ok: false, error: 'Sesión inválida' })
    logger.info({ userId: user.id, action: 'restore_session' }, 'Sesión restaurada via HTTP')
    res.json({ ok: true, user })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// Health check
app.get('/health', (req, res) => { res.json({ ok: true, server: 'http-auth', port: PORT }) })

app.listen(PORT, () => {
  logger.info({ port: PORT, action: 'startup' }, 'Servidor HTTP Auth iniciado')
})
