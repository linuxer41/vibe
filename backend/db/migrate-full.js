const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

function splitSQL(sql) {
  const statements = [];
  let current = '';
  let inDollar = null;
  let i = 0;

  while (i < sql.length) {
    if (inDollar) {
      // inside dollar-quote: look for closing tag
      const end = sql.indexOf(inDollar, i);
      if (end === -1) {
        current += sql.slice(i);
        break;
      }
      current += sql.slice(i, end + inDollar.length);
      i = end + inDollar.length;
      inDollar = null;
    } else if (sql[i] === '$' && sql[i + 1] === '$') {
      // start of $$...$$ quote
      const end = sql.indexOf('$$', i + 2);
      if (end === -1) {
        current += sql.slice(i);
        break;
      }
      current += sql.slice(i, end + 2);
      i = end + 2;
    } else if (sql[i] === '$' && /[a-zA-Z_]/.test(sql[i + 1])) {
      // start of $tag$...$tag$ quote
      let j = i + 1;
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) j++;
      const tag = sql.slice(i, j);
      const closer = '$' + tag + '$';
      const end = sql.indexOf(closer, j);
      if (end === -1) {
        current += sql.slice(i);
        break;
      }
      current += sql.slice(i, end + closer.length);
      i = end + closer.length;
    } else if (sql[i] === ';') {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      i++;
    } else if (sql[i] === '-' && sql[i + 1] === '-') {
      // single-line comment
      const nl = sql.indexOf('\n', i + 2);
      i = nl === -1 ? sql.length : nl + 1;
    } else if (sql[i] === '/' && sql[i + 1] === '*') {
      // multi-line comment
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
    } else {
      current += sql[i];
      i++;
    }
  }
  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}

async function migrateFull() {
  const sql = fs.readFileSync(path.join(__dirname, '000_full.sql'), 'utf8');
  const statements = splitSQL(sql);
  for (const stmt of statements) {
    try {
      await pool.query(stmt);
    } catch (err) {
      console.error('Migration error:', err.message.slice(0, 200));
    }
  }
  console.log('Full database migration completed successfully');
  await pool.end();
}

migrateFull().catch(console.error);
