import { parseLead } from '@/lib/lead-schema';
import type { LeadStore, StoredLead } from '@/lib/store';

export type LeadResponse = {
  status: number;
  body: {
    ok: boolean;
    leadId?: string;
    duplicate?: boolean;
    errors?: Record<string, string>;
    message?: string;
  };
};

export type LeadDeps = {
  store: LeadStore;
  notify: (lead: StoredLead) => Promise<void>;
  now: () => number;
};

const CLAIM_TTL_SECONDS = 600;
const RATE_LIMIT = 5;
const MIN_FILL_MS = 3000;
const UNAVAILABLE = 'Сервис временно недоступен. Нажмите «Повторить» или позвоните нам.';
const TOO_MANY = 'Слишком много попыток. Подождите немного и попробуйте снова.';

export async function handleLead(
  req: { body: unknown; ip: string },
  deps: LeadDeps,
): Promise<LeadResponse> {
  const { store, notify, now } = deps;

  const parsed = parseLead(req.body);
  if (!parsed.ok) return { status: 400, body: { ok: false, errors: parsed.errors } };
  const lead = parsed.data;

  const fakeSuccess: LeadResponse = { status: 200, body: { ok: true, leadId: lead.idempotencyKey } };

  if (lead.website !== '') return fakeSuccess;

  // Client-side clocks only: the server clock is never compared to renderedAt.
  const submittedAt = Number(lead.attribution.submittedAt);
  if (
    Number.isFinite(submittedAt) &&
    Number.isFinite(lead.renderedAt) &&
    submittedAt - lead.renderedAt < MIN_FILL_MS
  ) {
    return fakeSuccess;
  }

  try {
    const hits = await store.hitRate(req.ip);
    if (hits > RATE_LIMIT) return { status: 429, body: { ok: false, message: TOO_MANY } };
  } catch (error) {
    console.error('lead: rate limit unavailable, failing open', error);
  }

  const unavailable: LeadResponse = { status: 503, body: { ok: false, message: UNAVAILABLE } };

  let existing: string | null;
  try {
    existing = await store.claimPhone(lead.phone, lead.idempotencyKey, CLAIM_TTL_SECONDS);
  } catch (error) {
    console.error('lead: claim failed', error);
    return unavailable;
  }
  if (existing !== null) {
    return { status: 200, body: { ok: true, leadId: existing, duplicate: true } };
  }

  const stored: StoredLead = {
    leadId: lead.idempotencyKey,
    name: lead.name,
    phone: lead.phone,
    telegram: lead.telegram,
    interest: lead.interest,
    comment: lead.comment,
    attribution: lead.attribution,
    createdAt: new Date(now()).toISOString(),
  };

  try {
    await store.saveLead(stored);
  } catch (error) {
    console.error('lead: save failed', error);
    try {
      await store.releasePhone(lead.phone);
    } catch (releaseError) {
      console.error('lead: release failed', releaseError);
    }
    return unavailable;
  }

  try {
    await notify(stored);
  } catch (error) {
    console.error('lead: notify failed', error);
  }

  return { status: 200, body: { ok: true, leadId: stored.leadId } };
}
