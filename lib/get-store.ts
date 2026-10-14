import { join } from 'node:path';
import { createFileStore } from '@/lib/file-store';
import { safeErrorLabel, type LeadStore } from '@/lib/store';

type Env = Record<string, string | undefined>;
type Deps = { now?: () => number; open?: (path: string) => LeadStore };

/** After a failed open the next attempt waits this long, so a fixed disk or permission recovers without a restart. */
export const RETRY_COOLDOWN_MS = 30_000;

function failingStore(message: string): LeadStore {
  const fail = () => Promise.reject(new Error(message));
  return {
    claimPhone: fail,
    releasePhone: fail,
    saveLead: fail,
    claimNotification: fail,
    releaseNotification: fail,
    hitRate: fail,
  };
}

/** The database file: LEADS_DB_PATH, or ./data/leads.sqlite under the working directory. */
export function databasePath(env: Env, cwd = process.cwd()): string {
  return env.LEADS_DB_PATH?.trim() || join(cwd, 'data', 'leads.sqlite');
}

const defaultOpen = (path: string): LeadStore => createFileStore({ path });

type Selection = { store: LeadStore; retryAt: number | null };

function select(env: Env, deps: Deps): Selection {
  const now = deps.now ?? Date.now;
  if (env.VERCEL && env.ALLOW_EPHEMERAL_FILE_STORE !== '1') {
    console.error(
      'lead store: the filesystem is ephemeral on Vercel: orders would be lost; deploy to a server with a persistent disk',
    );
    return { store: failingStore('Lead storage is unavailable on Vercel (ephemeral filesystem)'), retryAt: null };
  }
  try {
    return { store: (deps.open ?? defaultOpen)(databasePath(env)), retryAt: null };
  } catch (error) {
    console.error('lead store: cannot open the file database', safeErrorLabel(error));
    return {
      store: failingStore('Lead storage is unavailable: the file database cannot be opened'),
      retryAt: now() + RETRY_COOLDOWN_MS,
    };
  }
}

/** Builds the file store for this environment. Called lazily on the first request, never at import time. */
export function selectStore(env: Env, deps: Deps = {}): LeadStore {
  return select(env, deps).store;
}

let current: Selection | undefined;

/** Lazy singleton. A failed open is retried after RETRY_COOLDOWN_MS, with one error log per failed attempt. */
export function getStore(env: Env = process.env, deps: Deps = {}): LeadStore {
  const now = deps.now ?? Date.now;
  if (!current || (current.retryAt !== null && now() >= current.retryAt)) current = select(env, deps);
  return current.store;
}

/** Test helper: forget the cached store. */
export function resetStoreForTests() {
  current = undefined;
}
