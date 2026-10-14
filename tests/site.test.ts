import { describe, expect, it } from 'vitest';
import { resolveSiteUrl } from '@/lib/site';

describe('resolveSiteUrl', () => {
  it('adds https:// to a scheme-less value', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'kvarta.vercel.app' })).toBe('https://kvarta.vercel.app');
  });

  it('keeps an explicit scheme', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'http://example.test' })).toBe('http://example.test');
  });

  it('treats empty and whitespace as unset and falls through to the Vercel variable', () => {
    for (const v of ['', '   ']) {
      expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: v, VERCEL_PROJECT_PRODUCTION_URL: 'kvarta.vercel.app' })).toBe(
        'https://kvarta.vercel.app',
      );
    }
  });

  it('falls back to localhost when both are unset or empty', () => {
    expect(resolveSiteUrl({})).toBe('http://localhost:3000');
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: '', VERCEL_PROJECT_PRODUCTION_URL: '' })).toBe(
      'http://localhost:3000',
    );
  });

  it('normalizes a trailing slash or path to the origin only', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://kvarta.by/' })).toBe('https://kvarta.by');
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://kvarta.by/ru/page?x=1' })).toBe('https://kvarta.by');
  });

  it('falls back to localhost on garbage without throwing', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'http://' })).toBe('http://localhost:3000');
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'ht!tp:// bad host' })).toBe('http://localhost:3000');
  });

  it('trims and lowercases the input', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: '  Kvarta.VERCEL.app  ' })).toBe('https://kvarta.vercel.app');
  });
});
