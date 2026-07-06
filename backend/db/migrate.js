const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function migrate() {
  const files = ['001_init.sql', '002_vibe_tables.sql', '003_webrtc.sql', '004_snowflake.sql', '005_live_comments.sql', '006_stars_gifts.sql', '007_recommendations.sql'];
  for (const file of files) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (err) {
        console.error(`Migration error in ${file}:`, err.message);
      }
    }
  }
  console.log('Database migrated successfully');
  await pool.end();
}

migrate().catch(console.error);
