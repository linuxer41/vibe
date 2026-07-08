// Centralized event tracer — single place for all debug logs
const { decode } = require('@msgpack/msgpack')
const logger = require('./logger')

const INBOUND = '\u2190'
const OUTBOUND = '\u2192'

function kafkaProduce(topic, key, value) {
  const summary = summarize(value)
  logger.info({ target: 'kafka', topic, key, summary }, `KAFKA ${OUTBOUND} ${topic} key=${key} ${summary}`)
}

function kafkaConsume(topic, key, value) {
  const keyStr = key == null ? '' : String(key)
  const summary = summarize(value)
  logger.info({ target: 'kafka', topic, key: keyStr, summary }, `KAFKA ${INBOUND} ${topic} key=${keyStr} ${summary}`)
}

function connConnect(transport, userId, peer) {
  logger.info({ target: 'conn', transport, userId, peer }, `${transport.toUpperCase()} ${INBOUND} user=${userId} from ${peer}`)
}

function connDisconnect(transport, userId, peer) {
  logger.info({ target: 'conn', transport, userId, peer }, `${transport.toUpperCase()} ${OUTBOUND} user=${userId} disconnected from ${peer}`)
}

function msgReceived(transport, userId, msgType, size) {
  logger.info({ target: 'msg', transport, userId, msgType, size }, `${transport.toUpperCase()} ${INBOUND} user=${userId} type=${msgType} size=${size}`)
}

function msgSent(transport, userId, msgType, size) {
  logger.info({ target: 'msg', transport, userId, msgType, size }, `${transport.toUpperCase()} ${OUTBOUND} user=${userId} type=${msgType} size=${size}`)
}

function authEvent(transport, userId, peer, success) {
  if (success) {
    logger.info({ target: 'auth', transport, userId, peer }, `AUTH OK ${userId} ${peer} via ${transport}`)
  } else {
    logger.warn({ target: 'auth', transport, peer }, `AUTH FAIL from ${peer} via ${transport}`)
  }
}

function summarize(value) {
  if (!value) return '(empty)'
  try {
    const buf = Buffer.isBuffer(value) ? value : Buffer.from(value)
    const obj = decode(buf)
    if (typeof obj === 'object' && obj !== null) {
      const parts = []
      for (const key of ['chatId', 'userId', 'senderId', 'messageId', 'type', 'online']) {
        if (obj[key] !== undefined) parts.push(`${key}:${obj[key]}`)
      }
      if (parts.length === 0) {
        return '{' + Object.keys(obj).slice(0, 4).join(' ') + '}'
      }
      return '{' + parts.join(' ') + '}'
    }
    return String(obj)
  } catch {
    const len = Buffer.isBuffer(value) ? value.length : (value ? value.length || 0 : 0)
    return `raw[${len}b]`
  }
}

module.exports = { kafkaProduce, kafkaConsume, connConnect, connDisconnect, msgReceived, msgSent, authEvent }
