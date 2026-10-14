import { describe, expect, it, vi } from 'vitest';

const calls: unknown[][] = [];
vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({
      multi: () => {
        const p = {
          incr: (...a: unknown[]) => (calls.push(['incr', ...a]), p),
          expire: (...a: unknown[]) => (calls.push(['expire', ...a]), p),
          exec: async () => [1, 1],
        };
        return p;
      },
    }),
  },
}));

import { createMemoryStore, createUpstashStore, safeErrorLabel } from '@/lib/store';

describe('rate limit counter', () => {
  it('upstash: INCR and EXPIRE NX go out in one atomic multi on every hit', async () => {
    await createUpstashStore().hitRate('1.1.1.1');
    expect(calls).toEqual([
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

describe('safeErrorLabel', () => {
  it('cuts the command payload and caps length', () => {
    const e = new Error('ERR x, command was: ["SET","a","secret"]');
    expect(safeErrorLabel(e)).toBe('Error: ERR x,');
    expect(safeErrorLabel(new Error('y'.repeat(500))).length).toBe(200);
    expect(safeErrorLabel('str')).toBe('UnknownError');
  });
});
