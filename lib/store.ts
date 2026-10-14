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

/** Error label safe for logs: name plus the message cut before any embedded statement or payload. */
export function safeErrorLabel(error: unknown): string {
  if (!(error instanceof Error)) return 'UnknownError';
  const cut = error.message.split(/command was:|SQL:/)[0].trim();
  return `${error.name}: ${cut}`.slice(0, 200);
}

export type MemoryStore = LeadStore & {
  leads(): StoredLead[];
  leadIds(): string[];
};

export function createMemoryStore(now: () => number = Date.now): MemoryStore {
  const phones = new Map<string, { leadId: string; expiresAt: number }>();
  const saved = new Map<string, StoredLead>();
  const list: string[] = [];
  const notified = new Map<string, number>();
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
      const expiresAt = notified.get(leadId);
      if (expiresAt !== undefined && expiresAt > now()) return false;
      notified.set(leadId, now() + NOTIFY_TTL_SECONDS * 1000);
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
