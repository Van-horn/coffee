const STORAGE_KEY = 'kvarta_attr';
const MAX_LEN = 300;
const PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'yclid',
  'ysclid',
  'fbclid',
] as const;

type AttributionStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readAttribution(storage: AttributionStorage): Record<string, string> {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') out[k] = v.slice(0, MAX_LEN);
    }
    return out;
  } catch {
    return {};
  }
}

export function captureAttribution(
  search: string,
  referrer: string,
  href: string,
  storage: AttributionStorage,
): Record<string, string> {
  const existing = readAttribution(storage);
  if (Object.keys(existing).length > 0) return existing;

  const params = new URLSearchParams(search);
  const fresh: Record<string, string> = {};
  for (const key of PARAMS) {
    const value = params.get(key);
    if (value) fresh[key] = value.slice(0, MAX_LEN);
  }
  fresh.landing = href.slice(0, MAX_LEN);
  fresh.referrer = referrer.slice(0, MAX_LEN);

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    // Storage unavailable (private mode): use fresh values for this call only.
  }
  return fresh;
}
