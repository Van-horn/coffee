import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStore, resetStoreForTests } from '@/lib/get-store';
import { createMemoryStore } from '@/lib/store';

beforeEach(() => resetStoreForTests());
afterEach(() => {
  resetStoreForTests();
  vi.restoreAllMocks();
});

describe('getStore retry after a failed open', () => {
  it('serves a failing store during the cooldown, logs once, then retries the open', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    let t = 1_000;
    let healthy = false;
    const good = createMemoryStore();
    const open = vi.fn(() => {
      if (!healthy) throw new Error('EACCES');
      return good;
    });
    const deps = { now: () => t, open };

    const first = getStore({}, deps);
    await expect(first.hitRate('x')).rejects.toThrow(/cannot be opened/);
    t += 29_000;
    expect(getStore({}, deps)).toBe(first);
    expect(open).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalledTimes(1);

    healthy = true;
    t += 2_000; // 31 s after the failure
    expect(getStore({}, deps)).toBe(good);
    expect(open).toHaveBeenCalledTimes(2);
    t += 3_600_000;
    expect(getStore({}, deps)).toBe(good);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('a repeated failure logs once per cooldown window, not per request', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    let t = 0;
    const deps = {
      now: () => t,
      open: () => {
        throw new Error('boom');
      },
    };
    for (let i = 0; i < 5; i++) getStore({}, deps);
    t += 30_000;
    for (let i = 0; i < 5; i++) getStore({}, deps);
    expect(err).toHaveBeenCalledTimes(2);
  });
});
