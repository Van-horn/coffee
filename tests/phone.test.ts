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
    for (const s of ['abc', '😀', '---', '+', '\u0000']) {
      expect(() => formatPhoneMask(s)).not.toThrow();
      expect(formatPhoneMask(s)).toBe('');
    }
  });
});
