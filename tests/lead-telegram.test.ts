import { inspect } from 'node:util';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/lead/route';
import type { FileStore } from '@/lib/file-store';
import { getStore, resetStoreForTests } from '@/lib/get-store';

// End to end through the real route and the real SQLite store; only the Telegram HTTP call is faked.
const PRIVATE_ID = '-1009876543210';
const CHANNEL_ID = '-1001234567890';
const PERSONAL = ['Анна', '+375291234567', 'Две пачки'];
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

type Sent = { chat_id: string; text: string };
const sent = (): Sent[] =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse((init as { body: string }).body) as Sent);
const toChat = (id: string) => sent().filter((m) => m.chat_id === id);
const failFor = (id: string) =>
  fetchMock.mockImplementation(async (_url: string, init: { body: string }) =>
    (JSON.parse(init.body) as Sent).chat_id === id
      ? new Response('{"ok":false}', { status: 400 })
      : new Response('{"ok":true}', { status: 200 }),
  );
const leadIds = () => (getStore() as FileStore).leads().map((l) => l.leadId);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kvarta-tg-'));
  vi.stubEnv('LEADS_DB_PATH', join(dir, 'leads.sqlite'));
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
  vi.stubEnv('TELEGRAM_CHAT_ID', PRIVATE_ID);
  vi.stubEnv('TELEGRAM_CHANNEL_ID', CHANNEL_ID);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response('{"ok":true}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  resetStoreForTests();
});

afterEach(() => {
  (getStore() as FileStore).close();
  resetStoreForTests();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

describe('creating an order sends the Telegram messages', () => {
  it('stores the lead, sends the full text to the private chat and an anonymized post to the channel', async () => {
    const res = await post('+375291234567', 'order-key-0000001');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, leadId: 'order-key-0000001' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.telegram.org/bottest-token/sendMessage');
    const priv = toChat(PRIVATE_ID);
    const pub = toChat(CHANNEL_ID);
    expect(priv).toHaveLength(1);
    expect(pub).toHaveLength(1);
    for (const part of PERSONAL) expect(priv[0].text).toContain(part);
    for (const part of [...PERSONAL, 'order-key-0000001']) expect(pub[0].text).not.toContain(part);
    expect(leadIds()).toEqual(['order-key-0000001']);
  });

  it('a duplicate phone neither stores a second lead nor sends a second pair', async () => {
    await post('+375291234567', 'order-key-0000001');
    const dup = await post('+375291234567', 'order-key-0000002');
    expect(await dup.json()).toMatchObject({ ok: true, duplicate: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(leadIds()).toHaveLength(1);
  });

  it('answers 200 and keeps the lead when the private target fails', async () => {
    failFor(PRIVATE_ID);
    const res = await post('+375291234567', 'order-key-0000003');
    expect(res.status).toBe(200);
    expect(leadIds()).toEqual(['order-key-0000003']);
    expect(console.error).toHaveBeenCalled();
  });

  it('answers 200 when only the channel post fails, and the private message was still sent', async () => {
    failFor(CHANNEL_ID);
    const res = await post('+375291234567', 'order-key-0000004');
    expect(res.status).toBe(200);
    expect(leadIds()).toEqual(['order-key-0000004']);
    expect(toChat(PRIVATE_ID)).toHaveLength(1);
    expect(toChat(PRIVATE_ID)[0].text).toContain('+375291234567');
  });

  it('sends one anonymized request when only the channel is configured', async () => {
    vi.stubEnv('TELEGRAM_CHAT_ID', '');
    const res = await post('+375291234567', 'order-key-0000005');
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const all = sent();
    expect(all[0].chat_id).toBe(CHANNEL_ID);
    for (const part of PERSONAL) expect(all[0].text).not.toContain(part);
  });

  it('sends only the anonymized post, and the full text nowhere, when both ids are equal', async () => {
    vi.stubEnv('TELEGRAM_CHAT_ID', CHANNEL_ID);
    const res = await post('+375291234567', 'order-key-0000006');
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent()[0].chat_id).toBe(CHANNEL_ID);
    const everything = inspect(fetchMock.mock.calls, { showHidden: true, depth: null, maxStringLength: null });
    for (const part of [...PERSONAL, 'order-key-0000006']) expect(everything).not.toContain(part);
  });

  it('sends nothing when the Telegram variables are unset', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    vi.stubEnv('TELEGRAM_CHAT_ID', '');
    vi.stubEnv('TELEGRAM_CHANNEL_ID', '');
    const res = await post('+375291234567', 'order-key-0000007');
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(leadIds()).toHaveLength(1);
  });
});
