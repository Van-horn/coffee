import { describe, expect, it } from 'vitest';
import { captureAttribution, readAttribution } from '@/lib/attribution';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function fakeStorage(initial: Record<string, string> = {}): Store & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

const throwing: Store = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
};

const HREF = 'https://kvarta.example/?utm_source=ya';

describe('captureAttribution', () => {
  it('captures all tracked params plus landing and referrer', () => {
    const search =
      '?utm_source=ya&utm_medium=cpc&utm_campaign=spring&utm_content=a&utm_term=coffee&yclid=1&ysclid=2&fbclid=3&other=x';
    const result = captureAttribution(search, 'https://ref.example/', HREF, fakeStorage());
    expect(result).toEqual({
      utm_source: 'ya',
      utm_medium: 'cpc',
      utm_campaign: 'spring',
      utm_content: 'a',
      utm_term: 'coffee',
      yclid: '1',
      ysclid: '2',
      fbclid: '3',
      landing: HREF,
      referrer: 'https://ref.example/',
    });
  });

  it('yields only landing and referrer for an empty query string', () => {
    expect(captureAttribution('', '', HREF, fakeStorage())).toEqual({ landing: HREF, referrer: '' });
  });

  it('is first-touch: a second call returns the first values', () => {
    const storage = fakeStorage();
    const first = captureAttribution('?utm_source=ya', 'r1', HREF, storage);
    const second = captureAttribution('?utm_source=other&fbclid=9', 'r2', 'https://x/', storage);
    expect(second).toEqual(first);
    expect(readAttribution(storage)).toEqual(first);
  });

  it('truncates values over 300 characters', () => {
    const result = captureAttribution(`?utm_source=${'a'.repeat(500)}`, '', HREF, fakeStorage());
    expect(result.utm_source).toHaveLength(300);
  });

  it('recovers from corrupt stored JSON', () => {
    const storage = fakeStorage({ kvarta_attr: '{not json' });
    const result = captureAttribution('?utm_source=ya', '', HREF, storage);
    expect(result.utm_source).toBe('ya');
    expect(JSON.parse(storage.data.kvarta_attr).utm_source).toBe('ya');
  });

  it('does not throw when storage throws and returns fresh values', () => {
    expect(() => captureAttribution('?utm_source=ya', '', HREF, throwing)).not.toThrow();
    expect(captureAttribution('?utm_source=ya', 'r', HREF, throwing)).toEqual({
      utm_source: 'ya',
      landing: HREF,
      referrer: 'r',
    });
  });
});

describe('readAttribution', () => {
  it('returns {} when empty, corrupt, or throwing', () => {
    expect(readAttribution(fakeStorage())).toEqual({});
    expect(readAttribution(fakeStorage({ kvarta_attr: 'nope' }))).toEqual({});
    expect(readAttribution(throwing)).toEqual({});
  });
});
