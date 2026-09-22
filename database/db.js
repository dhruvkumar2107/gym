const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { Worker, MessageChannel, receiveMessageOnPort } = require('worker_threads');

const LOCAL_DB_PATH = path.join(__dirname, 'zacson.db');
const TMP_DB_PATH = '/tmp/zacson.db';
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTION_TARGET);
const isTurso = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
const DB_PATH = isServerless ? TMP_DB_PATH : LOCAL_DB_PATH;

let db = null;
let tursoWorker = null;
let tursoPort = null;
const tursoSignal = new Int32Array(new SharedArrayBuffer(4));
let tursoSeq = 1;
const tursoPending = new Map();

const TURSO_WORKER_SRC = `
const { workerData } = require('worker_threads');
const { createClient } = require(workerData.clientPath);
const client = createClient({ url: workerData.url, authToken: workerData.authToken });
const ready = client.execute('PRAGMA foreign_keys = ON').catch(() => {});
const signal = new Int32Array(workerData.sab);
const port = workerData.port;
let gen = 0;
port.on('message', async (msg) => {
  try {
    await ready;
    let result;
    if (msg.command === 'execute') {
      const r = await client.execute(msg.sql, msg.params || []);
      result = { ok: true, payload: Object.assign(serializeRowset(r), { lastInsertRowid: r.lastInsertRowid, rowsAffected: r.rowsAffected }) };
    } else if (msg.command === 'executeMultiple') {
      const r = await client.executeMultiple(msg.sql);
      result = { ok: true, payload: (r || []).map(serializeRowset) };
    } else if (msg.command === 'close') {
      client.close();
      process.exit(0);
    }
    port.postMessage({ id: msg.id, ...result });
  } catch (e) {
    port.postMessage({ id: msg.id, ok: false, error: String((e && e.message) || e) });
  }
  gen++;
  Atomics.store(signal, 0, gen);
  Atomics.notify(signal, 0);
});
function serializeRowset(r) {
  if (!r || !Array.isArray(r.columns) || !Array.isArray(r.rows)) return { columns: [], rows: [] };
  return {
    columns: r.columns,
    rows: r.rows.map(row => {
      const map = {};
      r.columns.forEach((c, i) => {
        let v = row[i];
        if (typeof v === 'bigint') v = Number(v);
        if (v instanceof Uint8Array) v = Buffer.from(v).toString('utf8');
        if (v && typeof v === 'object' && typeof v.toString === 'function') {
          try { v = v.toString(); } catch (e) {}
        }
        map[c] = v;
      });
      return map;
    })
  };
}
`;

function ensureTursoWorker() {
  if (tursoWorker) return;
  const { port1, port2 } = new MessageChannel();
  tursoPort = port2;
  tursoWorker = new Worker(TURSO_WORKER_SRC, {
    eval: true,
    workerData: {
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
      sab: tursoSignal.buffer,
      clientPath: require.resolve('@libsql/client'),
      port: port1
    },
    transferList: [port1]
  });
  tursoWorker.unref();
  tursoWorker.on('error', (e) => console.error('Turso worker error:', e.message));
}

function tursoCall(sql, params) {
  ensureTursoWorker();
  const id = tursoSeq++;
  const rec = { value: undefined, done: false, error: null };
  tursoPending.set(id, rec);
  tursoPort.postMessage({ id, command: 'execute', sql, params: params || [] });
  let lastGen = tursoSignal[0];
  let spins = 0;
  while (!rec.done) {
    const current = tursoSignal[0];
    if (current !== lastGen) {
      lastGen = current;
      let msg;
      while ((msg = receiveMessageOnPort(tursoPort)) !== undefined) {
        const m = msg.message;
        if (!tursoPending.has(m.id)) continue;
        const p = tursoPending.get(m.id);
        tursoPending.delete(m.id);
        if (m.ok) p.value = m.payload;
        else p.error = m.error;
        p.done = true;
      }
    }
    if (!rec.done) {
      Atomics.wait(tursoSignal, 0, lastGen, 2000);
      spins++;
      if (spins > 600) {
        tursoPending.delete(id);
        rec.error = 'TURSO_TIMEOUT';
        rec.done = true;
      }
    }
  }
  if (rec.error) throw new Error(String(rec.error));
  return rec.value;
}

function tursoExec(sql) {
  ensureTursoWorker();
  const id = tursoSeq++;
  const rec = { value: undefined, done: false, error: null };
  tursoPending.set(id, rec);
  tursoPort.postMessage({ id, command: 'executeMultiple', sql, params: [] });
  let lastGen = tursoSignal[0];
  let spins = 0;
  while (!rec.done) {
    const current = tursoSignal[0];
    if (current !== lastGen) {
      lastGen = current;
      let msg;
      while ((msg = receiveMessageOnPort(tursoPort)) !== undefined) {
        const m = msg.message;
        if (!tursoPending.has(m.id)) continue;
        const p = tursoPending.get(m.id);
        tursoPending.delete(m.id);
        if (m.ok) p.value = m.payload;
        else p.error = m.error;
        p.done = true;
      }
    }
    if (!rec.done) {
      Atomics.wait(tursoSignal, 0, lastGen, 2000);
      spins++;
      if (spins > 600) {
        tursoPending.delete(id);
        rec.error = 'TURSO_TIMEOUT';
        rec.done = true;
      }
    }
  }
  if (rec.error) throw new Error(String(rec.error));
  return rec.value;
}

function serializeRows(payload) {
  const rows = (payload && payload.rows) ? payload.rows : [];
  return rows.map(r => {
    const row = {};
    payload.columns.forEach((c, i) => {
      let v = r[c];
      if (typeof v === 'bigint') v = Number(v);
      if (v && typeof v === 'object' && typeof v.toString === 'function') v = v.toString();
      row[c] = v;
    });
    return row;
  });
}

async function initDatabase() {
  if (isTurso) {
    ensureTursoWorker();
    return { driver: 'turso' };
  }
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
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA foreign_keys = ON');
  return { driver: 'sqljs' };
}

function getDb() {
  if (isTurso) return null;
  if (!db) throw new Error('Database not initialized');
  return db;
}

function saveDatabase() {
  if (isTurso) return;
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {}
}

function run(sql, params = []) {
  if (isTurso) {
    try {
      const payload = tursoCall(sql, params);
      return {
        lastID: payload && payload.lastInsertRowid !== undefined ? Number(payload.lastInsertRowid) : 0,
        changes: payload ? payload.rowsAffected || 0 : 0
      };
    } catch (err) {
      console.error('DB Run Error:', err.message, String(sql).substring(0, 100));
      return { lastID: 0, changes: 0 };
    }
  }
  const database = getDb();
  try {
    database.run(sql, params);
    let lastID = 0;
    let changes = 0;
    try {
      const meta = database.exec('SELECT last_insert_rowid() AS lid, changes() AS ch')[0];
      if (meta) {
        lastID = meta.values[0][0] ? parseInt(meta.values[0][0], 10) : 0;
        changes = meta.values[0][1] ? parseInt(meta.values[0][1], 10) : 0;
      }
    } catch (e) {}
    saveDatabase();
    return { lastID, changes };
  } catch (err) {
    console.error('DB Run Error:', err.message, String(sql).substring(0, 100));
    return { lastID: 0, changes: 0 };
  }
}

function get(sql, params = []) {
  if (isTurso) {
    try {
      const payload = tursoCall(sql, params);
      const rows = serializeRows(payload);
      return rows.length ? rows[0] : null;
    } catch (err) {
      console.error('DB Get Error:', err.message, String(sql).substring(0, 100));
      return null;
    }
  }
  const database = getDb();
  const stmt = database.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();
  return row;
}

function all(sql, params = []) {
  if (isTurso) {
    try {
      const payload = tursoCall(sql, params);
      return serializeRows(payload);
    } catch (err) {
      console.error('DB All Error:', err.message, String(sql).substring(0, 100));
      return [];
    }
  }
  const database = getDb();
  const stmt = database.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function exec(sql) {
  if (isTurso) {
    try {
      tursoExec(sql);
      return { ok: true };
    } catch (err) {
      console.error('DB Exec Error:', err.message, String(sql).substring(0, 100));
      return { ok: false };
    }
  }
  const database = getDb();
  database.exec(sql);
  saveDatabase();
  return { ok: true };
}

function close() {
  if (isTurso) {
    if (tursoWorker) {
      try { tursoPort.postMessage({ id: 'close', command: 'close' }); } catch (e) {}
      tursoWorker = null;
      tursoPort = null;
    }
    return;
  }
  if (db) {
    try { db.close(); } catch (e) {}
    db = null;
  }
}

module.exports = { initDatabase, saveDatabase, run, get, all, exec, close };