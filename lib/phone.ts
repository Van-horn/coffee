const MOBILE_CODES = new Set(['25', '29', '33', '44']);

function digitsOf(input: string): string {
  return typeof input === 'string' ? input.replace(/[^0-9]/g, '') : '';
}

/** Strips 375 / 80 / 8 country or trunk prefix from a digit string (partial-safe). */
function stripPrefix(digits: string): string {
  if (digits.startsWith('375')) return digits.slice(3);
  if (digits.startsWith('80')) return digits.slice(2);
  if (digits.startsWith('8')) return digits.slice(1);
  return digits;
}

/** Returns E.164 (+375XXXXXXXXX) for a Belarusian mobile number, else null. */
export function normalizeBelarusPhone(input: string): string | null {
  const digits = digitsOf(input);
  let subscriber: string;
  if (digits.length === 12 && digits.startsWith('375')) subscriber = digits.slice(3);
  else if (digits.length === 11 && digits.startsWith('80')) subscriber = digits.slice(2);
  else if (digits.length === 9) subscriber = digits;
  else return null;
  if (!MOBILE_CODES.has(subscriber.slice(0, 2))) return null;
  return `+375${subscriber}`;
}

/** Input mask: '+375 XX XXX-XX-XX', applied progressively to partial input. */
export function formatPhoneMask(input: string): string {
  const d = stripPrefix(digitsOf(input)).slice(0, 9);
  if (!d) return '';
  let out = `+375 ${d.slice(0, 2)}`;
  if (d.length > 2) out += ` ${d.slice(2, 5)}`;
  if (d.length > 5) out += `-${d.slice(5, 7)}`;
  if (d.length > 7) out += `-${d.slice(7, 9)}`;
  return out;
}
