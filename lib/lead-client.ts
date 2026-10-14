// Client-side lead logic. Pure (no React). The validation rules duplicate lib/lead-schema.ts on purpose:
// importing zod into the browser bundle is not worth it. tests/lead-client.test.ts proves parity.
import { normalizeBelarusPhone } from '@/lib/phone';

export const INTERESTS = ['subscription', 'order', 'question'] as const;
export type Interest = (typeof INTERESTS)[number];

export function isInterest(value: unknown): value is Interest {
  return typeof value === 'string' && (INTERESTS as readonly string[]).includes(value);
}

export interface FormValues {
  name: string;
  phone: string;
  interest: string;
  comment: string;
}

export interface LeadPayload {
  name: string;
  phone: string;
  interest: string;
  comment: string;
  idempotencyKey: string;
  website: string;
  renderedAt: number;
  attribution: Record<string, string>;
}

export interface PayloadContext {
  idempotencyKey: string;
  renderedAt: number;
  website: string;
  attribution: Record<string, string>;
  /** Client clock override for tests; defaults to Date.now(). */
  now?: number;
}

export type SubmitResult =
  | { kind: 'ok'; leadId: string; duplicate: boolean }
  | { kind: 'invalid'; errors: Record<string, string> }
  | { kind: 'failed'; message: string };

export const GENERIC_FAILURE = 'Не удалось отправить заявку';

const NAME_MSG = 'Укажите имя: от 2 до 60 символов';
const PHONE_MSG = 'Проверьте номер: нужен белорусский, например +375 29 123-45-67';
const INTEREST_MSG = 'Выберите, что вас интересует';
const COMMENT_MSG = 'Комментарий не длиннее 500 символов';

export function validateLeadFields(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = values.name.trim();
  if (name.length < 2 || name.length > 60) errors.name = NAME_MSG;
  if (normalizeBelarusPhone(values.phone) === null) errors.phone = PHONE_MSG;
  if (!isInterest(values.interest)) errors.interest = INTEREST_MSG;
  if (values.comment.trim().length > 500) errors.comment = COMMENT_MSG;
  return errors;
}

export function buildPayload(values: FormValues, ctx: PayloadContext): LeadPayload {
  const phone = values.phone.trim();
  return {
    name: values.name.trim(),
    phone: normalizeBelarusPhone(phone) ?? phone,
    interest: values.interest,
    comment: values.comment.trim(),
    idempotencyKey: ctx.idempotencyKey,
    website: ctx.website,
    renderedAt: ctx.renderedAt,
    attribution: { ...ctx.attribution, submittedAt: String(ctx.now ?? Date.now()) },
  };
}

/** Identity of what the lead says: the idempotency key is only reusable while this stays the same. */
export function leadFingerprint(payload: LeadPayload): string {
  return JSON.stringify([payload.name, payload.phone, payload.interest, payload.comment]);
}

/** Russian plural form: plural(1, 'поле', 'поля', 'полей') -> 'поле'. */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function failed(message?: unknown): SubmitResult {
  return {
    kind: 'failed',
    message: typeof message === 'string' && message ? message : GENERIC_FAILURE,
  };
}

export async function submitLead(
  payload: LeadPayload,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 15000,
): Promise<SubmitResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return failed();
    }
    if (typeof body !== 'object' || body === null) return failed();
    const data = body as Record<string, unknown>;
    if (response.status === 200 && data.ok === true) {
      return {
        kind: 'ok',
        leadId: typeof data.leadId === 'string' ? data.leadId : '',
        duplicate: data.duplicate === true,
      };
    }
    if (response.status === 400 && typeof data.errors === 'object' && data.errors !== null) {
      return { kind: 'invalid', errors: data.errors as Record<string, string> };
    }
    return failed(data.message);
  } catch {
    return failed();
  } finally {
    clearTimeout(timer);
  }
}
