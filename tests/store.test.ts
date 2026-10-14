import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createFileStore } from '@/lib/file-store';
import { handleLead } from '@/lib/handle-lead';
import { createMemoryStore, safeErrorLabel, type LeadStore } from '@/lib/store';

describe('rate limit counter', () => {
  it('memory: the window starts at the first hit and resets after 600 s', async () => {
    let t = 0;
    const s = createMemoryStore(() => t);
    expect(await s.hitRate('a')).toBe(1);
    t = 599_000;
    expect(await s.hitRate('a')).toBe(2);
    t = 600_001;
    expect(await s.hitRate('a')).toBe(1);
  });
});

describe('file store through handleLead', () => {
  it('a failed save releases the claim; the same-key retry stores and notifies once', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kvarta-hl-'));
    const file = createFileStore({ path: join(dir, 'leads.sqlite') });
    let failSave = true;
    const store: LeadStore = {
      ...file,
      saveLead: async (lead) => {
        if (failSave) {
          failSave = false;
          throw new Error('disk full');
        }
        return file.saveLead(lead);
      },
    };
    const notify = vi.fn().mockResolvedValue(undefined);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = { store, notify, now: () => 1_800_000_000_000 };
    const body = {
      name: 'Анна',
      phone: '+375 29 123-45-67',
      interest: 'order',
      idempotencyKey: 'key-0001',
      renderedAt: 1,
      attribution: {},
    };
    expect((await handleLead({ body, ip: '1.1.1.1' }, deps)).status).toBe(503);
    const retry = await handleLead({ body, ip: '1.1.1.1' }, deps);
    expect(retry).toEqual({ status: 200, body: { ok: true, leadId: 'key-0001' } });
    expect(file.leads().map((l) => l.leadId)).toEqual(['key-0001']);
    expect(notify).toHaveBeenCalledTimes(1);
    err.mockRestore();
    file.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('safeErrorLabel', () => {
  it('cuts the command payload and caps length', () => {
    const e = new Error('ERR x, command was: ["SET","a","secret"]');
    expect(safeErrorLabel(e)).toBe('Error: ERR x,');
    expect(safeErrorLabel(new Error('y'.repeat(500))).length).toBe(200);
    expect(safeErrorLabel('str')).toBe('UnknownError');
  });
});
