import { describe, expect, it } from 'vitest';
import { formatPhoneMask, normalizeBelarusPhone } from '@/lib/phone';

describe('normalizeBelarusPhone', () => {
  it.each([
    '+375 29 123-45-67',
    '80291234567',
    '375291234567',
    '29 1234567',
    '+375291234567',
    '8 029 123 45 67',
  ])('accepts %s', (input) => {
    expect(normalizeBelarusPhone(input)).toBe('+375291234567');
  });

  it.each(['25', '29', '33', '44'])('accepts mobile code %s', (code) => {
    expect(normalizeBelarusPhone(`+375 ${code} 123-45-67`)).toBe(`+375${code}1234567`);
  });

  it.each([
    ['landline 17', '+375 17 123-45-67'],
    ['unknown code 99', '+375 99 123-45-67'],
    ['letters', 'abc'],
    ['emoji', '😀'],
    ['punctuation only', '---'],
    ['empty', ''],
    ['whitespace', '   '],
    ['8 subscriber digits', '29 123-45-6'],
    ['10 subscriber digits', '+375 29 123-45-678'],
    ['letters mixed in', 'call me 29abc'],
  ])('rejects %s', (_name, input) => {
    expect(normalizeBelarusPhone(input)).toBeNull();
  });

  it('never throws on odd input', () => {
    for (const s of ['😀😀😀', '+++', '()', '\u0000', 'ё', '٢٩١٢٣٤٥٦٧']) {
      expect(() => normalizeBelarusPhone(s)).not.toThrow();
      expect(normalizeBelarusPhone(s)).toBeNull();
    }
  });
});

describe('formatPhoneMask', () => {
  it('formats a full number', () => {
    expect(formatPhoneMask('291234567')).toBe('+375 29 123-45-67');
  });

  it('formats partial input with a prefix mask', () => {
    expect(formatPhoneMask('')).toBe('');
    expect(formatPhoneMask('2')).toBe('+375 2');
    expect(formatPhoneMask('29')).toBe('+375 29');
    expect(formatPhoneMask('2912')).toBe('+375 29 12');
    expect(formatPhoneMask('291234')).toBe('+375 29 123-4');
    expect(formatPhoneMask('2912345')).toBe('+375 29 123-45');
    expect(formatPhoneMask('29123456')).toBe('+375 29 123-45-6');
  });

  it('ignores country prefixes like normalizeBelarusPhone', () => {
    expect(formatPhoneMask('+375291234567')).toBe('+375 29 123-45-67');
    expect(formatPhoneMask('375291234567')).toBe('+375 29 123-45-67');
    expect(formatPhoneMask('80291234567')).toBe('+375 29 123-45-67');
    expect(formatPhoneMask('8 029 123 45 67')).toBe('+375 29 123-45-67');
    expect(formatPhoneMask('+375 29')).toBe('+375 29');
    expect(formatPhoneMask('80 29')).toBe('+375 29');
  });

  it('truncates extra digits', () => {
    expect(formatPhoneMask('29123456789')).toBe('+375 29 123-45-67');
  });

  it('never throws on junk', () => {
    for (const s of ['abc', '😀', '---', '\u0000']) {
      expect(() => formatPhoneMask(s)).not.toThrow();
      expect(formatPhoneMask(s)).toBe('');
    }
    expect(formatPhoneMask('+')).toBe('+');
  });
});

describe('formatPhoneMask while typing', () => {
  const FULL = '+375 29 123-45-67';
  const type = (seq: string) => {
    let text = '';
    const steps: string[] = [];
    for (const ch of seq) {
      text = formatPhoneMask(text + ch);
      steps.push(text);
    }
    return steps;
  };
  const digitsOnly = (s: string) => s.replace(/[^0-9]/g, '');

  it.each(['+375291234567', '80291234567', '291234567'])('typing %s ends masked', (seq) => {
    const steps = type(seq);
    expect(steps[steps.length - 1]).toBe(FULL);
    for (const s of steps) {
      expect(s).not.toBe('');
      expect(formatPhoneMask(s)).toBe(s); // idempotent
      expect(FULL.startsWith(s) || '+375'.startsWith(s) || /^8?0?$/.test(s)).toBe(true);
    }
    // the masked digits never shrink or get garbled mid-way
    for (let i = 1; i < steps.length; i++) {
      expect(digitsOnly(steps[i]).length).toBeGreaterThanOrEqual(digitsOnly(steps[i - 1]).length);
    }
  });

  it('keeps incomplete prefixes unchanged', () => {
    expect(type('+375').slice(0, 4)).toEqual(['+', '+3', '+37', '+375']);
    expect(type('80')).toEqual(['8', '80']);
    expect(type('+3752')[4]).toBe('+375 2');
    expect(type('8029')[3]).toBe('+375 29');
  });

  it.each(['+375 29 123-45-67', '80291234567', '375291234567', '291234567'])(
    'paste of %s gives full mask',
    (s) => {
      expect(formatPhoneMask(s)).toBe(FULL);
      expect(formatPhoneMask(formatPhoneMask(s))).toBe(FULL);
    },
  );

  it('is idempotent on partial masks', () => {
    for (const s of ['', '2', '29', '2912', '291234', '2912345', '29123456', '+', '+3', '8', '80', '+375']) {
      expect(formatPhoneMask(formatPhoneMask(s))).toBe(formatPhoneMask(s));
    }
  });

  it('bare 375 typed digit by digit is a known limitation (paste works)', () => {
    const steps = type('375291234567');
    expect(steps[0]).toBe('+375 3');
    expect(steps[steps.length - 1]).not.toBe(FULL);
    expect(formatPhoneMask('375291234567')).toBe(FULL);
  });
});

describe('normalizeBelarusPhone extra negatives and traps', () => {
  it.each([
    ['9 digits starting 80', '802912345'],
    ['12 digits not starting 375', '123291234567'],
    ['11 digits not starting 80', '12291234567'],
  ])('rejects %s', (_n, input) => {
    expect(normalizeBelarusPhone(input)).toBeNull();
  });

  it('keeps 375 inside subscriber digits', () => {
    expect(normalizeBelarusPhone('293751234')).toBe('+375293751234');
    expect(normalizeBelarusPhone('337508888')).toBe('+375337508888');
  });
});
