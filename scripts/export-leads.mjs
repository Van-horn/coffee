#!/usr/bin/env node
// Read-only export of every stored lead as CSV (default) or JSON (--json).
// Usage: node scripts/export-leads.mjs [--db /data/leads.sqlite] [--json]
// The database path comes from --db or LEADS_DB_PATH. The Next app is never loaded.
import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const COLUMNS = [
  'created_at',
  'id',
  'interest',
  'name',
  'phone',
  'comment',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'landing',
  'referrer',
];

/** Rows for every lead, oldest first. */
export function readLeads(dbPath) {
  const db = new Database(resolve(dbPath), { readonly: true, fileMustExist: true });
  try {
    const rows = db.prepare('SELECT id, json, created_at FROM leads ORDER BY rowid').all();
    return rows.map((row) => {
      const lead = JSON.parse(row.json);
      const attribution = lead.attribution ?? {};
      return {
        created_at: new Date(row.created_at).toISOString(),
        id: row.id,
        interest: lead.interest ?? '',
        name: lead.name ?? '',
        phone: lead.phone ?? '',
        comment: lead.comment ?? '',
        utm_source: attribution.utm_source ?? '',
        utm_medium: attribution.utm_medium ?? '',
        utm_campaign: attribution.utm_campaign ?? '',
        landing: attribution.landing ?? '',
        referrer: attribution.referrer ?? '',
      };
    });
  } finally {
    db.close();
  }
}

/** One CSV field: neutralizes spreadsheet formulas, then quotes when needed. */
export function csvField(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows) {
  const lines = [COLUMNS.join(',')];
  for (const row of rows) lines.push(COLUMNS.map((c) => csvField(row[c])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

function main() {
  const { values } = parseArgs({
    options: { db: { type: 'string' }, json: { type: 'boolean', default: false } },
  });
  const dbPath = values.db ?? process.env.LEADS_DB_PATH;
  if (!dbPath) {
    console.error('export-leads: pass --db <path> or set LEADS_DB_PATH');
    process.exit(2);
  }
  try {
    const rows = readLeads(dbPath);
    process.stdout.write(values.json ? `${JSON.stringify(rows, null, 2)}\n` : toCsv(rows));
  } catch (error) {
    console.error(`export-leads: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
