import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseLead } from '@/lib/lead-schema';
import {
  buildPayload,
  leadFingerprint,
  plural,
  submitLead,
  validateLeadFields,
  type FormValues,
  type LeadPayload,
} from '@/lib/lead-client';

const base: FormValues = {
  name: 'Анна',
  phone: '+375 29 123-45-67',
  telegram: '',
  interest: 'subscription',
  comment: '',
};

// Runs the same values through the server schema and returns its per-field errors.
function serverErrors(values: FormValues): Record<string, string> {
  const result = parseLead({
    ...values,
    idempotencyKey: 'abcdefgh12345678',
    website: '',
    renderedAt: 1,
    attribution: {},
  });
  return result.ok ? {} : result.errors;
}

describe('validateLeadFields parity with the server parseLead', () => {
  const cases: [string, Partial<FormValues>][] = [
    ['valid baseline', {}],
    ['whitespace name', { name: '   ' }],
    ['1-char name', { name: 'А' }],
    ['padded 2-char name', { name: ' Ан ' }],
    ['60-char name', { name: 'а'.repeat(60) }],
    ['61-char name', { name: 'а'.repeat(61) }],
    ['phone +375 spaced', { phone: '+375 29 123-45-67' }],
    ['phone 80 prefix', { phone: '80291234567' }],
    ['phone 375 digits', { phone: '375291234567' }],
    ['phone 9 digits', { phone: '291234567' }],
    ['landline', { phone: '+375 17 123-45-67' }],
    ['letters', { phone: 'abc' }],
    ['empty phone', { phone: '' }],
    ['nick anna (short)', { telegram: 'anna' }],
    ['nick @anna_minsk', { telegram: '@anna_minsk' }],
    ['nick @@x', { telegram: '@@x' }],
    ['nick 1anna_', { telegram: '1anna_' }],
    ['nick padded', { telegram: '  @anna_minsk  ' }],
    ['nick 32 chars', { telegram: 'a' + 'b'.repeat(31) }],
    ['nick 33 chars', { telegram: 'a' + 'b'.repeat(32) }],
    ['comment 500', { comment: 'x'.repeat(500) }],
    ['comment 501', { comment: 'x'.repeat(501) }],
    ['comment 500 + trailing spaces', { comment: 'x'.repeat(500) + '   ' }],
    ['interest order', { interest: 'order' }],
    ['interest question', { interest: 'question' }],
    ['bad interest', { interest: 'bogus' }],
    ['empty interest', { interest: '' }],
    ['everything wrong', { name: '', phone: '1', telegram: 'x', interest: 'z', comment: 'y'.repeat(501) }],
  ];

  it.each(cases)('%s', (_label, patch) => {
    const values = { ...base, ...patch };
    expect(validateLeadFields(values)).toEqual(serverErrors(values));
  });
});

describe('buildPayload', () => {
  const ctx = {
    idempotencyKey: 'key-12345678',
    renderedAt: 1000,
    website: '',
    attribution: { utm_source: 'ya' },
    now: 5000,
  };

  it('trims, normalizes the phone, strips @ and adds submittedAt', () => {
    const payload = buildPayload(
      { ...base, name: '  Анна ', telegram: ' @anna_minsk ', comment: ' hi ', phone: '80291234567' },
      ctx,
    );
    expect(payload).toEqual({
      name: 'Анна',
      phone: '+375291234567',
      telegram: 'anna_minsk',
      interest: 'subscription',
      comment: 'hi',
      idempotencyKey: 'key-12345678',
      website: '',
      renderedAt: 1000,
      attribution: { utm_source: 'ya', submittedAt: '5000' },
    });
  });

  it('defaults submittedAt to the current clock', () => {
    const payload = buildPayload(base, { ...ctx, now: undefined });
    expect(Number(payload.attribution.submittedAt)).toBeGreaterThan(1_000_000_000_000);
  });
});

describe('plural', () => {
  it.each([
    [1, 'поле'],
    [2, 'поля'],
    [4, 'поля'],
    [5, 'полей'],
    [11, 'полей'],
    [12, 'полей'],
    [21, 'поле'],
    [22, 'поля'],
    [25, 'полей'],
    [0, 'полей'],
    [14, 'полей'],
    [111, 'полей'],
    [101, 'поле'],
  ])('%i -> %s', (n, word) => {
    expect(plural(n, 'поле', 'поля', 'полей')).toBe(word);
  });
});

describe('submitLead', () => {
  const payload: LeadPayload = buildPayload(base, {
    idempotencyKey: 'key-12345678',
    renderedAt: 1,
    website: '',
    attribution: {},
  });
  const json = (status: number, body: unknown) =>
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

  afterEach(() => vi.useRealTimers());

  it('200 ok', async () => {
    const fetchImpl = json(200, { ok: true, leadId: 'L1' });
    expect(await submitLead(payload, fetchImpl)).toEqual({ kind: 'ok', leadId: 'L1', duplicate: false });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/lead');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(payload);
  });

  it('200 duplicate is success', async () => {
    const r = await submitLead(payload, json(200, { ok: true, leadId: 'L1', duplicate: true }));
    expect(r).toEqual({ kind: 'ok', leadId: 'L1', duplicate: true });
  });

  it('400 with errors', async () => {
    const r = await submitLead(payload, json(400, { ok: false, errors: { phone: 'bad' } }));
    expect(r).toEqual({ kind: 'invalid', errors: { phone: 'bad' } });
  });

  it('429 uses the server message', async () => {
    const r = await submitLead(payload, json(429, { ok: false, message: 'Слишком много заявок' }));
    expect(r).toMatchObject({ kind: 'failed', message: 'Слишком много заявок' });
  });

  it('503 is retryable', async () => {
    const r = await submitLead(payload, json(503, { ok: false, message: 'Сервис недоступен' }));
    expect(r).toEqual({ kind: 'failed', message: 'Сервис недоступен' });
  });

  it('network error is retryable with a generic message', async () => {
    const r = await submitLead(payload, vi.fn().mockRejectedValue(new TypeError('fail')));
    expect(r).toEqual({ kind: 'failed', message: 'Не удалось отправить заявку' });
  });

  it('non-JSON body is a failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>', { status: 502 }));
    const r = await submitLead(payload, fetchImpl);
    expect(r).toMatchObject({ kind: 'failed', message: 'Не удалось отправить заявку' });
  });

  it('times out through AbortController', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const pending = submitLead(payload, fetchImpl as unknown as typeof fetch, 15000);
    await vi.advanceTimersByTimeAsync(15000);
    expect(await pending).toEqual({ kind: 'failed', message: 'Не удалось отправить заявку' });
  });
});

describe('leadFingerprint', () => {
  const ctx = { idempotencyKey: 'key-12345678', renderedAt: 1, website: '', attribution: {} };
  it('ignores formatting and key, changes with content', () => {
    const a = buildPayload(base, ctx);
    const b = buildPayload({ ...base, phone: '80291234567', name: ' Анна ' }, { ...ctx, idempotencyKey: 'other-key-1234' });
    expect(leadFingerprint(a)).toBe(leadFingerprint(b));
    expect(leadFingerprint(buildPayload({ ...base, phone: '+375 33 111-22-33' }, ctx))).not.toBe(leadFingerprint(a));
    expect(leadFingerprint(buildPayload({ ...base, comment: 'x' }, ctx))).not.toBe(leadFingerprint(a));
  });
});
