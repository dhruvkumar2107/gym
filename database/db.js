const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'zacson.db');
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTION_TARGET);
let db = null;

async function initDatabase() {
  let SQL;
  try {
    const wasmPath = path.join(__dirname, '..', 'sql-wasm.wasm');
    if (fs.existsSync(wasmPath)) {
      const wasmBinary = fs.readFileSync(wasmPath);
      SQL = await initSqlJs({ wasmBinary });
    } else {
      SQL = await initSqlJs();
    }
  } catch (e) {
    console.error('sql.js init error:', e.message);
    SQL = await initSqlJs();
  }

  if (!isServerless && fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function saveDatabase() {
  if (!db || isServerless) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {}
}

function run(sql, params = []) {
  const database = getDb();
  try {
    database.run(sql, params);
    if (!isServerless) saveDatabase();
  } catch (err) {
    console.error('DB Run Error:', err.message, sql.substring(0, 100));
  }
}

function get(sql, params = []) {
  const database = getDb();
  const stmt = database.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) { row = stmt.getAsObject(); }
  stmt.free();
  return row;
}

function all(sql, params = []) {
  const database = getDb();
  const stmt = database.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) { rows.push(stmt.getAsObject()); }
  stmt.free();
  return rows;
}

function exec(sql) {
  const database = getDb();
  database.exec(sql);
  if (!isServerless) saveDatabase();
}

module.exports = { initDatabase, getDb, saveDatabase, run, get, all, exec };
