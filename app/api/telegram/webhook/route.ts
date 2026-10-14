import { createHash, timingSafeEqual } from 'node:crypto';
import { formatCustomerMessage } from '@/lib/customer-message';
import { createUpstashStore, safeErrorLabel, type LeadStore } from '@/lib/store';
import { sendTelegramMessage } from '@/lib/telegram';

const MAX_BODY_CHARS = 20_000;
const START_RE = /^\/start(?:@[A-Za-z0-9_]+)?\s+([A-Za-z0-9_-]{8,64})$/;

let store: LeadStore | undefined;

function reply(body: unknown, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

const ok = () => reply({ ok: true }, 200);

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/** Constant-time check; both sides are hashed to 32 bytes so lengths never differ or leak. */
function secretMatches(header: string | null): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || header === null) return false;
  return timingSafeEqual(digest(header), digest(secret));
}

/** Reads the body, stopping (and cancelling the stream) once it exceeds the cap; null when too big. */
async function readCapped(request: Request): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    if (text.length > MAX_BODY_CHARS) {
      await reader.cancel().catch(() => {});
      return null;
    }
  }
  text += decoder.decode();
  return text.length > MAX_BODY_CHARS ? null : text;
}

/** The leadId and chat id of a private-chat `/start <leadId>` message, otherwise null. */
function parseStart(update: unknown): { leadId: string; chatId: number } | null {
  if (typeof update !== 'object' || update === null) return null;
  const message = (update as { message?: unknown }).message;
  if (typeof message !== 'object' || message === null) return null;
  const { text, chat, from, forward_origin, forward_date } = message as {
    text?: unknown;
    chat?: unknown;
    from?: { is_bot?: unknown } | null;
    forward_origin?: unknown;
    forward_date?: unknown;
  };
  // Bots and forwarded messages never trigger the greeting.
  if (from?.is_bot === true || forward_origin !== undefined || forward_date !== undefined) return null;
  if (typeof text !== 'string' || typeof chat !== 'object' || chat === null) return null;
  const { id, type } = chat as { id?: unknown; type?: unknown };
  if (type !== 'private' || typeof id !== 'number' || !Number.isSafeInteger(id)) return null;
  const match = START_RE.exec(text);
  return match ? { leadId: match[1], chatId: id } : null;
}

export async function POST(request: Request) {
  // Fail closed: no configured secret, or a missing/wrong header, reads nothing and answers 401.
  if (!secretMatches(request.headers.get('x-telegram-bot-api-secret-token'))) {
    return reply({ ok: false }, 401);
  }

  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_CHARS) return reply({ ok: false }, 413);
  const text = await readCapped(request);
  if (text === null) return reply({ ok: false }, 413);

  let update: unknown;
  try {
    update = JSON.parse(text);
  } catch {
    return ok(); // garbage must not make Telegram retry
  }

  const start = parseStart(update);
  if (!start) return ok();

  const db = (store ??= createUpstashStore());
  let claimed = false;
  try {
    const lead = await db.getLead(start.leadId);
    if (!lead || lead.leadId !== start.leadId) return ok();
    if (!(await db.claimBotGreeting(start.leadId))) return ok();
    claimed = true;
    // At-least-once, not exactly-once: if Telegram accepted the message but the response timed out,
    // the send is reported as failed, the marker is released below and a later Start sends again.
    await sendTelegramMessage(start.chatId, formatCustomerMessage(lead, new Date(Date.now())));
  } catch (error) {
    // Only the PII-free label is logged: never the lead, name, phone, chat id or token.
    console.error('telegram webhook: start failed', safeErrorLabel(error));
    if (claimed) {
      try {
        await db.releaseBotGreeting(start.leadId);
      } catch (releaseError) {
        console.error('telegram webhook: release failed', safeErrorLabel(releaseError));
      }
    }
  }
  // Always 2xx: Telegram retries non-2xx updates; the customer's retry is pressing Start again.
  return ok();
}
