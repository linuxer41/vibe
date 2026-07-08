const { Pool, types } = require('pg');
require('dotenv').config();
const logger = require('../lib/logger');

types.setTypeParser(20, (val) => parseInt(val, 10));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://linuxer:12345678@localhost:5432/vibe',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  maxUses: 7500,
});

pool.on('error', (err) => {
  logger.fatal({ err, component: 'db' }, 'Error inesperado en pool de DB');
  process.exit(-1);
});

async function healthcheck() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch {
    return false;
  }
}

async function retryQuery(queryFn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await queryFn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      logger.warn({ err: err.message, attempt: i + 1, action: 'retry' }, 'Reintentando query');
      await new Promise((r) => setTimeout(r, 100 * Math.pow(2, i)));
    }
  }
}

// Keep DB connection alive — ping every 30s
setInterval(() => { healthcheck().catch(() => {}); }, 30000);

module.exports = { pool, healthcheck, retryQuery };
