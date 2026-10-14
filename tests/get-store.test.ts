import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileStore } from '@/lib/file-store';
import { databasePath, getStore, resetStoreForTests, selectStore } from '@/lib/get-store';

let dir: string;
const opened: FileStore[] = [];
const file = (env: Record<string, string>) => {
  const s = selectStore(env) as FileStore;
  opened.push(s);
  return s;
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kvarta-get-'));
  resetStoreForTests();
});
afterEach(() => {
  for (const s of opened.splice(0)) s.close?.();
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('selectStore', () => {
  it('uses the explicit LEADS_DB_PATH', async () => {
    const path = join(dir, 'a.sqlite');
    const store = file({ LEADS_DB_PATH: path });
    expect(await store.claimPhone('+375291234567', 'A', 600)).toBeNull();
    expect(existsSync(path)).toBe(true);
  });

  it('defaults to ./data/leads.sqlite under the working directory', () => {
    expect(databasePath({}, '/srv/app')).toBe(join('/srv/app', 'data', 'leads.sqlite'));
    expect(databasePath({ LEADS_DB_PATH: '  ' }, '/srv/app')).toBe(join('/srv/app', 'data', 'leads.sqlite'));
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    const store = file({});
    expect(typeof store.close).toBe('function');
    expect(existsSync(join(dir, 'data', 'leads.sqlite'))).toBe(true);
  });

  it('refuses the file store on Vercel with one error log and rejecting methods', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = selectStore({ VERCEL: '1', LEADS_DB_PATH: join(dir, 'v.sqlite') });
    await expect(store.hitRate('x')).rejects.toThrow(/Vercel/);
    await expect(store.saveLead({} as never)).rejects.toThrow(/Vercel/);
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0][0])).toMatch(/ephemeral on Vercel/);
    expect(existsSync(join(dir, 'v.sqlite'))).toBe(false);
  });

  it('ALLOW_EPHEMERAL_FILE_STORE=1 overrides the Vercel guard', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = file({ VERCEL: '1', ALLOW_EPHEMERAL_FILE_STORE: '1', LEADS_DB_PATH: join(dir, 'v.sqlite') });
    expect(typeof store.close).toBe('function');
    expect(err).not.toHaveBeenCalled();
  });

  it('an unopenable database path gives a rejecting store, not a throw', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = selectStore({ LEADS_DB_PATH: dir });
    await expect(store.hitRate('x')).rejects.toThrow(/cannot be opened/);
  });

  it('refuses the file store on Netlify without the override: one error log, rejecting methods', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const path = join(dir, 'n.sqlite');
    const store = selectStore({ NETLIFY: 'true', LEADS_DB_PATH: path });
    await expect(store.hitRate('x')).rejects.toThrow(/Netlify/);
    await expect(store.saveLead({} as never)).rejects.toThrow(/Netlify/);
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0][0])).toMatch(/ephemeral on Netlify/);
    expect(existsSync(path)).toBe(false);
  });

  it('treats AWS_LAMBDA_FUNCTION_NAME (the Netlify function runtime) like Netlify', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = selectStore({ AWS_LAMBDA_FUNCTION_NAME: 'fn', LEADS_DB_PATH: join(dir, 'l.sqlite') });
    await expect(store.hitRate('x')).rejects.toThrow(/Netlify/);
    expect(err).toHaveBeenCalledTimes(1);
  });

  it('ALLOW_EPHEMERAL_FILE_STORE=1 with an explicit LEADS_DB_PATH opens the file store on Netlify', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const path = join(dir, 'n.sqlite');
    const store = file({ NETLIFY: 'true', ALLOW_EPHEMERAL_FILE_STORE: '1', LEADS_DB_PATH: path });
    expect(await store.claimPhone('+375291234567', 'A', 600)).toBeNull();
    expect(existsSync(path)).toBe(true);
    expect(err).not.toHaveBeenCalled();
  });

  it('rejection messages carry no personal data', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = selectStore({ VERCEL: '1' });
    const e = await store.claimPhone('+375291234567', 'Secret', 600).catch((x: Error) => x);
    expect((e as Error).message).not.toMatch(/375291234567|Secret/);
  });
});

describe('getStore', () => {
  it('is a lazy singleton', () => {
    const a = getStore({ LEADS_DB_PATH: join(dir, 's.sqlite') }) as FileStore;
    opened.push(a);
    expect(getStore({})).toBe(a);
    resetStoreForTests();
    expect(existsSync(join(dir, 's.sqlite'))).toBe(true);
  });
});
