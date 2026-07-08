// Centralized message dispatch — every inbound frame goes through here
// Single point for debugging, logging, metrics, and routing

const logger = require('./lib/logger')
const db = require('./db/init')
const { MessageType } = require('./lib/message-types')

const handlers = new Map()

function register(type, handler) {
  if (handlers.has(type)) {
    const existing = handlers.get(type)
    handlers.set(type, Array.isArray(existing) ? [...existing, handler] : [existing, handler])
  } else {
    handlers.set(type, handler)
  }
}

function handle(ws, user, frame) {
  const type = frame.type
  const h = handlers.get(type)
  if (!h) {
    logger.warn({ type: type.toString(16), userId: user?.id }, 'No handler for message type')
    return
  }
  if (Array.isArray(h)) {
    for (const handler of h) {
      try { handler(ws, user, frame) } catch (e) { logger.error({ err: e.message, type, userId: user?.id }, 'Handler error') }
    }
  } else {
    try { h(ws, user, frame) } catch (e) { logger.error({ err: e.message, type, userId: user?.id }, 'Handler error') }
  }
}

function getHandler(type) {
  const h = handlers.get(type)
  return Array.isArray(h) ? h[0] : h
}

module.exports = { register, handle, getHandler }
