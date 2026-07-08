// Kafka — message/event bus replacing Valkey pub/sub
// Redis stays only for TCP socket gateway state

process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1'

const { Kafka, logLevel } = require('kafkajs')
const logger = require('./logger')

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
  try {
    const message = typeof value === 'string' ? value : JSON.stringify(value)
    await producer.send({ topic, messages: [{ key: String(key), value: message }] })
  } catch (e) {
    logger.warn({ err: e.message, topic }, 'Kafka produce failed')
  }
}

// topicHandlers: { 'topic-name': async (key, value) => {} }
async function startConsumer(groupId, topicHandlers) {
  try {
    const consumer = kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      retry: { initialRetryTime: 30000, retries: 0 },
      maxWaitTimeInMs: 5000,
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
          const value = message.value ? message.value.toString() : null
          await handler(key, value)
        } catch (e) {
          logger.warn({ err: e.message, topic }, 'Kafka consumer handler error')
        }
      }
    })

    logger.info({ groupId, topics: topics.join(',') }, 'Kafka consumer started')
    return consumer
  } catch (e) {
    logger.warn({ err: e.message, groupId }, 'Kafka consumer failed — multi-instance events disabled')
    return null
  }
}

module.exports = { connectProducer, produce, startConsumer }
