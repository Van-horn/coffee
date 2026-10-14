import { join } from 'node:path';
import { createFileStore } from '@/lib/file-store';
import { safeErrorLabel, type LeadStore } from '@/lib/store';

type Env = Record<string, string | undefined>;

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

/** Builds the file store for this environment. Called lazily on the first request, never at import time. */
export function selectStore(env: Env): LeadStore {
  if (env.VERCEL && env.ALLOW_EPHEMERAL_FILE_STORE !== '1') {
    console.error(
      'lead store: the filesystem is ephemeral on Vercel: orders would be lost; deploy to a server with a persistent disk',
    );
    return failingStore('Lead storage is unavailable on Vercel (ephemeral filesystem)');
  }
  try {
    return createFileStore({ path: databasePath(env) });
  } catch (error) {
    console.error('lead store: cannot open the file database', safeErrorLabel(error));
    return failingStore('Lead storage is unavailable: the file database cannot be opened');
  }
}

let singleton: LeadStore | undefined;

export function getStore(env: Env = process.env): LeadStore {
  return (singleton ??= selectStore(env));
}

/** Test helper: forget the cached store. */
export function resetStoreForTests() {
  singleton = undefined;
}
