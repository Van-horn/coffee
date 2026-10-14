import { describe, expect, it } from 'vitest';
import { parseLead } from '@/lib/lead-schema';

const valid = {
  name: 'Анна',
  phone: '+375 29 123-45-67',
  interest: 'subscription',
  comment: '',
  idempotencyKey: 'abcd1234-efgh',
  website: '',
  renderedAt: 1_700_000_000_000,
};

function errorsOf(patch: Record<string, unknown>) {
  const r = parseLead({ ...valid, ...patch });
  if (r.ok) throw new Error('expected failure');
  return r.errors;
}

describe('parseLead', () => {
  it('parses a valid payload with defaults', () => {
    const r = parseLead(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.phone).toBe('+375291234567');
      expect(r.data.attribution).toEqual({});
      expect(r.data.comment).toBe('');
    }
  });

  it('ignores unknown top-level keys', () => {
    expect(parseLead({ ...valid, extra: 1 }).ok).toBe(true);
  });

  it('rejects whitespace-only and too short names', () => {
    expect(errorsOf({ name: '   ' }).name).toBe('Укажите имя: от 2 до 60 символов');
    expect(errorsOf({ name: 'А' }).name).toBeDefined();
    expect(errorsOf({ name: 'а'.repeat(61) }).name).toBeDefined();
  });

  it('trims the name', () => {
    const r = parseLead({ ...valid, name: '  Анна  ' });
    expect(r.ok && r.data.name).toBe('Анна');
  });

  it('comment: 500 passes, 501 fails', () => {
    expect(parseLead({ ...valid, comment: 'a'.repeat(500) }).ok).toBe(true);
    expect(errorsOf({ comment: 'a'.repeat(501) }).comment).toBe(
      'Комментарий не длиннее 500 символов',
    );
  });

  it.each(['+375 29 123-45-67', '80291234567'])('phone %s normalizes', (phone) => {
    const r = parseLead({ ...valid, phone });
    expect(r.ok && r.data.phone).toBe('+375291234567');
  });

  it.each(['abc', '😀😀😀', ''])('invalid phone %j', (phone) => {
    expect(errorsOf({ phone }).phone).toBe(
      'Проверьте номер: нужен белорусский, например +375 29 123-45-67',
    );
  });

  it('ignores a telegram key sent by an old client', () => {
    const r = parseLead({ ...valid, telegram: '@anna_minsk' });
    expect(r.ok).toBe(true);
    if (r.ok) expect('telegram' in r.data).toBe(false);
    expect(parseLead({ ...valid, telegram: 'x' }).ok).toBe(true);
    expect(parseLead({ ...valid, telegram: 42 }).ok).toBe(true);
  });

  it('rejects unknown interest', () => {
    expect(errorsOf({ interest: 'free' }).interest).toBe('Выберите, что вас интересует');
  });

  it('idempotencyKey rules', () => {
    expect(errorsOf({ idempotencyKey: 'abcd 1234' }).idempotencyKey).toBeDefined();
    expect(errorsOf({ idempotencyKey: 'abc:1234' }).idempotencyKey).toBeDefined();
    expect(errorsOf({ idempotencyKey: 'short' }).idempotencyKey).toBeDefined();
  });

  it('renderedAt must be a finite non-negative number', () => {
    expect(errorsOf({ renderedAt: '123' }).renderedAt).toBeDefined();
    expect(errorsOf({ renderedAt: NaN }).renderedAt).toBeDefined();
    expect(errorsOf({ renderedAt: -1 }).renderedAt).toBeDefined();
  });

  it('attribution: drops unknown/non-string keys, truncates values', () => {
    const r = parseLead({
      ...valid,
      attribution: { utm_source: 'x'.repeat(400), evil: 'y', yclid: 5 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.data.attribution)).toEqual(['utm_source']);
      expect(r.data.attribution.utm_source).toHaveLength(300);
    }
  });

  it.each([null, 'x', [], 5, undefined])('non-object body %j returns ok:false', (body) => {
    expect(() => parseLead(body)).not.toThrow();
    expect(parseLead(body).ok).toBe(false);
  });
});
