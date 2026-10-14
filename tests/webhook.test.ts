import { inspect } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  store: undefined as undefined | import('@/lib/store').MemoryStore,
  send: vi.fn(),
}));

vi.mock('@/lib/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/store')>();
  h.store = actual.createMemoryStore();
  return { ...actual, createUpstashStore: () => h.store! };
});

vi.mock('@/lib/telegram', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/telegram')>();
  return { ...actual, sendTelegramMessage: h.send };
});

import { POST } from '@/app/api/telegram/webhook/route';
import type { StoredLead } from '@/lib/store';

const SECRET = 'whsec_0123456789abcdef';
const TOKEN = '123456:SECRET-token_abc';
const CHAT_ID = 777123456;

let seq = 0;
const newLeadId = () => `lead-${String(++seq).padStart(4, '0')}-abcdef`;

async function seed(over: Partial<StoredLead> = {}): Promise<StoredLead> {
  const lead: StoredLead = {
    leadId: newLeadId(),
    name: 'Анна',
    phone: '+375291234567',
    telegram: '',
    interest: 'subscription',
    comment: 'комментарий',
    attribution: {},
    createdAt: '2026-10-12T09:00:00.000Z',
    ...over,
  };
  await h.store!.saveLead(lead);
  return lead;
}

const startUpdate = (text: string, chat: Record<string, unknown> = { id: CHAT_ID, type: 'private' }) => ({
  update_id: 1,
  message: { message_id: 5, date: 1, text, chat, from: { id: CHAT_ID, first_name: 'Анна' } },
});

function call(body: unknown, headers: Record<string, string> = { 'x-telegram-bot-api-secret-token': SECRET }) {
  return POST(
    new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

const logs = () => {
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
  return () => inspect(spies.map((s) => s.mock.calls), { showHidden: true, depth: 10 });
};

beforeEach(() => {
  h.send.mockReset();
  h.send.mockResolvedValue(undefined);
  vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', SECRET);
  vi.stubEnv('TELEGRAM_BOT_TOKEN', TOKEN);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('webhook authentication', () => {
  it('rejects a missing header with 401 and reads nothing', async () => {
    const lead = await seed();
    const res = await call(startUpdate(`/start ${lead.leadId}`), {});
    expect(res.status).toBe(401);
    expect(h.send).not.toHaveBeenCalled();
  });

  it('rejects a wrong header with 401', async () => {
    const lead = await seed();
    const res = await call(startUpdate(`/start ${lead.leadId}`), { 'x-telegram-bot-api-secret-token': 'nope' });
    expect(res.status).toBe(401);
    expect(h.send).not.toHaveBeenCalled();
  });

  it('rejects a header of a different length without throwing', async () => {
    for (const value of ['x', `${SECRET}x`, SECRET.slice(0, -1), 'x'.repeat(5000)]) {
      const res = await call({}, { 'x-telegram-bot-api-secret-token': value });
      expect(res.status).toBe(401);
    }
  });

  it('fails closed with 401 for everything when the secret is not configured', async () => {
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', '');
    const lead = await seed();
    expect((await call(startUpdate(`/start ${lead.leadId}`), { 'x-telegram-bot-api-secret-token': '' })).status).toBe(401);
    expect((await call(startUpdate(`/start ${lead.leadId}`))).status).toBe(401);
    expect((await call(startUpdate(`/start ${lead.leadId}`), {})).status).toBe(401);
    expect(h.send).not.toHaveBeenCalled();
  });

  it('answers 401 before it looks at an oversized body', async () => {
    const res = await call('x'.repeat(20_001), {});
    expect(res.status).toBe(401);
  });
});

describe('webhook body handling', () => {
  it('returns 413 over the cap', async () => {
    const res = await call('x'.repeat(20_001));
    expect(res.status).toBe(413);
    expect(h.send).not.toHaveBeenCalled();
  });

  it('answers 200 to invalid JSON without sending', async () => {
    const res = await call('{not json');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(h.send).not.toHaveBeenCalled();
  });

  it.each([['null'], ['[]'], ['"text"'], ['42'], ['{"message":"x"}'], ['{"message":{"text":5,"chat":{"id":1,"type":"private"}}}']])(
    'ignores the odd shape %s',
    async (raw) => {
      const res = await call(raw);
      expect(res.status).toBe(200);
      expect(h.send).not.toHaveBeenCalled();
    },
  );
});

describe('webhook /start flow', () => {
  it('sends exactly one confirmation to the private chat with the escaped name and masked phone', async () => {
    const lead = await seed();
    const res = await call(startUpdate(`/start ${lead.leadId}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(h.send).toHaveBeenCalledTimes(1);
    const [chat, text] = h.send.mock.calls[0];
    expect(chat).toBe(CHAT_ID);
    expect(text).toContain('Анна');
    expect(text).toContain('+375 29 ***-**-67');
  });

  it('accepts the /start@botname form', async () => {
    const lead = await seed();
    await call(startUpdate(`/start@kvarta_bot ${lead.leadId}`));
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it('never sends a second message for the same lead', async () => {
    const lead = await seed();
    await call(startUpdate(`/start ${lead.leadId}`));
    const again = await call(startUpdate(`/start ${lead.leadId}`));
    expect(again.status).toBe(200);
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it('does not send twice for concurrent identical updates', async () => {
    const lead = await seed();
    await Promise.all([call(startUpdate(`/start ${lead.leadId}`)), call(startUpdate(`/start ${lead.leadId}`))]);
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it('escapes a hostile name', async () => {
    const lead = await seed({ name: '<b>x</b>&' });
    await call(startUpdate(`/start ${lead.leadId}`));
    const text = h.send.mock.calls[0][1] as string;
    expect(text).toContain('&lt;b&gt;x&lt;/b&gt;&amp;');
    expect(text).not.toContain('<b>');
  });

  it('answers 200 without a reply for an unknown lead', async () => {
    const res = await call(startUpdate('/start unknown-lead-id'));
    expect(res.status).toBe(200);
    expect(h.send).not.toHaveBeenCalled();
  });

  it('releases the marker when the send fails, still answers 200, and a later Start succeeds', async () => {
    const lead = await seed();
    const getLogs = logs();
    h.send.mockRejectedValueOnce(new Error('telegram send failed: 500'));
    const first = await call(startUpdate(`/start ${lead.leadId}`));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true });
    expect(h.send).toHaveBeenCalledTimes(1);
    const second = await call(startUpdate(`/start ${lead.leadId}`));
    expect(second.status).toBe(200);
    expect(h.send).toHaveBeenCalledTimes(2);
    const third = await call(startUpdate(`/start ${lead.leadId}`));
    expect(third.status).toBe(200);
    expect(h.send).toHaveBeenCalledTimes(2);
    expect(getLogs()).toContain('telegram send failed');
  });

  it('answers 200 and logs a safe label when the store throws', async () => {
    const getLogs = logs();
    const spy = vi.spyOn(h.store!, 'getLead').mockRejectedValueOnce(new Error('boom, command was: ["GET","lead:x"]'));
    const res = await call(startUpdate('/start some-lead-id-1'));
    expect(res.status).toBe(200);
    expect(h.send).not.toHaveBeenCalled();
    expect(getLogs()).not.toContain('command was');
    spy.mockRestore();
  });
});

describe('webhook ignorable updates', () => {
  it.each([
    ['/start without a payload', '/start'],
    ['/start with a blank payload', '/start   '],
    ['a too short payload', '/start abc'],
    ['a payload with illegal characters', '/start lead$$$$$$$$'],
    ['a too long payload', `/start ${'a'.repeat(65)}`],
    ['plain text', 'привет'],
    ['another command', '/help lead-0001-abcdef'],
    ['a start with trailing text', '/start lead-0001-abcdef extra'],
  ])('replies to nothing for %s', async (_name, text) => {
    await seed();
    const res = await call(startUpdate(text));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(h.send).not.toHaveBeenCalled();
  });

  it.each([['group'], ['supergroup'], ['channel']])('ignores a %s chat', async (type) => {
    const lead = await seed();
    const res = await call(startUpdate(`/start ${lead.leadId}`, { id: -100123, type }));
    expect(res.status).toBe(200);
    expect(h.send).not.toHaveBeenCalled();
  });

  it.each([[1.5], ['777'], [Number.MAX_SAFE_INTEGER + 2], [null]])('ignores the chat id %s', async (id) => {
    const lead = await seed();
    const res = await call(startUpdate(`/start ${lead.leadId}`, { id, type: 'private' }));
    expect(res.status).toBe(200);
    expect(h.send).not.toHaveBeenCalled();
  });

  it('ignores edited_message and callback_query', async () => {
    const lead = await seed();
    const edited = { update_id: 2, edited_message: startUpdate(`/start ${lead.leadId}`).message };
    const callback = {
      update_id: 3,
      callback_query: { id: '1', data: `/start ${lead.leadId}`, message: startUpdate('x').message },
    };
    expect((await call(edited)).status).toBe(200);
    expect((await call(callback)).status).toBe(200);
    expect(h.send).not.toHaveBeenCalled();
  });
});

describe('webhook logging', () => {
  it('never logs the token, chat id, name or phone', async () => {
    const getLogs = logs();
    const lead = await seed({ name: 'Секретова' });
    h.send.mockRejectedValueOnce(new Error('telegram send failed: 403 Forbidden'));
    await call(startUpdate(`/start ${lead.leadId}`));
    await call(startUpdate(`/start ${lead.leadId}`));
    await call('{bad');
    const out = getLogs();
    expect(out).not.toMatch(/SECRET-token|123456:|777123456|Секретова|375291234567|\+375/);
    expect(out).toContain('webhook');
  });
});

describe('webhook hardening (fix round 1)', () => {
  it('rejects by content-length before reading the body', async () => {
    const lead = await seed();
    const res = await POST(
      new Request('http://localhost/api/telegram/webhook', {
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': SECRET, 'content-length': '20001' },
        body: JSON.stringify(startUpdate(`/start ${lead.leadId}`)),
      }),
    );
    expect(res.status).toBe(413);
    expect(h.send).not.toHaveBeenCalled();
  });

  it('caps an endless body without content-length while reading it', async () => {
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new TextEncoder().encode('x'.repeat(1000)));
      },
    });
    const res = await POST(
      new Request('http://localhost/api/telegram/webhook', {
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': SECRET },
        body: stream,
        duplex: 'half',
      } as RequestInit),
    );
    expect(res.status).toBe(413);
    expect(pulls).toBeLessThan(100);
  });

  it('ignores a /start sent by a bot account', async () => {
    const lead = await seed();
    const update = startUpdate(`/start ${lead.leadId}`);
    (update.message as Record<string, unknown>).from = { id: 5, is_bot: true, first_name: 'x' };
    expect((await call(update)).status).toBe(200);
    expect(h.send).not.toHaveBeenCalled();
  });

  it('ignores a forwarded message', async () => {
    const lead = await seed();
    const update = startUpdate(`/start ${lead.leadId}`);
    (update.message as Record<string, unknown>).forward_origin = { type: 'user', date: 1 };
    expect((await call(update)).status).toBe(200);
    expect(h.send).not.toHaveBeenCalled();
  });

  it('sends nothing when the stored lead id differs from the requested one', async () => {
    const lead = await seed();
    const spy = vi.spyOn(h.store!, 'getLead').mockResolvedValueOnce({ ...lead, leadId: 'some-other-lead-id' });
    expect((await call(startUpdate(`/start ${lead.leadId}`))).status).toBe(200);
    expect(h.send).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('claims and releases the marker by the requested id', async () => {
    const lead = await seed();
    const claim = vi.spyOn(h.store!, 'claimBotGreeting');
    const release = vi.spyOn(h.store!, 'releaseBotGreeting');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.send.mockRejectedValueOnce(new Error('telegram send failed: 500'));
    await call(startUpdate(`/start ${lead.leadId}`));
    expect(claim).toHaveBeenCalledWith(lead.leadId);
    expect(release).toHaveBeenCalledWith(lead.leadId);
  });

  it('never logs the lead id during webhook failures', async () => {
    const getLogs = logs();
    const lead = await seed({ leadId: 'LEAD-SECRET-ID-1234' });
    // 1) send fails
    h.send.mockRejectedValueOnce(new Error('telegram send failed: 500'));
    await call(startUpdate(`/start ${lead.leadId}`));
    // 2) the store throws with the command payload embedded in the message
    const getSpy = vi
      .spyOn(h.store!, 'getLead')
      .mockRejectedValueOnce(new Error('down, command was: ["GET","lead:LEAD-SECRET-ID-1234"]'));
    await call(startUpdate(`/start ${lead.leadId}`));
    getSpy.mockRestore();
    // 3) send fails and the release fails too
    const relSpy = vi.spyOn(h.store!, 'releaseBotGreeting').mockRejectedValueOnce(new Error('redis down'));
    h.send.mockRejectedValueOnce(new Error('telegram send failed: 500'));
    await call(startUpdate(`/start ${lead.leadId}`));
    relSpy.mockRestore();
    const out = getLogs();
    expect(out).toContain('telegram webhook');
    expect(out).not.toContain('LEAD-SECRET-ID-1234');
  });
});
