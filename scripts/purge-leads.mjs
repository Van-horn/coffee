#!/usr/bin/env node
// Retention: removes leads older than N days. Dry run by default; pass --apply to delete.
// Usage: node scripts/purge-leads.mjs --older-than-days 365 [--apply] [--db /data/leads.sqlite]
import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

/** Counts (and with apply=true removes) leads created before now - days. */
export function purgeLeads({ dbPath, days, apply = false, now = Date.now() }) {
  if (!Number.isFinite(days) || days < 1) throw new Error('--older-than-days must be a number of days, 1 or more');
  const cutoff = now - days * 86_400_000;
  const db = new Database(resolve(dbPath), { readonly: !apply, fileMustExist: true });
  try {
    db.pragma('busy_timeout = 5000');
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM leads WHERE created_at < ?').get(cutoff);
    if (!apply) return { matched: n, deleted: 0, cutoff: new Date(cutoff).toISOString() };
    const deleted = db.prepare('DELETE FROM leads WHERE created_at < ?').run(cutoff).changes;
    return { matched: n, deleted, cutoff: new Date(cutoff).toISOString() };
  } finally {
    db.close();
  }
}

function main() {
  const { values } = parseArgs({
    options: {
      db: { type: 'string' },
      'older-than-days': { type: 'string' },
      apply: { type: 'boolean', default: false },
    },
  });
  const dbPath = values.db ?? process.env.LEADS_DB_PATH;
  if (!dbPath || !values['older-than-days']) {
    console.error('purge-leads: pass --older-than-days <n> and --db <path> (or set LEADS_DB_PATH)');
    process.exit(2);
  }
  try {
    const r = purgeLeads({ dbPath, days: Number(values['older-than-days']), apply: values.apply });
    if (values.apply) console.log(`deleted ${r.deleted} lead(s) created before ${r.cutoff}`);
    else console.log(`dry run: ${r.matched} lead(s) created before ${r.cutoff} would be deleted; add --apply to delete`);
  } catch (error) {
    console.error(`purge-leads: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
