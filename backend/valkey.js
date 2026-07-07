const { decodeValkey, encodeValkey, FORMAT_JSON } = require('./format');
const logger = require('./lib/logger');

const VALKEY_URL = process.env.VALKEY_URL || 'redis://127.0.0.1:6379';

let pub = null;
let sub = null;
let connected = false;

function connect() {
  try {
    const Redis = require('ioredis');
    pub = new Redis(VALKEY_URL, { lazyConnect: true, retryStrategy: () => null });
    sub = new Redis(VALKEY_URL, { lazyConnect: true, retryStrategy: () => null });

    let pubDone = false, subDone = false;
    function checkBoth() {
      if (pubDone && subDone) {
        connected = true;
        logger.info({ component: 'valkey' }, 'Valkey connected');
      }
    }

    pub.on('error', (err) => {
      console.log(err)
      logger.warn({ component: 'valkey', err }, 'Valkey not available - pub disabled');
    });
    sub.on('error', (err) => {
      if (!connected) {
        logger.warn({ component: 'valkey', err }, 'Valkey not available - sub disabled');
      }
    });

    pub.connect().then(() => { pubDone = true; checkBoth(); }).catch(() => {});
    sub.connect().then(() => { subDone = true; checkBoth(); }).catch(() => {});
  } catch (e) {
    console.log(e)
    logger.warn({ err: e.message, component: 'valkey' }, 'Valkey not available - pub/sub disabled');
  }
}

function startSubscriber(io) {
  if (!sub) { connect(); }
  const channels = ['chat:messages', 'posts:new', 'posts:interactions', 'videos:new', 'lives:new', 'contacts:status'];

  sub.on('message', (channel, message) => {
    try {
      const buf = Buffer.from(message);
      const { target, event, data } = decodeValkey(buf);
      const ev = event || channel;
      if (target) {
        io.to(target).emit(ev, data);
      } else {
        io.emit(ev, data);
      }
    } catch (e) {
      // ignore decode errors
    }
  });

  const interval = setInterval(() => {
    if (!connected) {
      clearInterval(interval);
      return;
    }
    for (const ch of channels) {
      sub.subscribe(ch).catch(() => {});
    }
  }, 500);
}

async function publish(channel, target, event, data, format = FORMAT_JSON) {
  if (!connected || !pub) return;
  try {
    const buf = encodeValkey(channel, target, event, data, format);
    await pub.publish(channel, buf);
  } catch (e) {
    // ignore
  }
}

// Attempt initial connection
connect();

module.exports = { startSubscriber, publish };
