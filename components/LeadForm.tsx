'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import OutlinedInput from '@mui/material/OutlinedInput';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import CheckIcon from '@/components/icons/CheckIcon';
import { readAttribution } from '@/lib/attribution';
import { CONTACT } from '@/lib/contact';
import {
  GENERIC_FAILURE,
  buildPayload,
  isInterest,
  plural,
  submitLead,
  validateLeadFields,
  type FormValues,
} from '@/lib/lead-client';
import { formatPhoneMask } from '@/lib/phone';
import { colors, radius } from '@/theme/tokens';

type Status = 'idle' | 'sending' | 'success' | 'failed';
type FieldKey = 'name' | 'phone' | 'telegram' | 'interest' | 'comment';

const IDEM_KEY = 'kvarta_idem';
const IDEM_RE = /^[A-Za-z0-9_-]{8,64}$/;
const FIELD_ORDER: FieldKey[] = ['name', 'phone', 'telegram', 'interest', 'comment'];
const FIELD_LABEL: Record<FieldKey, string> = {
  name: 'Имя',
  phone: 'Телефон',
  telegram: 'Ник в Telegram',
  interest: 'Что интересует',
  comment: 'Комментарий',
};
const INTEREST_OPTIONS = [
  { value: 'subscription', label: 'Подписка' },
  { value: 'order', label: 'Разовый заказ' },
  { value: 'question', label: 'Вопрос' },
] as const;
const HOURS_NOTE = 'Пн–Пт 08:00–20:00, Сб–Вс 10:00–18:00';
const INITIAL: FormValues = { name: '', phone: '', telegram: '', interest: 'subscription', comment: '' };

function generateKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // fall through to the manual fallback
  }
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function readStoredKey(): string | null {
  try {
    const stored = window.sessionStorage.getItem(IDEM_KEY);
    return stored && IDEM_RE.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

function storeKey(key: string | null) {
  try {
    if (key) window.sessionStorage.setItem(IDEM_KEY, key);
    else window.sessionStorage.removeItem(IDEM_KEY);
  } catch {
    // private mode: the in-memory key still covers retries on this page
  }
}

function safeAttribution(): Record<string, string> {
  try {
    return readAttribution(window.sessionStorage);
  } catch {
    return {};
  }
}

const hiddenSx = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

const focusRing = { outline: `3px solid ${colors.ink}`, outlineOffset: '2px' } as const;

function AlertIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5v4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11.3" r="0.9" fill="currentColor" />
    </svg>
  );
}

const inputSx = {
  height: 56,
  borderRadius: `${radius.md}px`,
  bgcolor: colors.card,
  fontSize: 16,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.fieldBorder, borderWidth: 1 },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.ink },
  '&.Mui-focused': { boxShadow: `0 0 0 3px ${colors.yolk}` },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colors.ink, borderWidth: 2 },
  '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: colors.error, borderWidth: 1.5 },
  '& input': { padding: '0 16px', height: '100%', boxSizing: 'border-box' },
  '& input::placeholder, & textarea::placeholder': { color: colors.inkSoft, opacity: 0.85 },
} as const;

interface FieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}

function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box
        component="label"
        htmlFor={id}
        sx={{ display: 'block', mb: 1, fontSize: 14, lineHeight: '20px', fontWeight: 500, color: colors.ink }}
      >
        {label}
      </Box>
      {children}
      {error ? (
        <Box
          id={`${id}-error`}
          sx={{ display: 'flex', gap: 1, mt: 1, color: colors.error, fontSize: 14, lineHeight: '22px' }}
        >
          <Box component="span" sx={{ flexShrink: 0, mt: '3px', display: 'flex' }}>
            <AlertIcon />
          </Box>
          <span>{error}</span>
        </Box>
      ) : null}
      {hint ? (
        <Box id={`${id}-hint`} sx={{ mt: 1, color: colors.inkSoft, fontSize: 14, lineHeight: '22px' }}>
          {hint}
        </Box>
      ) : null}
    </Box>
  );
}

export default function LeadForm() {
  const [values, setValues] = useState<FormValues>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [failMessage, setFailMessage] = useState('');
  const [done, setDone] = useState<{ phone: string; telegram: string } | null>(null);

  const inFlight = useRef(false);
  const renderedAt = useRef(0);
  const keyRef = useRef<string | null>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLElement | null>>>({});
  const interestRef = useRef<HTMLFieldSetElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const focusNameAfterReset = useRef(false);

  // Capture the render time and follow ?interest= on mount, hashchange and popstate.
  useEffect(() => {
    renderedAt.current = Date.now();
    const sync = () => {
      const wanted = new URLSearchParams(window.location.search).get('interest');
      if (isInterest(wanted)) setValues((prev) => (prev.interest === wanted ? prev : { ...prev, interest: wanted }));
    };
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  useEffect(() => {
    if (status === 'success') successHeadingRef.current?.focus();
    if (status === 'failed') retryRef.current?.focus();
    if (status === 'idle' && focusNameAfterReset.current) {
      focusNameAfterReset.current = false;
      fieldRefs.current.name?.focus();
    }
  }, [status]);

  const focusField = useCallback((key: FieldKey) => {
    if (key === 'interest') interestRef.current?.querySelector<HTMLInputElement>('input:checked, input')?.focus();
    else fieldRefs.current[key]?.focus();
  }, []);

  const showErrors = useCallback(
    (next: Record<string, string>) => {
      setErrors(next);
      setAttempted(true);
      const first = FIELD_ORDER.find((key) => next[key]);
      if (first) focusField(first);
    },
    [focusField],
  );

  const pending = status === 'sending';

  const setField = (key: FieldKey, value: string) => {
    const next = { ...values, [key]: value };
    setValues(next);
    if (errors[key]) {
      const message = validateLeadFields(next)[key];
      setErrors((prev) => {
        const copy = { ...prev };
        if (message) copy[key] = message;
        else delete copy[key];
        return copy;
      });
    }
  };

  const onBlur = (key: FieldKey) => {
    if (pending) return;
    if (!attempted && values[key] === '') return;
    const message = validateLeadFields(values)[key];
    setErrors((prev) => {
      if ((prev[key] ?? '') === (message ?? '')) return prev;
      const copy = { ...prev };
      if (message) copy[key] = message;
      else delete copy[key];
      return copy;
    });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const found = validateLeadFields(values);
    if (Object.keys(found).length > 0) {
      showErrors(found);
      return;
    }
    inFlight.current = true;
    setStatus('sending');
    try {
      if (!keyRef.current) keyRef.current = readStoredKey() ?? generateKey();
      storeKey(keyRef.current);
      const payload = buildPayload(values, {
        idempotencyKey: keyRef.current,
        renderedAt: renderedAt.current,
        website: honeypotRef.current?.value ?? '',
        attribution: safeAttribution(),
      });
      const result = await submitLead(payload);
      if (result.kind === 'ok') {
        keyRef.current = null;
        storeKey(null);
        setDone({ phone: formatPhoneMask(values.phone), telegram: payload.telegram });
        setErrors({});
        setAttempted(false);
        setStatus('success');
      } else if (result.kind === 'invalid') {
        const known: Record<string, string> = {};
        for (const key of FIELD_ORDER) if (result.errors[key]) known[key] = result.errors[key];
        if (Object.keys(known).length > 0) {
          setStatus('idle');
          showErrors(known);
        } else {
          setFailMessage(GENERIC_FAILURE);
          setStatus('failed');
        }
      } else {
        setFailMessage(result.message);
        setStatus('failed');
      }
    } finally {
      inFlight.current = false;
    }
  };

  const reset = () => {
    keyRef.current = null;
    storeKey(null);
    setValues((prev) => ({ ...INITIAL, interest: prev.interest }));
    setErrors({});
    setAttempted(false);
    setDone(null);
    focusNameAfterReset.current = true;
    setStatus('idle');
  };

  const errorKeys = FIELD_ORDER.filter((key) => errors[key]);
  const showSummary = attempted && errorKeys.length > 0;

  const describedBy = (key: FieldKey, hasHint: boolean) => {
    const ids: string[] = [];
    if (errors[key]) ids.push(`lead-${key}-error`);
    if (hasHint) ids.push(`lead-${key}-hint`);
    return ids.length ? ids.join(' ') : undefined;
  };

  const inputProps = (key: FieldKey, hasHint = true) => ({
    'aria-invalid': errors[key] ? (true as const) : undefined,
    'aria-describedby': describedBy(key, hasHint),
  });

  const cardSx = {
    bgcolor: colors.card,
    color: colors.ink,
    borderRadius: `${radius.xl}px`,
    p: { xs: 2.5, sm: 4 },
    minWidth: 0,
  } as const;

  if (status === 'success' && done) {
    return (
      <Box sx={cardSx}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            bgcolor: colors.leaf,
            color: colors.white,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
          }}
        >
          <CheckIcon size={28} />
        </Box>
        <Typography
          variant="h3"
          component="h3"
          tabIndex={-1}
          ref={successHeadingRef}
          sx={{ m: 0, outline: 'none' }}
        >
          Заявка принята
        </Typography>
        <Typography variant="bodyM" sx={{ color: colors.inkSoft, mt: 2, mb: 0 }}>
          {`Менеджер позвонит на ${done.phone} в рабочее время.`}
        </Typography>
        {done.telegram ? (
          <Typography variant="bodyM" sx={{ color: colors.inkSoft, mt: 1, mb: 0 }}>
            {`Если удобнее, напишет в Telegram: @${done.telegram}.`}
          </Typography>
        ) : null}
        <Box sx={{ bgcolor: colors.paper2, borderRadius: `${radius.md}px`, p: 2, mt: 3 }}>
          <Typography variant="bodyS" sx={{ fontWeight: 500, m: 0 }}>
            Рабочее время
          </Typography>
          <Typography variant="bodyS" sx={{ color: colors.inkSoft, m: 0 }}>
            {HOURS_NOTE}
          </Typography>
        </Box>
        <Button
          type="button"
          variant="outlined"
          fullWidth
          onClick={reset}
          sx={{ mt: 3, height: 56, '&:focus-visible': focusRing }}
        >
          Отправить ещё одну заявку
        </Button>
        <Box role="status" aria-live="polite" sx={hiddenSx}>
          Заявка успешно отправлена.
        </Box>
      </Box>
    );
  }

  const failedGeneric = failMessage === GENERIC_FAILURE;

  return (
    <Box component="form" noValidate onSubmit={onSubmit} aria-label="Заявка" sx={cardSx}>
      <Typography variant="h3" component="h3" sx={{ m: 0, mb: 3 }}>
        Заявка
      </Typography>

      {showSummary ? (
        <Box
          role="alert"
          sx={{
            display: 'flex',
            gap: 1.5,
            mb: 3,
            p: 2,
            bgcolor: colors.paper2,
            border: `1.5px solid ${colors.error}`,
            borderRadius: `${radius.md}px`,
            color: colors.error,
          }}
        >
          <Box component="span" sx={{ flexShrink: 0, mt: '2px', display: 'flex' }}>
            <AlertIcon size={20} />
          </Box>
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 500, color: colors.error, m: 0 }}>
              {`Исправьте ${errorKeys.length} ${plural(errorKeys.length, 'поле', 'поля', 'полей')}`}
            </Typography>
            <Typography variant="bodyS" sx={{ color: colors.ink, m: 0, mt: 0.5 }}>
              {`Проверьте: ${errorKeys.map((key) => FIELD_LABEL[key]).join(', ')}. Ошибки отмечены под полями.`}
            </Typography>
          </Box>
        </Box>
      ) : null}

      {status === 'failed' ? (
        <Box
          role="alert"
          sx={{
            display: 'flex',
            gap: 1.5,
            mb: 3,
            p: 2,
            bgcolor: colors.paper2,
            border: `1.5px solid ${colors.error}`,
            borderRadius: `${radius.md}px`,
          }}
        >
          <Box component="span" sx={{ flexShrink: 0, mt: '2px', display: 'flex', color: colors.error }}>
            <AlertIcon size={20} />
          </Box>
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 500, color: colors.error, m: 0 }}>
              Не удалось отправить заявку
            </Typography>
            {failedGeneric ? (
              <Typography variant="bodyS" sx={{ color: colors.ink, m: 0, mt: 0.5 }}>
                {`Проверьте интернет и нажмите «Повторить». Данные в форме сохранены. Или позвоните нам: ${CONTACT.phoneDisplay}.`}
              </Typography>
            ) : (
              <>
                <Typography variant="bodyS" sx={{ color: colors.ink, m: 0, mt: 0.5 }}>
                  {failMessage}
                </Typography>
                <Typography variant="bodyS" sx={{ color: colors.ink, m: 0, mt: 0.5 }}>
                  {`Данные в форме сохранены. Или позвоните нам: ${CONTACT.phoneDisplay}.`}
                </Typography>
              </>
            )}
          </Box>
        </Box>
      ) : null}

      <Box sx={{ display: 'grid', gap: 3 }}>
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, alignItems: 'start' }}>
          <Field id="lead-name" label="Имя" hint="Только имя, без фамилии" error={errors.name}>
            <OutlinedInput
              id="lead-name"
              name="name"
              fullWidth
              value={values.name}
              placeholder="Как к вам обращаться"
              autoComplete="name"
              readOnly={pending}
              error={Boolean(errors.name)}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setField('name', e.target.value)}
              onBlur={() => onBlur('name')}
              inputRef={(el: HTMLInputElement | null) => {
                fieldRefs.current.name = el;
              }}
              inputProps={inputProps('name')}
              sx={inputSx}
            />
          </Field>
          <Field id="lead-phone" label="Телефон" hint="Мы перезвоним на этот номер" error={errors.phone}>
            <OutlinedInput
              id="lead-phone"
              name="phone"
              type="tel"
              fullWidth
              value={values.phone}
              placeholder="+375 29 123-45-67"
              autoComplete="tel"
              readOnly={pending}
              error={Boolean(errors.phone)}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setField('phone', formatPhoneMask(e.target.value))}
              onBlur={() => onBlur('phone')}
              inputRef={(el: HTMLInputElement | null) => {
                fieldRefs.current.phone = el;
              }}
              inputProps={{ ...inputProps('phone'), inputMode: 'tel' }}
              sx={inputSx}
            />
          </Field>
        </Box>

        <Field
          id="lead-telegram"
          label="Ник в Telegram (по желанию)"
          hint="Если удобнее переписываться: менеджер напишет вам туда"
          error={errors.telegram}
        >
          <OutlinedInput
            id="lead-telegram"
            name="telegram"
            fullWidth
            value={values.telegram}
            placeholder="@username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            readOnly={pending}
            error={Boolean(errors.telegram)}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setField('telegram', e.target.value)}
            onBlur={() => onBlur('telegram')}
            inputRef={(el: HTMLInputElement | null) => {
              fieldRefs.current.telegram = el;
            }}
            inputProps={inputProps('telegram')}
            sx={inputSx}
          />
        </Field>

        <Box
          component="fieldset"
          ref={interestRef}
          aria-describedby={describedBy('interest', false)}
          sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
        >
          <Box
            component="legend"
            sx={{ p: 0, mb: 1, fontSize: 14, lineHeight: '20px', fontWeight: 500, color: colors.ink }}
          >
            Что интересует
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {INTEREST_OPTIONS.map((option) => {
              const selected = values.interest === option.value;
              return (
                <Box
                  key={option.value}
                  component="label"
                  sx={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1.25,
                    minHeight: 52,
                    px: 2.5,
                    borderRadius: `${radius.md}px`,
                    border: `1.5px solid ${selected ? colors.ink : colors.fieldBorder}`,
                    bgcolor: selected ? colors.ink : colors.card,
                    color: selected ? colors.paper : colors.ink,
                    fontSize: 16,
                    fontWeight: 500,
                    lineHeight: '24px',
                    cursor: pending ? 'default' : 'pointer',
                    '&:focus-within': { outline: `3px solid ${colors.ink}`, outlineOffset: '2px', boxShadow: `0 0 0 2px ${colors.yolk}` },
                  }}
                >
                  <Box
                    component="input"
                    type="radio"
                    name="interest"
                    value={option.value}
                    checked={selected}
                    disabled={pending}
                    onChange={() => setField('interest', option.value)}
                    sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', m: 0, opacity: 0, cursor: 'inherit' }}
                  />
                  <Box
                    component="span"
                    aria-hidden="true"
                    sx={{
                      width: 20,
                      height: 20,
                      flexShrink: 0,
                      borderRadius: '50%',
                      border: `2px solid ${selected ? colors.paper : colors.ink}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selected ? (
                      <Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colors.yolk }} />
                    ) : null}
                  </Box>
                  {option.label}
                </Box>
              );
            })}
          </Box>
          {errors.interest ? (
            <Box
              id="lead-interest-error"
              sx={{ display: 'flex', gap: 1, mt: 1, color: colors.error, fontSize: 14, lineHeight: '22px' }}
            >
              <Box component="span" sx={{ flexShrink: 0, mt: '3px', display: 'flex' }}>
                <AlertIcon />
              </Box>
              <span>{errors.interest}</span>
            </Box>
          ) : null}
        </Box>

        <Field
          id="lead-comment"
          label="Комментарий"
          error={errors.comment}
          hint={
            <>
              Необязательно
              {values.comment.length > 450 ? (
                <Box
                  component="span"
                  sx={{ float: 'right', color: values.comment.trim().length > 500 ? colors.error : colors.inkSoft }}
                >
                  {values.comment.length} / 500
                </Box>
              ) : null}
            </>
          }
        >
          <OutlinedInput
            id="lead-comment"
            name="comment"
            fullWidth
            multiline
            minRows={3}
            value={values.comment}
            placeholder="Помол, адрес доставки, вопросы"
            readOnly={pending}
            error={Boolean(errors.comment)}
            onChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setField('comment', e.target.value)}
            onBlur={() => onBlur('comment')}
            inputRef={(el: HTMLElement | null) => {
              fieldRefs.current.comment = el;
            }}
            inputProps={inputProps('comment')}
            sx={{ ...inputSx, height: 'auto', alignItems: 'flex-start', p: 0, '& textarea': { padding: '14px 16px' } }}
          />
        </Field>

        {/* Honeypot: off-screen (not display:none) so naive bots still fill it. */}
        <Box
          aria-hidden="true"
          sx={{ position: 'absolute', left: '-10000px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}
        >
          <input ref={honeypotRef} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </Box>

        <Typography variant="bodyS" sx={{ color: colors.inkSoft, m: 0 }}>
          Нажимая кнопку, вы соглашаетесь на обработку имени, телефона и ника в Telegram для связи по заявке. Ник нигде
          не публикуется.{' '}
          <Link
            href="/privacy"
            underline="always"
            sx={{ color: colors.ink, '&:focus-visible': focusRing, borderRadius: '2px' }}
          >
            Политика обработки данных
          </Link>
        </Typography>

        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <Button
            ref={retryRef}
            type="submit"
            variant="contained"
            fullWidth
            disabled={pending}
            aria-busy={pending || undefined}
            sx={{
              height: 56,
              fontSize: 16,
              fontWeight: 500,
              '&.Mui-disabled': { bgcolor: colors.yolk, color: colors.ink, opacity: 0.85 },
              '&:focus-visible': focusRing,
            }}
          >
            {pending ? (
              <>
                <CircularProgress size={20} thickness={5} sx={{ color: colors.ink, mr: 1.5 }} aria-hidden="true" />
                Отправляем…
              </>
            ) : status === 'failed' ? (
              'Повторить отправку'
            ) : (
              'Отправить заявку'
            )}
          </Button>
          {pending ? (
            <Typography variant="bodyS" sx={{ color: colors.inkSoft, textAlign: 'center', m: 0 }}>
              Не закрывайте страницу: это займёт пару секунд.
            </Typography>
          ) : null}
          {status === 'failed' ? (
            <>
              <Button
                component="a"
                href={CONTACT.phoneHref}
                variant="outlined"
                fullWidth
                sx={{ height: 56, '&:focus-visible': focusRing }}
              >
                {`Позвонить: ${CONTACT.phoneDisplay}`}
              </Button>
              <Typography variant="bodyS" sx={{ textAlign: 'center', m: 0 }}>
                {'Или напишите нам в Telegram: '}
                <Link
                  href={CONTACT.telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="always"
                  sx={{ color: colors.ink, '&:focus-visible': focusRing, borderRadius: '2px' }}
                >
                  {CONTACT.telegramHandle}
                </Link>
              </Typography>
            </>
          ) : null}
        </Box>
      </Box>

      <Box role="status" aria-live="polite" sx={hiddenSx}>
        {pending ? 'Отправляем заявку, подождите.' : status === 'failed' ? 'Отправка не удалась. Данные сохранены.' : ''}
      </Box>
    </Box>
  );
}
