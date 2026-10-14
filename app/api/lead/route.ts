import { handleLead } from '@/lib/handle-lead';
import { getStore } from '@/lib/get-store';
import { sendTelegram } from '@/lib/telegram';

const MAX_BODY_CHARS = 10_000;

const notifyLead = sendTelegram;

function reply(body: unknown, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) {
    return reply({ ok: false, message: 'Слишком большой запрос.' }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reply({ ok: false, errors: { body: 'Некорректный запрос' } }, 400);
  }

  const { status, body: result } = await handleLead(
    { body, ip: clientIp(request) },
    { store: getStore(), notify: notifyLead, now: Date.now },
  );
  return reply(result, status);
}
