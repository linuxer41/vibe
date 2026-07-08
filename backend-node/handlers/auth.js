const db = require('../db/init')
const logger = require('../lib/logger')
const codec = require('../lib/protocol-codec')
const { MessageType } = require('../lib/message-types')
const { encodeFrame } = require('../lib/frame')
const { Flags } = require('../lib/flags')

function register(registerHandler) {
  registerHandler(MessageType.AuthSendCode, handleSendCode)
  registerHandler(MessageType.AuthVerifyCode, handleVerifyCode)
  registerHandler(MessageType.AuthRestore, handleRestore)
}

function sendResponse(ws, streamId, type, payload) {
  ws.send(encodeFrame(type, Flags.RESPONSE, streamId, payload))
}

async function handleSendCode(ws, user, frame) {
  const data = codec.auth.sendCodeRequest(frame.payload)
  if (!data || !data.phone || data.phone.length < 10) {
    sendResponse(ws, frame.streamId, MessageType.AuthSendCodeResp, codec.auth.sendCodeResponse(false, '', 'Teléfono inválido'))
    return
  }
  try {
    const code = await db.sendCode(data.phone)
    logger.info({ phone: data.phone, action: 'send_code' }, 'Código SMS enviado')
    sendResponse(ws, frame.streamId, MessageType.AuthSendCodeResp, codec.auth.sendCodeResponse(true, code, ''))
  } catch (e) {
    logger.error({ err: e.message, phone: data.phone, action: 'send_code' }, 'Error')
    sendResponse(ws, frame.streamId, MessageType.AuthSendCodeResp, codec.auth.sendCodeResponse(false, '', e.message))
  }
}

async function handleVerifyCode(ws, user, frame) {
  const data = codec.auth.verifyCodeRequest(frame.payload)
  try {
    const valid = await db.verifyCode(data.phone, data.code)
    if (!valid) {
      sendResponse(ws, frame.streamId, MessageType.AuthVerifyCodeResp, codec.auth.verifyCodeResponse(false, '', 0, '', '', false, 'Código incorrecto'))
      return
    }
    const result = await db.findOrCreateUser(data.phone, data.username, data.displayName, data.countryCode || '')
    const token = await db.createSession(result.user.id, '')
    logger.info({ userId: result.user.id, phone: data.phone, isNew: result.isNew, action: 'verify_code' }, 'Usuario verificado')
    sendResponse(ws, frame.streamId, MessageType.AuthVerifyCodeResp,
      codec.auth.verifyCodeResponse(true, token, result.user.id, result.user.display_name, result.user.avatar, result.isNew, ''))
  } catch (e) {
    logger.error({ err: e.message, phone: data.phone, action: 'verify_code' }, 'Error')
    sendResponse(ws, frame.streamId, MessageType.AuthVerifyCodeResp, codec.auth.verifyCodeResponse(false, '', 0, '', '', false, e.message))
  }
}

async function handleRestore(ws, user, frame) {
  const data = codec.auth.restoreRequest(frame.payload)
  try {
    const u = await db.getSession(data.token)
    if (!u) {
      sendResponse(ws, frame.streamId, MessageType.AuthRestoreResp, Buffer.from(JSON.stringify({ ok: false })))
      return
    }
    logger.info({ userId: u.id, action: 'restore_session' }, 'Sesión restaurada')
    sendResponse(ws, frame.streamId, MessageType.AuthRestoreResp, Buffer.from(JSON.stringify({ ok: true, user: u })))
  } catch (e) {
    sendResponse(ws, frame.streamId, MessageType.AuthRestoreResp, Buffer.from(JSON.stringify({ ok: false })))
  }
}

module.exports = { register }
