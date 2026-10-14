import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFileStore } from '@/lib/file-store';
import { purgeLeads } from '../scripts/purge-leads.mjs';

let dir: string;
let db: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kvarta-purge-'));
  db = join(dir, 'leads.sqlite');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const bytes = () =>
  [db, `${db}-wal`].filter(existsSync).map((f) => readFileSync(f).toString('latin1')).join('');

describe('purge-leads --apply', () => {
  it('removes the rows and the personal data from the file and the WAL, and the db still opens', async () => {
    const store = createFileStore({ path: db });
    const base = { phone: '+375291234567', interest: 'order' as const, comment: '', attribution: {} };
    await store.saveLead({ ...base, leadId: 'old', name: 'ZzOldCustomerQq', createdAt: '2020-01-01T00:00:00.000Z' });
    await store.saveLead({ ...base, leadId: 'new', name: 'KeepMe', createdAt: new Date().toISOString() });
    store.close();
    expect(bytes()).toContain('ZzOldCustomerQq');

    expect(purgeLeads({ dbPath: db, days: 365, apply: true }).deleted).toBe(1);
    expect(bytes()).not.toContain('ZzOldCustomerQq');

    const reopened = createFileStore({ path: db });
    expect(reopened.leads().map((l) => l.leadId)).toEqual(['new']);
    await reopened.saveLead({ ...base, leadId: 'again', name: 'X', createdAt: new Date().toISOString() });
    expect(reopened.leads()).toHaveLength(2);
    reopened.close();
  });
});
