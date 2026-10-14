import type { StoredLead } from '@/lib/store';

const MAX_MESSAGE_CHARS = 3800;
const ATTEMPTS = 2;
const RETRY_PAUSE_MS = 400;
const REQUEST_TIMEOUT_MS = 3000;
const MAX_DESCRIPTION_CHARS = 120;

const INTEREST_LABELS: Record<StoredLead['interest'], string> = {
  subscription: 'подписка',
  order: 'разовый заказ',
  question: 'вопрос',
};

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

const pad = (n: number): string => String(n).padStart(2, '0');

/** "DD.MM.YYYY HH:MM" in Europe/Minsk (fixed UTC+3, no DST). */
export function formatMinskTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 3 * 60 * 60 * 1000);
  return (
    `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  );
}

/** Truncates the RAW text (by code points) before escaping, so entities are never cut. */
function clip(raw: string, max: number): string {
  const chars = Array.from(raw);
  if (chars.length <= max) return raw;
  return max <= 0 ? '' : `${chars.slice(0, max - 1).join('')}…`;
}

function render(lead: StoredLead, commentMax: number, attrMax: number): string {
  const attr = (key: string): string => clip(lead.attribution[key] ?? '', attrMax);
  const line = (label: string, raw: string): string | null =>
    raw ? `${label}: ${escapeHtml(raw)}` : null;

  const source = [attr('utm_source'), attr('utm_medium')].filter(Boolean).map(escapeHtml).join(' / ');
  const clicks = ['yclid', 'ysclid', 'fbclid']
    .map((key) => [key, attr(key)] as const)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${escapeHtml(value)}`)
    .join(', ');
  const nick = lead.telegram
    ? `Telegram клиента: <a href="https://t.me/${escapeHtml(lead.telegram)}">@${escapeHtml(lead.telegram)}</a>`
    : null;

  const lines = [
    `<b>Новая заявка</b> · ${INTEREST_LABELS[lead.interest]}`,
    line('Имя', lead.name),
    `Телефон: ${lead.phone}`,
    nick,
    line('Комментарий', clip(lead.comment, commentMax)),
    source ? `Источник: ${source}` : null,
    line('Кампания', attr('utm_campaign')),
    line('Объявление', attr('utm_content')),
    line('Запрос', attr('utm_term')),
    clicks ? `Метки кликов: ${clicks}` : null,
    line('Страница входа', attr('landing')),
    line('Пришёл с', attr('referrer')),
    `Заявка получена: ${formatMinskTime(lead.createdAt)} · id ${escapeHtml(lead.leadId)}`,
  ];
  return lines.filter((l): l is string => l !== null).join('\n');
}

export function formatLeadMessage(lead: StoredLead): string {
  let commentMax = Array.from(lead.comment).length;
  let attrMax = Math.max(0, ...Object.values(lead.attribution).map((v) => Array.from(v).length));

  let message = render(lead, commentMax, attrMax);
  // Shrink the comment first, then the attribution values, until the message fits.
  while (message.length > MAX_MESSAGE_CHARS && commentMax > 0) {
    commentMax = Math.max(0, commentMax - Math.max(1, message.length - MAX_MESSAGE_CHARS));
    message = render(lead, commentMax, attrMax);
  }
  while (message.length > MAX_MESSAGE_CHARS && attrMax > 0) {
    attrMax = Math.max(0, attrMax - Math.max(1, message.length - MAX_MESSAGE_CHARS));
    message = render(lead, commentMax, attrMax);
  }
  return message;
}

let warnedDisabled = false;

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

type Failure = { label: string; retryAfterMs: number | null; retry: boolean };

async function failureOf(res: Response): Promise<Failure & { description: string }> {
  let description = '';
  let retryAfter: number | undefined;
  try {
    const json = (await res.json()) as {
      description?: unknown;
      parameters?: { retry_after?: unknown };
    };
    if (typeof json.description === 'string') description = json.description.slice(0, MAX_DESCRIPTION_CHARS);
    if (typeof json.parameters?.retry_after === 'number') retryAfter = json.parameters.retry_after;
  } catch {
    // body is not JSON; the status alone is reported
  }
  if (res.status === 429) {
    const ok = retryAfter !== undefined && retryAfter <= 1;
    return { label: '429', description, retry: ok, retryAfterMs: ok ? Math.max(0, retryAfter! * 1000) : null };
  }
  return { label: String(res.status), description, retry: res.status >= 500, retryAfterMs: null };
}

/**
 * Forwards a lead to the manager's Telegram chat. Retries internally (nobody replays the
 * request) and THROWS when delivery ultimately fails so the caller can release its marker.
 * Error messages never contain the token, the URL or any lead data.
 */
export async function sendTelegram(
  lead: StoredLead,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    if (!warnedDisabled) {
      warnedDisabled = true;
      console.warn('telegram notifications disabled: bot token or chat id not configured');
    }
    return;
  }

  const body = JSON.stringify({
    chat_id: chatId,
    text: formatLeadMessage(lead),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });

  let last = 'unknown';
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    let retry = true;
    let pause = RETRY_PAUSE_MS;
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.ok) return;
      const failure = await failureOf(res);
      last = failure.description ? `${failure.label} ${failure.description}` : failure.label;
      retry = failure.retry;
      if (failure.retryAfterMs !== null) pause = failure.retryAfterMs;
    } catch (error) {
      // error.name only: some runtimes put the request URL (with the token) into the message
      last = error instanceof Error ? error.name : 'unknown error';
    }
    if (!retry || attempt === ATTEMPTS) break;
    await sleep(pause);
  }
  throw new Error(`telegram send failed: ${last}`);
}
