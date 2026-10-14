import { inspect } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { handleLead } from '@/lib/handle-lead';
import { createMemoryStore, type LeadStore, type StoredLead } from '@/lib/store';

const T0 = 1_800_000_000_000;

function setup() {
  let t = T0;
  const clock = () => t;
  const store = createMemoryStore(clock);
  const notify = vi.fn<(lead: StoredLead) => Promise<void>>().mockResolvedValue(undefined);
  const deps = { store, notify, now: clock };
  return { store, notify, deps, advance: (s: number) => (t += s * 1000) };
}

function body(over: Record<string, unknown> = {}) {
  return {
    name: 'Анна',
    phone: '+375 29 123-45-67',
    telegram: '',
    interest: 'subscription',
    comment: '',
    idempotencyKey: 'key-0001',
    website: '',
    renderedAt: T0 - 60_000,
    attribution: { utm_source: 'test' },
    ...over,
  };
}

const req = (b: unknown, ip = '1.1.1.1') => ({ body: b, ip });

describe('handleLead', () => {
  it('saves a valid lead and notifies once', async () => {
    const { store, notify, deps } = setup();
    const res = await handleLead(req(body()), deps);
    expect(res).toEqual({ status: 200, body: { ok: true, leadId: 'key-0001' } });
    expect(store.leads()).toHaveLength(1);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(store.leads()[0]);
    expect(store.leads()[0]).toMatchObject({
      leadId: 'key-0001',
      phone: '+375291234567',
      createdAt: new Date(T0).toISOString(),
    });
  });

  it('dedupes the same phone within 10 minutes', async () => {
    const { store, notify, deps, advance } = setup();
    const a = await handleLead(req(body()), deps);
    advance(60);
    const b = await handleLead(req(body({ idempotencyKey: 'key-0002' })), deps);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(b.body.leadId).toBe(a.body.leadId);
    expect(b.body.duplicate).toBe(true);
    expect(store.leads()).toHaveLength(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('saves a second lead for the same phone after 601 s', async () => {
    const { store, deps, advance } = setup();
    await handleLead(req(body()), deps);
    advance(601);
    const b = await handleLead(req(body({ idempotencyKey: 'key-0002' })), deps);
    expect(b.body).toEqual({ ok: true, leadId: 'key-0002' });
    expect(store.leads()).toHaveLength(2);
  });

  it('fakes success for a filled honeypot', async () => {
    const { store, notify, deps } = setup();
    const res = await handleLead(req(body({ website: 'http://spam' })), deps);
    expect(res).toEqual({ status: 200, body: { ok: true, leadId: 'key-0001' } });
    expect(store.leads()).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('fakes success for a fast fill', async () => {
    const { store, notify, deps } = setup();
    const res = await handleLead(
      req(body({ renderedAt: T0, attribution: { submittedAt: String(T0 + 1000) } })),
      deps,
    );
    expect(res).toEqual({ status: 200, body: { ok: true, leadId: 'key-0001' } });
    expect(store.leads()).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not treat a missing submittedAt as a fast fill', async () => {
    const { store, deps } = setup();
    const res = await handleLead(req(body({ renderedAt: T0, attribution: {} })), deps);
    expect(res.status).toBe(200);
    expect(store.leads()).toHaveLength(1);
  });

  it('rate limits the sixth request from one IP only', async () => {
    const { deps } = setup();
    for (let i = 0; i < 5; i++) {
      const r = await handleLead(req(body({ idempotencyKey: `key-i${i}0000` })), deps);
      expect(r.status).toBe(200);
    }
    const sixth = await handleLead(req(body({ idempotencyKey: 'key-six0000' })), deps);
    expect(sixth.status).toBe(429);
    expect(sixth.body).toEqual({
      ok: false,
      message: 'Слишком много попыток. Подождите немного и попробуйте снова.',
    });
    const other = await handleLead(req(body({ idempotencyKey: 'key-sev0000' }), '2.2.2.2'), deps);
    expect(other.status).toBe(200);
  });

  it('rejects an invalid body with 400 and leaves the store untouched', async () => {
    const { store, notify, deps } = setup();
    const res = await handleLead(req(body({ name: '', phone: 'x' })), deps);
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.errors).toBeDefined();
    expect(store.leads()).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('returns 503 and releases the claim when saveLead throws', async () => {
    const { store, notify, deps } = setup();
    let fail = true;
    const flaky: LeadStore = {
      ...store,
      saveLead: async (lead) => {
        if (fail) throw new Error('boom');
        return store.saveLead(lead);
      },
    };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const first = await handleLead(req(body()), { ...deps, store: flaky });
    expect(first.status).toBe(503);
    expect(first.body.ok).toBe(false);
    expect(notify).not.toHaveBeenCalled();
    fail = false;
    const retry = await handleLead(req(body()), { ...deps, store: flaky });
    expect(retry.body).toEqual({ ok: true, leadId: 'key-0001' });
    expect(store.leads()).toHaveLength(1);
    expect(notify).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });

  it('returns 503 when claimPhone throws', async () => {
    const { store, notify, deps } = setup();
    const broken: LeadStore = {
      ...store,
      claimPhone: async () => {
        throw new Error('down');
      },
    };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handleLead(req(body()), { ...deps, store: broken });
    expect(res.status).toBe(503);
    expect(notify).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('fails open when hitRate throws', async () => {
    const { store, deps } = setup();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken: LeadStore = {
      ...store,
      hitRate: async () => {
        throw new Error('down');
      },
    };
    const res = await handleLead(req(body()), { ...deps, store: broken });
    expect(res.status).toBe(200);
    expect(store.leads()).toHaveLength(1);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('returns 200, releases the marker, and notifies on a later replay when the notifier throws', async () => {
    const { store, deps } = setup();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const notify = vi
      .fn<(lead: StoredLead) => Promise<void>>()
      .mockRejectedValueOnce(new Error('telegram down'))
      .mockResolvedValue(undefined);
    const first = await handleLead(req(body()), { ...deps, notify });
    expect(first).toEqual({ status: 200, body: { ok: true, leadId: 'key-0001' } });
    expect(store.leads()).toHaveLength(1);
    expect(err).toHaveBeenCalled();
    const replay = await handleLead(req(body()), { ...deps, notify });
    expect(replay).toEqual({ status: 200, body: { ok: true, leadId: 'key-0001' } });
    expect(notify).toHaveBeenCalledTimes(2);
    const third = await handleLead(req(body()), { ...deps, notify });
    expect(third.status).toBe(200);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(store.leads()).toHaveLength(1);
    err.mockRestore();
  });

  it('notifies anyway when claimNotification throws', async () => {
    const { store, notify, deps } = setup();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken: LeadStore = {
      ...store,
      claimNotification: async () => {
        throw new Error('down');
      },
    };
    const res = await handleLead(req(body()), { ...deps, store: broken });
    expect(res).toEqual({ status: 200, body: { ok: true, leadId: 'key-0001' } });
    expect(notify).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });

  it('keeps one lead and one list entry when a key is replayed after the claim expired, without a second notification', async () => {
    const { store, notify, deps, advance } = setup();
    await handleLead(req(body()), deps);
    advance(601);
    const again = await handleLead(req(body()), deps);
    expect(again).toEqual({ status: 200, body: { ok: true, leadId: 'key-0001' } });
    expect(store.leads()).toHaveLength(1);
    expect(store.leadIds()).toEqual(['key-0001']);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('handles a concurrent double submit with one lead and one notification', async () => {
    const { store, notify, deps } = setup();
    const [a, b] = await Promise.all([
      handleLead(req(body()), deps),
      handleLead(req(body()), deps),
    ]);
    expect(a).toEqual({ status: 200, body: { ok: true, leadId: 'key-0001' } });
    // Same key: the second request sees its own claim, so no duplicate flag.
    expect(b).toEqual({ status: 200, body: { ok: true, leadId: 'key-0001' } });
    expect(store.leads()).toHaveLength(1);
    expect(store.leadIds()).toEqual(['key-0001']);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('saves and notifies when the claim returned is the request own key', async () => {
    const { store, notify, deps } = setup();
    const own: LeadStore = { ...store, claimPhone: async (_p, id) => id };
    const res = await handleLead(req(body()), { ...deps, store: own });
    expect(res).toEqual({ status: 200, body: { ok: true, leadId: 'key-0001' } });
    expect(store.leads()).toHaveLength(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('recovers a retry with the same key after save and release both failed', async () => {
    const { store, notify, deps } = setup();
    let broken = true;
    const flaky: LeadStore = {
      ...store,
      releasePhone: async (p, id) => {
        if (broken) throw new Error('release down');
        return store.releasePhone(p, id);
      },
      saveLead: async (l) => {
        if (broken) throw new Error('save down');
        return store.saveLead(l);
      },
    };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const first = await handleLead(req(body()), { ...deps, store: flaky });
    expect(first.status).toBe(503);
    broken = false;
    const retry = await handleLead(req(body()), { ...deps, store: flaky });
    expect(retry).toEqual({ status: 200, body: { ok: true, leadId: 'key-0001' } });
    expect(store.leads()).toHaveLength(1);
    expect(notify).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });

  it('survives a lost save response: write applied, client threw, retry finishes once', async () => {
    const { store, notify, deps } = setup();
    let first = true;
    const lossy: LeadStore = {
      ...store,
      saveLead: async (l) => {
        await store.saveLead(l);
        if (first) {
          first = false;
          throw new Error('response lost');
        }
      },
    };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = await handleLead(req(body()), { ...deps, store: lossy });
    expect(a.status).toBe(503);
    expect(notify).not.toHaveBeenCalled();
    const b = await handleLead(req(body()), { ...deps, store: lossy });
    expect(b).toEqual({ status: 200, body: { ok: true, leadId: 'key-0001' } });
    expect(store.leads()).toHaveLength(1);
    expect(store.leadIds()).toEqual(['key-0001']);
    expect(notify).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });

  it('release is compare-and-delete: K1 cannot remove K2 claim', async () => {
    const store = createMemoryStore(() => T0);
    await store.claimPhone('+375291234567', 'K2', 600);
    await store.releasePhone('+375291234567', 'K1');
    expect(await store.claimPhone('+375291234567', 'K3', 600)).toBe('K2');
    await store.releasePhone('+375291234567', 'K2');
    expect(await store.claimPhone('+375291234567', 'K3', 600)).toBeNull();
  });

  it('never logs personal data from a Redis error message', async () => {
    const { store, deps } = setup();
    const command =
      'ERR boom, command was: ["EVAL","...","{\\"name\\":\\"Анна\\",\\"phone\\":\\"+375291234567\\"}"]';
    const leaky: LeadStore = {
      ...store,
      saveLead: async () => {
        throw new Error(command);
      },
      releasePhone: async () => {
        throw new Error(command);
      },
    };
    const dump = (calls: unknown[][]) =>
      calls.map((c) => c.map((a) => inspect(a, { depth: 10, showHidden: true })).join(' ')).join('\n');

    // Sanity: the inspector would reveal a raw Error, so the assertion below is not vacuous.
    const probe = vi.spyOn(console, 'error').mockImplementation(() => {});
    console.error('raw', new Error(command));
    expect(dump(probe.mock.calls)).toContain('+375291234567');
    probe.mockRestore();

    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handleLead(req(body()), { ...deps, store: leaky });
    expect(res.status).toBe(503);
    expect(err).toHaveBeenCalled();
    const logged = dump(err.mock.calls);
    expect(logged).not.toContain('+375291234567');
    expect(logged).not.toContain('Анна');
    err.mockRestore();
  });
});
