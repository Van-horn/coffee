import Database from 'better-sqlite3';
import { chmodSync, closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { LeadStore, StoredLead } from '@/lib/store';

const RATE_WINDOW_MS = 600_000;
const NOTIFY_TTL_MS = 604_800_000;
/** Expired rows removed per table per mutating call: bounded work, tables still shrink. */
const PURGE_BATCH = 50;
const SCHEMA_VERSION = 1;

export type FileStore = LeadStore & {
  /** Every stored lead, oldest first (insertion order). */
  leads(): StoredLead[];
  close(): void;
};

function chmodQuiet(path: string, mode: number) {
  try {
    chmodSync(path, mode);
  } catch {
    // The -wal and -shm files exist only while the database is open; a missing one is fine.
  }
}

function openDatabase(path: string): Database.Database {
  const file = resolve(path);
  try {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    // Create the file with 0600 up front; SQLite gives -wal and -shm the same mode.
    closeSync(openSync(file, 'a', 0o600));
    chmodQuiet(file, 0o600);
    const db = new Database(file, { timeout: 5000 });
    try {
      db.pragma('journal_mode = WAL');
      db.pragma('busy_timeout = 5000');
      db.pragma('synchronous = FULL');
      migrate(db);
    } catch (error) {
      db.close();
      throw error;
    }
    chmodQuiet(`${file}-wal`, 0o600);
    chmodQuiet(`${file}-shm`, 0o600);
    return db;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot open the lead database at ${file}: ${reason}`, { cause: error });
  }
}

function migrate(db: Database.Database) {
  const version = db.pragma('user_version', { simple: true }) as number;
  if (version === SCHEMA_VERSION) return;
  if (version > SCHEMA_VERSION) {
    throw new Error(`database schema version ${version} is newer than this app supports (${SCHEMA_VERSION})`);
  }
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, json TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS phone_claims (phone TEXT PRIMARY KEY, lead_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS notify_marks (lead_id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS rate_limits (ip TEXT PRIMARY KEY, count INTEGER NOT NULL, window_end INTEGER NOT NULL);
    `);
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }).immediate();
}

export function createFileStore(options: { path: string; now?: () => number }): FileStore {
  const now = options.now ?? Date.now;
  const db = openDatabase(options.path);

  const purge = (table: string, column: string, t: number) =>
    db
      .prepare(`DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE ${column} <= ? LIMIT ${PURGE_BATCH})`)
      .run(t);

  const selectClaim = db.prepare('SELECT lead_id, expires_at FROM phone_claims WHERE phone = ?');
  const upsertClaim = db.prepare(
    'INSERT INTO phone_claims (phone, lead_id, expires_at) VALUES (?, ?, ?) ON CONFLICT(phone) DO UPDATE SET lead_id = excluded.lead_id, expires_at = excluded.expires_at',
  );
  const deleteClaim = db.prepare('DELETE FROM phone_claims WHERE phone = ? AND lead_id = ?');
  const insertLead = db.prepare('INSERT OR IGNORE INTO leads (id, json, created_at) VALUES (?, ?, ?)');
  const selectMark = db.prepare('SELECT expires_at FROM notify_marks WHERE lead_id = ?');
  const upsertMark = db.prepare(
    'INSERT INTO notify_marks (lead_id, expires_at) VALUES (?, ?) ON CONFLICT(lead_id) DO UPDATE SET expires_at = excluded.expires_at',
  );
  const deleteMark = db.prepare('DELETE FROM notify_marks WHERE lead_id = ?');
  const selectRate = db.prepare('SELECT count, window_end FROM rate_limits WHERE ip = ?');
  const upsertRate = db.prepare(
    'INSERT INTO rate_limits (ip, count, window_end) VALUES (?, ?, ?) ON CONFLICT(ip) DO UPDATE SET count = excluded.count, window_end = excluded.window_end',
  );

  const claimPhoneTx = db.transaction((e164: string, leadId: string, ttlSeconds: number): string | null => {
    const t = now();
    purge('phone_claims', 'expires_at', t);
    const row = selectClaim.get(e164) as { lead_id: string; expires_at: number } | undefined;
    if (row && row.expires_at > t) return row.lead_id;
    upsertClaim.run(e164, leadId, t + ttlSeconds * 1000);
    return null;
  });

  const releasePhoneTx = db.transaction((e164: string, leadId: string) => {
    deleteClaim.run(e164, leadId);
  });

  const saveLeadTx = db.transaction((lead: StoredLead) => {
    const created = Date.parse(lead.createdAt);
    insertLead.run(lead.leadId, JSON.stringify(lead), Number.isNaN(created) ? now() : created);
  });

  const claimNotificationTx = db.transaction((leadId: string): boolean => {
    const t = now();
    purge('notify_marks', 'expires_at', t);
    const row = selectMark.get(leadId) as { expires_at: number } | undefined;
    if (row && row.expires_at > t) return false;
    upsertMark.run(leadId, t + NOTIFY_TTL_MS);
    return true;
  });

  const releaseNotificationTx = db.transaction((leadId: string) => {
    deleteMark.run(leadId);
  });

  const hitRateTx = db.transaction((ip: string): number => {
    const t = now();
    purge('rate_limits', 'window_end', t);
    const row = selectRate.get(ip) as { count: number; window_end: number } | undefined;
    if (row && row.window_end > t) {
      upsertRate.run(ip, row.count + 1, row.window_end); // the window is never extended
      return row.count + 1;
    }
    upsertRate.run(ip, 1, t + RATE_WINDOW_MS);
    return 1;
  });

  return {
    async claimPhone(e164, leadId, ttlSeconds) {
      return claimPhoneTx.immediate(e164, leadId, ttlSeconds);
    },
    async releasePhone(e164, leadId) {
      releasePhoneTx.immediate(e164, leadId);
    },
    async saveLead(lead) {
      saveLeadTx.immediate(lead);
    },
    async claimNotification(leadId) {
      return claimNotificationTx.immediate(leadId);
    },
    async releaseNotification(leadId) {
      releaseNotificationTx.immediate(leadId);
    },
    async hitRate(ip) {
      return hitRateTx.immediate(ip);
    },
    leads() {
      const rows = db.prepare('SELECT json FROM leads ORDER BY rowid').all() as { json: string }[];
      return rows.map((r) => JSON.parse(r.json) as StoredLead);
    },
    close() {
      db.close();
    },
  };
}
