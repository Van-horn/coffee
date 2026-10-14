import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/lead/route';
import type { FileStore } from '@/lib/file-store';
import { getStore, resetStoreForTests } from '@/lib/get-store';

// End to end through the real route and the real SQLite store; only the Telegram HTTP call is faked.
let dir: string;
const fetchMock = vi.fn();

const post = (phone: string, key: string) => {
  const now = Date.now();
  return POST(
    new Request('http://localhost/api/lead', {
      method: 'POST',
      headers: { 'x-forwarded-for': `10.1.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
      body: JSON.stringify({
        name: 'Анна',
        phone,
        interest: 'order',
        comment: 'Две пачки',
        idempotencyKey: key,
        website: '',
        renderedAt: now - 10_000,
        attribution: { submittedAt: String(now) },
      }),
    }),
  );
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kvarta-tg-'));
  vi.stubEnv('LEADS_DB_PATH', join(dir, 'leads.sqlite'));
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
  vi.stubEnv('TELEGRAM_CHAT_ID', '-1001234567890');
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  resetStoreForTests();
});

afterEach(() => {
  (getStore() as FileStore).close();
  resetStoreForTests();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

describe('creating an order sends a Telegram message', () => {
  it('stores the lead and posts one message to the channel', async () => {
    const res = await post('+375291234567', 'order-key-0000001');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, leadId: 'order-key-0000001' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe('https://api.telegram.org/bottest-token/sendMessage');
    const sent = JSON.parse(init.body) as { chat_id: string; text: string };
    expect(sent.chat_id).toBe('-1001234567890');
    expect(sent.text).toContain('Анна');
    expect(sent.text).toContain('+375291234567');
    expect(sent.text).toContain('Две пачки');
    expect((getStore() as FileStore).leads().map((l) => l.leadId)).toEqual(['order-key-0000001']);
  });

  it('a duplicate phone neither stores a second lead nor sends a second message', async () => {
    await post('+375291234567', 'order-key-0000001');
    const dup = await post('+375291234567', 'order-key-0000002');
    expect(await dup.json()).toMatchObject({ ok: true, duplicate: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((getStore() as FileStore).leads()).toHaveLength(1);
  });

  it('still answers 200 and keeps the lead when Telegram is down', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response('{"ok":false}', { status: 400 }));
    const res = await post('+375291234567', 'order-key-0000003');
    expect(res.status).toBe(200);
    expect((getStore() as FileStore).leads()).toHaveLength(1);
  });

  it('sends nothing when the Telegram variables are unset', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await post('+375291234567', 'order-key-0000004');
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
