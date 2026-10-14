import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  calls: [] as unknown[][],
  kv: new Map<string, string>(),
  lists: new Map<string, string[]>(),
  failEvalOnce: false,
  setOpts: [] as { key: string; opts: unknown }[],
}));

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({
      multi: () => {
        const p = {
          incr: (...a: unknown[]) => (h.calls.push(['incr', ...a]), p),
          expire: (...a: unknown[]) => (h.calls.push(['expire', ...a]), p),
          exec: async () => [1, 1],
        };
        return p;
      },
      set: async (key: string, value: string, opts?: { nx?: boolean; ex?: number }) => {
        h.setOpts.push({ key, opts });
        if (opts?.nx && h.kv.has(key)) return null;
        h.kv.set(key, value);
        return 'OK';
      },
      get: async (key: string) => h.kv.get(key) ?? null,
      del: async (key: string) => (h.kv.delete(key) ? 1 : 0),
      eval: async (script: string, keys: string[], args: string[]) => {
        h.calls.push(['eval', script, keys, args]);
        if (h.failEvalOnce) {
          h.failEvalOnce = false;
          throw new Error('network down');
        }
        if (script.includes('LPUSH')) {
          if (h.kv.has(keys[0])) return 0;
          h.kv.set(keys[0], args[0]);
          h.lists.set(keys[1], [args[1], ...(h.lists.get(keys[1]) ?? [])]);
          return 1;
        }
        if (h.kv.get(keys[0]) === args[0]) return h.kv.delete(keys[0]) ? 1 : 0;
        return 0;
      },
    }),
  },
}));

import { handleLead } from '@/lib/handle-lead';
import { createMemoryStore, createUpstashStore, safeErrorLabel, type StoredLead } from '@/lib/store';

beforeEach(() => {
  h.calls.length = 0;
  h.kv.clear();
  h.lists.clear();
  h.failEvalOnce = false;
  h.setOpts.length = 0;
});

const lead = (): StoredLead => ({
  leadId: 'key-0001',
  name: 'Anna',
  phone: '+375291234567',
  interest: 'order',
  comment: '',
  attribution: {},
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('rate limit counter', () => {
  it('upstash: INCR and EXPIRE NX go out in one atomic multi on every hit', async () => {
    await createUpstashStore().hitRate('1.1.1.1');
    expect(h.calls).toEqual([
      ['incr', 'rl:1.1.1.1'],
      ['expire', 'rl:1.1.1.1', 600, 'NX'],
    ]);
  });

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

describe('upstash eval call shapes', () => {
  it('saveLead is one eval over the lead key and the list with SET NX + LPUSH', async () => {
    await createUpstashStore().saveLead(lead());
    expect(h.calls).toHaveLength(1);
    const [name, script, keys, args] = h.calls[0] as [string, string, string[], string[]];
    expect(name).toBe('eval');
    expect(script).toContain("'NX'");
    expect(script).toContain('LPUSH');
    expect(keys).toEqual(['lead:key-0001', 'leads']);
    expect(args).toEqual([JSON.stringify(lead()), 'key-0001']);
  });

  it('releasePhone is one eval carrying the owner id', async () => {
    await createUpstashStore().releasePhone('+375291234567', 'K1');
    const [name, , keys, args] = h.calls[0] as [string, string, string[], string[]];
    expect(name).toBe('eval');
    expect(keys).toEqual(['phone:+375291234567']);
    expect(args).toEqual(['K1']);
  });
});

describe('upstash store through handleLead', () => {
  it('a failed save eval releases the claim; the same-key retry stores, lists and notifies once', async () => {
    const store = createUpstashStore();
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
    h.failEvalOnce = true;
    // The first eval call is saveLead (the SET NX claim goes through set, not eval).
    const first = await handleLead({ body, ip: '1.1.1.1' }, deps);
    expect(first.status).toBe(503);
    expect(h.kv.has('phone:+375291234567')).toBe(false);
    const retry = await handleLead({ body, ip: '1.1.1.1' }, deps);
    expect(retry).toEqual({ status: 200, body: { ok: true, leadId: 'key-0001' } });
    expect(h.lists.get('leads')).toEqual(['key-0001']);
    expect(notify).toHaveBeenCalledTimes(1);
    err.mockRestore();
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

