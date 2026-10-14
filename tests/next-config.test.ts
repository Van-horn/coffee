import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadConfig() {
  vi.resetModules();
  return (await import('../next.config')).default;
}

describe('next.config output mode', () => {
  it('keeps the standalone output for the self-hosted server build', async () => {
    vi.stubEnv('NETLIFY', '');
    expect((await loadConfig()).output).toBe('standalone');
  });

  it('skips the standalone output when building on Netlify (its runtime builds Next itself)', async () => {
    vi.stubEnv('NETLIFY', 'true');
    expect((await loadConfig()).output).toBeUndefined();
  });

  it('keeps better-sqlite3 external in both modes', async () => {
    vi.stubEnv('NETLIFY', 'true');
    expect((await loadConfig()).serverExternalPackages).toContain('better-sqlite3');
  });
});
