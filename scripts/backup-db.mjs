#!/usr/bin/env node
// Consistent online backup of the lead database (SQLite VACUUM INTO), safe while the app is running.
// Usage: node scripts/backup-db.mjs [--db /data/leads.sqlite] --dir /backups [--keep 14]
import Database from 'better-sqlite3';
import { chmodSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const NAME = /^leads-\d{8}-\d{6}\.sqlite$/;
const pad = (n) => String(n).padStart(2, '0');

export function backupName(date) {
  const d = date;
  return `leads-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.sqlite`;
}

/** Writes one backup into dir and removes the oldest ones beyond `keep`. Returns the new file path. */
export function backup({ dbPath, dir, keep = 14, now = new Date() }) {
  if (!Number.isInteger(keep) || keep < 1) throw new Error('--keep must be a positive integer');
  const target = join(resolve(dir), backupName(now));
  mkdirSync(resolve(dir), { recursive: true, mode: 0o700 });
  const db = new Database(resolve(dbPath), { readonly: true, fileMustExist: true });
  try {
    db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  } finally {
    db.close();
  }
  chmodSync(target, 0o600);
  const old = readdirSync(resolve(dir)).filter((f) => NAME.test(f)).sort().reverse().slice(keep);
  for (const f of old) rmSync(join(resolve(dir), f));
  return target;
}

function main() {
  const { values } = parseArgs({
    options: { db: { type: 'string' }, dir: { type: 'string' }, keep: { type: 'string', default: '14' } },
  });
  const dbPath = values.db ?? process.env.LEADS_DB_PATH;
  if (!dbPath || !values.dir) {
    console.error('backup-db: pass --dir <backup directory> and --db <path> (or set LEADS_DB_PATH)');
    process.exit(2);
  }
  try {
    console.log(backup({ dbPath, dir: values.dir, keep: Number(values.keep) }));
  } catch (error) {
    console.error(`backup-db: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
