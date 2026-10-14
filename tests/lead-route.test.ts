import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/get-store', async () => {
  const { createMemoryStore } = await import('@/lib/store');
  const store = createMemoryStore();
  return { getStore: () => store };
});

import { POST } from '@/app/api/lead/route';

const post = (body: string) =>
  POST(new Request('http://localhost/api/lead', { method: 'POST', body }));

describe('POST /api/lead', () => {
  it('returns 413 for an oversized body', async () => {
    const res = await post('x'.repeat(10_001));
    expect(res.status).toBe(413);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect((await res.json()).ok).toBe(false);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await post('{nope');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, errors: { body: 'Некорректный запрос' } });
  });
});
