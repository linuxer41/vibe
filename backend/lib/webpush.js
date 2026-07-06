const webpush = require('web-push');
const logger = require('./logger');

let vapidReady = false;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:vibe@app.local';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidReady = true;
    logger.info({ action: 'vapid_init' }, 'VAPID push notifications initialized');
  } catch (e) {
    logger.warn({ err: e.message, action: 'vapid_init' }, 'VAPID init failed, push disabled');
  }
} else {
  logger.info({ action: 'vapid_init' }, 'VAPID keys not set, push notifications disabled');
}

const subscriptions = new Map();

function addSubscription(userId, sub) {
  const list = subscriptions.get(userId) || [];
  list.push(sub);
  subscriptions.set(userId, list);
}

function removeSubscription(userId, endpoint) {
  const list = (subscriptions.get(userId) || []).filter((s) => s.endpoint !== endpoint);
  if (list.length) subscriptions.set(userId, list);
  else subscriptions.delete(userId);
}

async function sendPush(userId, payload) {
  if (!vapidReady) return;
  const list = subscriptions.get(userId) || [];
  for (const sub of list) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        removeSubscription(userId, sub.endpoint);
      }
      logger.warn({ userId, err: err.message, action: 'push_send' }, 'Error enviando push');
    }
  }
}

module.exports = { addSubscription, removeSubscription, sendPush, VAPID_PUBLIC_KEY: VAPID_PUBLIC_KEY || '' };
