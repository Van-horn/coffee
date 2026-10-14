import Database from 'better-sqlite3';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFileStore } from '@/lib/file-store';
import type { StoredLead } from '@/lib/store';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kvarta-fs-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const lead = (id: string, extra: Partial<StoredLead> = {}): StoredLead => ({
  leadId: id,
  name: 'Anna',
  phone: '+375291234567',
  interest: 'order',
  comment: '',
  attribution: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

describe('file store specifics', () => {
  it('two connections racing for one phone produce exactly one winner', async () => {
    const path = join(dir, 'leads.sqlite');
    const a = createFileStore({ path });
    const b = createFileStore({ path });
    const results = await Promise.all([
      a.claimPhone('+375291234567', 'A', 600),
      b.claimPhone('+375291234567', 'B', 600),
      a.claimPhone('+375291234567', 'C', 600),
      b.claimPhone('+375291234567', 'D', 600),
    ]);
    expect(results.filter((r) => r === null)).toHaveLength(1);
    const winner = ['A', 'B', 'C', 'D'][results.indexOf(null)];
    for (const r of results) if (r !== null) expect(r).toBe(winner);
    a.close();
    b.close();
  });

  it('claims and leads survive close and reopen', async () => {
    const path = join(dir, 'leads.sqlite');
    const first = createFileStore({ path });
    await first.claimPhone('+375291234567', 'A', 600);
    await first.saveLead(lead('A'));
    first.close();
    const second = createFileStore({ path });
    expect(await second.claimPhone('+375291234567', 'B', 600)).toBe('A');
    expect(second.leads().map((l) => l.leadId)).toEqual(['A']);
    second.close();
  });

  it.skipIf(process.platform === 'win32')('creates the directory 0700 and the file 0600', async () => {
    const path = join(dir, 'nested', 'data', 'leads.sqlite');
    const store = createFileStore({ path });
    await store.saveLead(lead('A'));
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(statSync(join(dir, 'nested', 'data')).mode & 0o777).toBe(0o700);
    expect(statSync(`${path}-wal`).mode & 0o777).toBe(0o600);
    store.close();
  });

  it('fails with a clear error when the directory cannot be created', () => {
    const blocker = join(dir, 'file');
    writeFileSync(blocker, 'x');
    expect(() => createFileStore({ path: join(blocker, 'leads.sqlite') })).toThrow(/Cannot open the lead database/);
  });

  it('fails with a clear error when the path is a directory', () => {
    const path = join(dir, 'leads.sqlite');
    mkdirSync(path);
    expect(() => createFileStore({ path })).toThrow(/Cannot open the lead database/);
  });

  it('fails with a clear error on a corrupt file', () => {
    const path = join(dir, 'leads.sqlite');
    writeFileSync(path, 'this is definitely not a sqlite database '.repeat(50));
    expect(() => createFileStore({ path })).toThrow(/Cannot open the lead database/);
  });

  it('refuses a database written by a newer schema', () => {
    const path = join(dir, 'leads.sqlite');
    const raw = new Database(path);
    raw.pragma('user_version = 99');
    raw.close();
    expect(() => createFileStore({ path })).toThrow(/newer than this app supports/);
  });

  it('round-trips a 5 KB comment', async () => {
    const store = createFileStore({ path: join(dir, 'leads.sqlite') });
    const comment = 'кофе, "quote"\nline '.repeat(300).slice(0, 5000);
    await store.saveLead(lead('A', { comment }));
    expect(store.leads()[0].comment).toBe(comment);
    store.close();
  });

  it('keeps insertion order for the export', async () => {
    const store = createFileStore({ path: join(dir, 'leads.sqlite') });
    for (const id of ['z', 'a', 'm']) await store.saveLead(lead(id));
    expect(store.leads().map((l) => l.leadId)).toEqual(['z', 'a', 'm']);
    store.close();
  });

  it('never purges leads, however old', async () => {
    let t = 0;
    const store = createFileStore({ path: join(dir, 'leads.sqlite'), now: () => t });
    await store.saveLead(lead('A'));
    t = 10 * 365 * 86_400_000;
    await store.claimPhone('+375291234567', 'B', 600);
    await store.hitRate('x');
    expect(store.leads()).toHaveLength(1);
    store.close();
  });
});
