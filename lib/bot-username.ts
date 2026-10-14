/**
 * Validates a Telegram bot username (with or without a leading "@"): 5-32 characters of
 * [A-Za-z0-9_], ending in "bot" (case-insensitive). Returns it without "@", or '' when invalid.
 */
export function parseBotUsername(input: string | undefined): string {
  const raw = (input ?? '').trim().replace(/^@/, '');
  return /^[A-Za-z0-9_]{5,32}$/.test(raw) && /bot$/i.test(raw) ? raw : '';
}
