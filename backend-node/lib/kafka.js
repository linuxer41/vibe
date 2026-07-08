// Kafka — message/event bus replacing Valkey pub/sub
// Redis stays only for TCP socket gateway state

process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1'

const { Kafka, logLevel } = require('kafkajs')
const { encode } = require('@msgpack/msgpack')
const logger = require('./logger')
const tracer = require('./tracer')

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092'
const CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'vibe-server'

const kafka = new Kafka({
  clientId: CLIENT_ID,
  brokers: [KAFKA_BROKER],
  logLevel: logLevel.WARN,
  retry: { initialRetryTime: 100, retries: 5 }
})

let producer = null
let producerReady = false

const REQUIRED_TOPICS = ['chat-messages', 'chat-new', 'chat-events', 'user-presence']

async function ensureTopics() {
  try {
    const admin = kafka.admin()
    await admin.connect()
    const existing = await admin.listTopics()
    const missing = REQUIRED_TOPICS.filter(t => !existing.includes(t))
    if (missing.length > 0) {
      await admin.createTopics({
        topics: missing.map(t => ({ topic: t, numPartitions: 3, replicationFactor: 1 })),
        waitForLeaders: true,
      })
      logger.info({ topics: missing.join(',') }, 'Kafka topics created')
    } else {
      logger.info('Kafka topics already exist')
    }
    await admin.disconnect()
  } catch (e) {
    logger.warn({ err: e.message }, 'Kafka ensureTopics failed — topics may not exist')
  }
}

async function connectProducer() {
  if (producerReady) return
  try {
    producer = kafka.producer({ allowAutoTopicCreation: true })
    await producer.connect()
    producerReady = true
    logger.info({ broker: KAFKA_BROKER }, 'Kafka producer connected')
  } catch (e) {
    logger.warn({ err: e.message, broker: KAFKA_BROKER }, 'Kafka producer failed — events disabled')
  }
}

async function produce(topic, key, value) {
  if (!producerReady) return
  const message = Buffer.from(encode(value))
  tracer.kafkaProduce(topic, String(key), message)
  try {
    await producer.send({ topic, messages: [{ key: String(key), value: message }] })
  } catch (e) {
    logger.warn({ err: e.message, topic }, 'Kafka produce failed')
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// topicHandlers: { 'topic-name': async (key, value) => {} }
async function startConsumer(groupId, topicHandlers) {
  await ensureTopics()
  // Wait a moment for controller to elect group coordinator
  await sleep(3000)

  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const consumer = kafka.consumer({
        groupId,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        retry: { initialRetryTime: 30000, retries: 2, maxRetryTime: 60000 },
        maxWaitTimeInMs: 5000,
        metadataMaxAge: 10000,
      })
      await consumer.connect()

      const topics = Object.keys(topicHandlers)
      await consumer.subscribe({ topics, fromBeginning: false })

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const handler = topicHandlers[topic]
          if (!handler) return
          try {
            const key = message.key ? message.key.toString() : null
            const value = message.value ? message.value : null
            tracer.kafkaConsume(topic, key, value)
            await handler(key, value)
          } catch (e) {
            logger.warn({ err: e.message, topic }, 'Kafka consumer handler error')
          }
        }
      })

      logger.info({ groupId, topics: topics.join(',') }, 'Kafka consumer started')
      return consumer
    } catch (e) {
      if (attempt < maxAttempts) {
        logger.warn({ err: e.message, groupId, attempt }, 'Kafka consumer attempt failed, retrying...')
        await sleep(5000 * attempt)
      } else {
        logger.warn({ err: e.message, groupId }, 'Kafka consumer failed — multi-instance events disabled')
      }
    }
  }
  return null
}

module.exports = { connectProducer, produce, startConsumer, ensureTopics }
