// Valkey (Redis) — TCP socket gateway state only
// Pub/sub replaced by Kafka (see lib/kafka.js)
// Store: session tokens, connection registry, rate limiter

const logger = require('./lib/logger')

const VALKEY_URL = process.env.VALKEY_URL || 'redis://127.0.0.1:6379'

let client = null

function connect() {
  try {
    const Redis = require('ioredis')
    client = new Redis(VALKEY_URL, { lazyConnect: true, retryStrategy: () => null })
    client.on('error', (err) => {
      logger.warn({ component: 'valkey', err: err.message }, 'Valkey connection error')
    })
    client.connect().then(() => {
      logger.info({ component: 'valkey' }, 'Valkey (gateway) connected')
    }).catch(() => {
      logger.warn({ component: 'valkey' }, 'Valkey not available — gateway state disabled')
    })
  } catch (e) {
    logger.warn({ err: e.message, component: 'valkey' }, 'Valkey not available')
  }
}

async function setex(key, ttl, value) {
  if (!client) return
  try { await client.setex(key, ttl, typeof value === 'string' ? value : JSON.stringify(value)) } catch {}
}

async function get(key) {
  if (!client) return null
  try { return await client.get(key) } catch { return null }
}

async function del(key) {
  if (!client) return
  try { await client.del(key) } catch {}
}

connect()

module.exports = { setex, get, del }
