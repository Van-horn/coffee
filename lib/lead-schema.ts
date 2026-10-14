import { z } from 'zod';
import { normalizeBelarusPhone } from '@/lib/phone';

export type LeadInput = {
  name: string;
  phone: string; // E.164
  telegram: string; // '' when not given, otherwise nick without '@'
  interest: 'subscription' | 'order' | 'question';
  comment: string;
  idempotencyKey: string;
  website: string; // honeypot, normally ''
  renderedAt: number; // ms epoch when the form rendered
  attribution: Record<string, string>;
};

const NAME_MSG = 'Укажите имя: от 2 до 60 символов';
const PHONE_MSG = 'Проверьте номер: нужен белорусский, например +375 29 123-45-67';
const TELEGRAM_MSG = 'Ник: от 5 символов, латиница, цифры и _, например @anna_minsk';
const INTEREST_MSG = 'Выберите, что вас интересует';
const COMMENT_MSG = 'Комментарий не длиннее 500 символов';
const KEY_MSG = 'Некорректный идентификатор заявки';

const TELEGRAM_RE = /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/;
const KEY_RE = /^[A-Za-z0-9_-]+$/;

const ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'yclid',
  'ysclid',
  'fbclid',
  'landing',
  'referrer',
  'submittedAt',
] as const;
const ATTRIBUTION_VALUE_MAX = 300;

const phoneSchema = z.string({ error: PHONE_MSG }).transform((value, ctx) => {
  const phone = normalizeBelarusPhone(value);
  if (phone === null) {
    ctx.addIssue({ code: 'custom', message: PHONE_MSG });
    return z.NEVER;
  }
  return phone;
});

const telegramSchema = z
  .string({ error: TELEGRAM_MSG })
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return '';
    if (!TELEGRAM_RE.test(value)) {
      ctx.addIssue({ code: 'custom', message: TELEGRAM_MSG });
      return z.NEVER;
    }
    return value.replace(/^@/, '');
  });

const attributionSchema = z.unknown().optional().transform((value): Record<string, string> => {
  const out: Record<string, string> = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return out;
  const source = value as Record<string, unknown>;
  for (const key of ATTRIBUTION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const v = source[key];
    if (typeof v === 'string') out[key] = v.slice(0, ATTRIBUTION_VALUE_MAX);
  }
  return out;
});

export const leadSchema = z.object({
  name: z.string({ error: NAME_MSG }).trim().min(2, NAME_MSG).max(60, NAME_MSG),
  phone: phoneSchema,
  telegram: telegramSchema,
  interest: z.enum(['subscription', 'order', 'question'], { error: INTEREST_MSG }),
  comment: z
    .string({ error: COMMENT_MSG })
    .trim()
    .max(500, COMMENT_MSG)
    .optional()
    .transform((v) => v ?? ''),
  idempotencyKey: z
    .string({ error: KEY_MSG })
    .min(8, KEY_MSG)
    .max(64, KEY_MSG)
    .regex(KEY_RE, KEY_MSG),
  website: z
    .string({ error: 'Некорректное значение' })
    .max(200, 'Некорректное значение')
    .optional()
    .transform((v) => v ?? ''),
  renderedAt: z
    .number({ error: 'Некорректное время' })
    .finite('Некорректное время')
    .min(0, 'Некорректное время'),
  attribution: attributionSchema,
});

export type ParseLeadResult =
  | { ok: true; data: LeadInput }
  | { ok: false; errors: Record<string, string> };

export function parseLead(body: unknown): ParseLeadResult {
  try {
    const result = leadSchema.safeParse(body);
    if (result.success) return { ok: true, data: result.data as LeadInput };
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.length > 0 ? String(issue.path[0]) : 'body';
      if (!(key in errors)) errors[key] = issue.message;
    }
    return { ok: false, errors };
  } catch {
    return { ok: false, errors: { body: 'Некорректный запрос' } };
  }
}
