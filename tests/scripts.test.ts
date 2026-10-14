import Database from 'better-sqlite3';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFileStore } from '@/lib/file-store';
import type { StoredLead } from '@/lib/store';
// @ts-expect-error plain ESM scripts without type declarations
import { backup } from '../scripts/backup-db.mjs';
// @ts-expect-error plain ESM scripts without type declarations
import { csvField, readLeads, toCsv } from '../scripts/export-leads.mjs';
// @ts-expect-error plain ESM scripts without type declarations
import { purgeLeads } from '../scripts/purge-leads.mjs';

let dir: string;
let db: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kvarta-scripts-'));
  db = join(dir, 'leads.sqlite');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const lead = (id: string, extra: Partial<StoredLead> = {}): StoredLead => ({
  leadId: id,
  name: 'Anna',
  phone: '+375291234567',
  interest: 'order',
  comment: '',
  attribution: {},
  createdAt: '2026-03-01T10:00:00.000Z',
  ...extra,
});

async function seed(leads: StoredLead[]) {
  const store = createFileStore({ path: db });
  for (const l of leads) await store.saveLead(l);
  store.close();
}

describe('export-leads', () => {
  it('quotes commas, quotes and newlines and keeps attribution columns', async () => {
    await seed([
      lead('A', {
        name: 'Smith, "Bob"',
        comment: 'line1\nline2',
        attribution: { utm_source: 'ya', utm_medium: 'cpc', utm_campaign: 'spring', landing: 'https://x/', referrer: 'https://r/' },
      }),
    ]);
    const csv = toCsv(readLeads(db));
    const [header, ...rest] = csv.split('\r\n');
    expect(header).toBe('created_at,id,interest,name,phone,comment,utm_source,utm_medium,utm_campaign,landing,referrer');
    expect(rest.join('\r\n')).toContain('2026-03-01T10:00:00.000Z,A,order,"Smith, ""Bob""",');
    expect(csv).toContain('"line1\nline2"');
    expect(csv).toContain(',ya,cpc,spring,https://x/,https://r/');
  });

  it('neutralizes spreadsheet formula injection', () => {
    for (const bad of ['=1+1', '+7', '-2', '@SUM(A1)']) expect(csvField(bad)).toBe(`'${bad}`);
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField('plain')).toBe('plain');
  });

  it('prints only the header for an empty database', async () => {
    await seed([]);
    expect(toCsv(readLeads(db))).toBe('created_at,id,interest,name,phone,comment,utm_source,utm_medium,utm_campaign,landing,referrer\r\n');
  });

  it('the CLI prints JSON and fails clearly on a missing database', async () => {
    await seed([lead('A'), lead('B')]);
    const out = execFileSync('node', ['scripts/export-leads.mjs', '--db', db, '--json']).toString();
    expect(JSON.parse(out).map((r: { id: string }) => r.id)).toEqual(['A', 'B']);
    const bad = spawnSync('node', ['scripts/export-leads.mjs', '--db', join(dir, 'nope.sqlite')]);
    expect(bad.status).toBe(1);
    expect(bad.stderr.toString()).toMatch(/export-leads:/);
  });

  it('does not modify the database', async () => {
    await seed([lead('A')]);
    const before = statSync(db).mtimeMs;
    readLeads(db);
    expect(statSync(db).mtimeMs).toBe(before);
  });
});

describe('backup-db', () => {
  it('writes an openable copy with the same rows, mode 0600', async () => {
    await seed([lead('A'), lead('B')]);
    const target = backup({ dbPath: db, dir: join(dir, 'bk'), now: new Date(2026, 2, 1, 4, 5, 6) });
    expect(target.endsWith('leads-20260301-040506.sqlite')).toBe(true);
    expect(statSync(target).mode & 0o777).toBe(0o600);
    const copy = new Database(target, { readonly: true });
    expect(copy.prepare('SELECT id FROM leads ORDER BY rowid').all()).toEqual([{ id: 'A' }, { id: 'B' }]);
    copy.close();
  });

  it('keeps only the newest N backups', async () => {
    await seed([lead('A')]);
    const bk = join(dir, 'bk');
    for (let day = 1; day <= 5; day++) backup({ dbPath: db, dir: bk, keep: 3, now: new Date(2026, 0, day, 3, 0, 0) });
    expect(readdirSync(bk).sort()).toEqual([
      'leads-20260103-030000.sqlite',
      'leads-20260104-030000.sqlite',
      'leads-20260105-030000.sqlite',
    ]);
  });

  it('rejects a missing database and a bad --keep', () => {
    expect(() => backup({ dbPath: join(dir, 'nope.sqlite'), dir: join(dir, 'bk') })).toThrow();
    expect(() => backup({ dbPath: db, dir: join(dir, 'bk'), keep: 0 })).toThrow(/--keep/);
  });
});

describe('purge-leads', () => {
  const day = 86_400_000;
  const now = Date.parse('2026-10-14T00:00:00Z');

  it('dry run counts without deleting; apply deletes only older leads', async () => {
    await seed([
      lead('old', { createdAt: new Date(now - 400 * day).toISOString() }),
      lead('edge', { createdAt: new Date(now - 364 * day).toISOString() }),
      lead('new', { createdAt: new Date(now - day).toISOString() }),
    ]);
    const dry = purgeLeads({ dbPath: db, days: 365, now });
    expect(dry).toMatchObject({ matched: 1, deleted: 0 });
    expect(readLeads(db)).toHaveLength(3);
    const done = purgeLeads({ dbPath: db, days: 365, apply: true, now });
    expect(done.deleted).toBe(1);
    expect(readLeads(db).map((r: { id: string }) => r.id)).toEqual(['edge', 'new']);
  });

  it('requires a sane number of days', async () => {
    await seed([]);
    expect(() => purgeLeads({ dbPath: db, days: 0 })).toThrow(/older-than-days/);
    expect(() => purgeLeads({ dbPath: db, days: NaN })).toThrow(/older-than-days/);
  });

  it('the CLI defaults to a dry run', async () => {
    await seed([lead('old', { createdAt: '2020-01-01T00:00:00.000Z' })]);
    const out = execFileSync('node', ['scripts/purge-leads.mjs', '--db', db, '--older-than-days', '365']).toString();
    expect(out).toMatch(/dry run: 1 lead/);
    expect(existsSync(db)).toBe(true);
    expect(readLeads(db)).toHaveLength(1);
  });
});

