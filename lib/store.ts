import { Redis } from '@upstash/redis';

export type StoredLead = {
  leadId: string;
  name: string;
  phone: string;
  interest: 'subscription' | 'order' | 'question';
  comment: string;
  attribution: Record<string, string>;
  createdAt: string; // ISO
};

export interface LeadStore {
  /** null when the phone was claimed now, otherwise the leadId that holds the claim. */
  claimPhone(e164: string, leadId: string, ttlSeconds: number): Promise<string | null>;
  /** Compare-and-delete: removes the claim only if it is still held by leadId. */
  releasePhone(e164: string, leadId: string): Promise<void>;
  /** Atomic and idempotent per leadId: stores and lists the lead at most once. */
  saveLead(lead: StoredLead): Promise<void>;
  /** true when this caller now owns the right to notify about leadId (marker lives 7 days). */
  claimNotification(leadId: string): Promise<boolean>;
  releaseNotification(leadId: string): Promise<void>;
  /** Requests from this ip in the current 600 s window, including this one. */
  hitRate(ip: string): Promise<number>;
}

const RATE_WINDOW_SECONDS = 600;
const NOTIFY_TTL_SECONDS = 604_800;

const SAVE_LEAD_SCRIPT = `
if redis.call('SET', KEYS[1], ARGV[1], 'NX') then
  redis.call('LPUSH', KEYS[2], ARGV[2])
  return 1
end
return 0`;

const RELEASE_PHONE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0`;

/** Error label safe for logs: name plus message cut before Upstash's embedded command payload. */
export function safeErrorLabel(error: unknown): string {
  if (!(error instanceof Error)) return 'UnknownError';
  const cut = error.message.split('command was:')[0].trim();
  return `${error.name}: ${cut}`.slice(0, 200);
}

export function createUpstashStore(): LeadStore {
  let redis: Redis | undefined;
  const client = () => (redis ??= Redis.fromEnv());

  return {
    async claimPhone(e164, leadId, ttlSeconds) {
      const key = `phone:${e164}`;
      const r = client();
      const set = await r.set(key, leadId, { nx: true, ex: ttlSeconds });
      if (set === 'OK') return null;
      const existing = await r.get<string>(key);
      // The claim may have expired between SET and GET: treat as newly claimed by retrying once.
      if (existing === null || existing === undefined) {
        const retry = await r.set(key, leadId, { nx: true, ex: ttlSeconds });
        if (retry === 'OK') return null;
        const again = await r.get<string>(key);
        if (again === null || again === undefined) throw new Error('claim key expired repeatedly');
        return String(again);
      }
      return String(existing);
    },

    async releasePhone(e164, leadId) {
      await client().eval(RELEASE_PHONE_SCRIPT, [`phone:${e164}`], [leadId]);
    },

    async saveLead(lead) {
      await client().eval(
        SAVE_LEAD_SCRIPT,
        [`lead:${lead.leadId}`, 'leads'],
        [JSON.stringify(lead), lead.leadId],
      );
    },

    async claimNotification(leadId) {
      const set = await client().set(`notify:${leadId}`, '1', { nx: true, ex: NOTIFY_TTL_SECONDS });
      return set === 'OK';
    },

    async releaseNotification(leadId) {
      await client().del(`notify:${leadId}`);
    },

    async hitRate(ip) {
      const r = client();
      const key = `rl:${ip}`;
      // One atomic request: INCR and EXPIRE NX, so the key can never be left without a TTL.
      const [count] = await r.multi().incr(key).expire(key, RATE_WINDOW_SECONDS, 'NX').exec<[number, number]>();
      return count;
    },
  };
}

export type MemoryStore = LeadStore & {
  leads(): StoredLead[];
  leadIds(): string[];
};

export function createMemoryStore(now: () => number = Date.now): MemoryStore {
  const phones = new Map<string, { leadId: string; expiresAt: number }>();
  const saved = new Map<string, StoredLead>();
  const list: string[] = [];
  const notified = new Set<string>();
  const rates = new Map<string, { count: number; expiresAt: number }>();

  return {
    async claimPhone(e164, leadId, ttlSeconds) {
      const current = phones.get(e164);
      if (current && current.expiresAt > now()) return current.leadId;
      phones.set(e164, { leadId, expiresAt: now() + ttlSeconds * 1000 });
      return null;
    },

    async releasePhone(e164, leadId) {
      if (phones.get(e164)?.leadId === leadId) phones.delete(e164);
    },

    async saveLead(lead) {
      if (saved.has(lead.leadId)) return;
      saved.set(lead.leadId, lead);
      list.unshift(lead.leadId);
    },

    async claimNotification(leadId) {
      if (notified.has(leadId)) return false;
      notified.add(leadId);
      return true;
    },

    async releaseNotification(leadId) {
      notified.delete(leadId);
    },

    async hitRate(ip) {
      const current = rates.get(ip);
      if (current && current.expiresAt > now()) {
        current.count += 1;
        return current.count;
      }
      rates.set(ip, { count: 1, expiresAt: now() + RATE_WINDOW_SECONDS * 1000 });
      return 1;
    },

    leads: () => [...saved.values()],
    leadIds: () => [...list],
  };
}
