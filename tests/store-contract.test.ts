import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createFileStore } from '@/lib/file-store';
import { createMemoryStore, type LeadStore, type StoredLead } from '@/lib/store';

type Harness = {
  store: LeadStore;
  clock: { t: number };
  count(): number;
  cleanup(): void;
};

const PHONE = '+375291234567';

const lead = (id: string, extra: Partial<StoredLead> = {}): StoredLead => ({
  leadId: id,
  name: 'Anna',
  phone: PHONE,
  interest: 'order',
  comment: '',
  attribution: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

const makers: Record<string, { make: () => Harness }> = {
  memory: {
    make() {
      const clock = { t: 1_000_000 };
      const store = createMemoryStore(() => clock.t);
      return { store, clock, count: () => store.leads().length, cleanup() {} };
    },
  },
  file: {
    make() {
      const dir = mkdtempSync(join(tmpdir(), 'kvarta-contract-'));
      const clock = { t: 1_000_000 };
      const store = createFileStore({ path: join(dir, 'leads.sqlite'), now: () => clock.t });
      return {
        store,
        clock,
        count: () => store.leads().length,
        cleanup() {
          store.close();
          rmSync(dir, { recursive: true, force: true });
        },
      };
    },
  },
};

describe.each(Object.entries(makers))('LeadStore contract: %s', (_name, { make }) => {
  let ctx: Harness;
  const setup = () => (ctx = make());
  afterEach(() => ctx?.cleanup());

  it('claimPhone: first claim wins, the second sees the owner', async () => {
    setup();
    expect(await ctx.store.claimPhone(PHONE, 'A', 600)).toBeNull();
    expect(await ctx.store.claimPhone(PHONE, 'B', 600)).toBe('A');
  });

  it('claimPhone: the owner re-claiming gets its own key back', async () => {
    setup();
    await ctx.store.claimPhone(PHONE, 'A', 600);
    expect(await ctx.store.claimPhone(PHONE, 'A', 600)).toBe('A');
  });

  it('claimPhone: different phones are independent', async () => {
    setup();
    expect(await ctx.store.claimPhone(PHONE, 'A', 600)).toBeNull();
    expect(await ctx.store.claimPhone('+375291111111', 'B', 600)).toBeNull();
  });

  it('releasePhone: only the owner can release', async () => {
    setup();
    await ctx.store.claimPhone(PHONE, 'A', 600);
    await ctx.store.releasePhone(PHONE, 'B');
    expect(await ctx.store.claimPhone(PHONE, 'C', 600)).toBe('A');
    await ctx.store.releasePhone(PHONE, 'A');
    expect(await ctx.store.claimPhone(PHONE, 'C', 600)).toBeNull();
  });

  it('saveLead: idempotent per leadId, exactly one row', async () => {
    setup();
    await ctx.store.saveLead(lead('A'));
    await ctx.store.saveLead(lead('A', { name: 'Replay' }));
    await ctx.store.saveLead(lead('B'));
    expect(ctx.count()).toBe(2);
  });

  it('claimNotification: one owner until released', async () => {
    setup();
    expect(await ctx.store.claimNotification('A')).toBe(true);
    expect(await ctx.store.claimNotification('A')).toBe(false);
    expect(await ctx.store.claimNotification('B')).toBe(true);
    await ctx.store.releaseNotification('A');
    expect(await ctx.store.claimNotification('A')).toBe(true);
  });

  it('hitRate: counts hits per ip', async () => {
    setup();
    expect(await ctx.store.hitRate('1.1.1.1')).toBe(1);
    expect(await ctx.store.hitRate('1.1.1.1')).toBe(2);
    expect(await ctx.store.hitRate('2.2.2.2')).toBe(1);
  });

  it('claimPhone: same phone is a duplicate within 600 s and free after', async () => {
    setup();
    await ctx.store.claimPhone(PHONE, 'A', 600);
    ctx.clock.t += 599_999;
    expect(await ctx.store.claimPhone(PHONE, 'B', 600)).toBe('A');
    ctx.clock.t += 2;
    expect(await ctx.store.claimPhone(PHONE, 'B', 600)).toBeNull();
    expect(await ctx.store.claimPhone(PHONE, 'C', 600)).toBe('B');
  });

  it('claimNotification: the marker lives 7 days', async () => {
    setup();
    expect(await ctx.store.claimNotification('A')).toBe(true);
    ctx.clock.t += 604_799_000;
    expect(await ctx.store.claimNotification('A')).toBe(false);
    ctx.clock.t += 2_000;
    expect(await ctx.store.claimNotification('A')).toBe(true);
  });

  it('hitRate: the window starts at the first hit and is never extended', async () => {
    setup();
    expect(await ctx.store.hitRate('a')).toBe(1);
    ctx.clock.t += 599_000;
    expect(await ctx.store.hitRate('a')).toBe(2);
    ctx.clock.t += 1_001; // 600.001 s after the first hit
    expect(await ctx.store.hitRate('a')).toBe(1);
  });

  it('hitRate: the 6th request in the window is the first above the limit of 5', async () => {
    setup();
    const counts: number[] = [];
    for (let i = 0; i < 6; i++) counts.push(await ctx.store.hitRate('a'));
    expect(counts).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('expired rows do not block fresh claims (purge)', async () => {
    setup();
    for (let i = 0; i < 120; i++) {
      await ctx.store.claimPhone(`+3752900${String(i).padStart(5, '0')}`, `L${i}`, 600);
      await ctx.store.hitRate(`10.0.0.${i}`);
    }
    ctx.clock.t += 700_000;
    expect(await ctx.store.claimPhone('+375290000000'.slice(0, 13), 'new', 600)).toBeNull();
    expect(await ctx.store.hitRate('10.0.0.1')).toBe(1);
  });
});
