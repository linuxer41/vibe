require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function resetDb() {
  const dbUrl = process.env.DATABASE_URL || 'postgres://linuxer:12345678@vibe-app.iathings.com:6432/vibe';
  const adminUrl = dbUrl.replace(/\/[^/]+$/, '/postgres');
  const dbName = dbUrl.split('/').pop();

  // Connect to postgres admin DB to drop/create target database
  const adminPool = new Pool({ connectionString: adminUrl, max: 1 });

  console.log(`Resetting database: ${dbName}`);
  // Kill all connections to the database
  await adminPool.query(`
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = $1 AND pid <> pg_backend_pid()
  `, [dbName]);
  await adminPool.query(`DROP DATABASE IF EXISTS ${dbName}`);
  console.log('Database dropped');
  await adminPool.query(`CREATE DATABASE ${dbName}`);
  console.log('Database created');
  await adminPool.end();

  // Connect to the fresh database
  const pool = new Pool({ connectionString: dbUrl, max: 1 });

  // Run 000_full.sql (all tables, functions, indexes)
  const fullSql = fs.readFileSync(path.join(__dirname, '000_full.sql'), 'utf8');
  console.log('Running 000_full.sql...');
  await pool.query(fullSql);
  console.log('000_full.sql done');

  await pool.end();
  console.log('Database reset complete');
}

resetDb().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
