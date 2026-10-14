import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFileStore } from '@/lib/file-store';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kvarta-proc-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function runChild(path: string, leadId: string, startAt: number) {
  return new Promise<{ leadId: string; result: string | null }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--no-warnings', 'tests/helpers/claim-child.mts', path, leadId, String(startAt)],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) =>
      code === 0 ? resolve(JSON.parse(out.trim().split('\n').pop()!)) : reject(new Error(`child ${leadId}: ${err}`)),
    );
  });
}

describe('file store across real processes', () => {
  it('8 processes racing for one phone produce exactly one winner', async () => {
    const path = join(dir, 'leads.sqlite');
    createFileStore({ path }).close(); // create the schema once
    const startAt = Date.now() + 1500;
    const ids = Array.from({ length: 8 }, (_, i) => `proc-${i}`);
    const results = await Promise.all(ids.map((id) => runChild(path, id, startAt)));
    const winners = results.filter((r) => r.result === null);
    expect(winners).toHaveLength(1);
    for (const r of results) if (r.result !== null) expect(r.result).toBe(winners[0].leadId);
  }, 30_000);
});

describe('expiry boundary: expires_at == now is expired', () => {
  const open = () => {
    const clock = { t: 5_000_000 };
    const store = createFileStore({ path: join(dir, 'b.sqlite'), now: () => clock.t });
    return { clock, store };
  };

  it('claimPhone', async () => {
    const { clock, store } = open();
    await store.claimPhone('+375291234567', 'A', 600);
    clock.t += 600_000 - 1;
    expect(await store.claimPhone('+375291234567', 'B', 600)).toBe('A');
    clock.t += 1; // exactly expires_at
    expect(await store.claimPhone('+375291234567', 'B', 600)).toBeNull();
    store.close();
  });

  it('claimNotification', async () => {
    const { clock, store } = open();
    await store.claimNotification('A');
    clock.t += 604_800_000 - 1;
    expect(await store.claimNotification('A')).toBe(false);
    clock.t += 1;
    expect(await store.claimNotification('A')).toBe(true);
    store.close();
  });

  it('hitRate window', async () => {
    const { clock, store } = open();
    expect(await store.hitRate('ip')).toBe(1);
    clock.t += 600_000 - 1;
    expect(await store.hitRate('ip')).toBe(2);
    clock.t += 1; // exactly window_end: a new window starts
    expect(await store.hitRate('ip')).toBe(1);
    store.close();
  });
});
