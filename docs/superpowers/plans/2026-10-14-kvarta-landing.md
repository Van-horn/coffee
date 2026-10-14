# Kvarta Landing Page Implementation Plan

> **Update 2026-10-14:** the Pixso layout supersedes this document where they differ (fonts, colors, form fields, delivery copy, no sticky CTA). See `docs/superpowers/specs/2026-10-14-kvarta-design-delta.md`; it wins.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Russian-language Kvarta roastery landing page with a working, deduplicating lead form, deployed on Vercel.

**Architecture:** Next.js App Router with server components for content and small client components for the form, countdown, open-now indicator and sticky CTA. Business logic lives in pure, unit-tested modules under `lib/`. `POST /api/lead` is a thin route over `handleLead(req, deps)`, which takes an injectable store and notifier so tests need no network.

**Tech Stack:** Next.js (App Router, TypeScript), Material UI + Emotion, `@upstash/redis`, zod, Vitest, `next/font`.

**Spec:** `docs/superpowers/specs/2026-10-14-kvarta-landing-design.md`

## Global Constraints

- Page language Russian; `<html lang="ru">`.
- Deadline Mon 19 Oct 2026, 18:00 Moscow time.
- Commit after every task; one-sentence commit messages.
- Secrets (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) only in env vars; commit `.env.example` with names and empty values.
- Phone: Belarusian mobile only, codes 25, 29, 33, 44; stored as E.164 (`+375291234567`).
- Dedupe window: 10 minutes (`SET phone:<E164> <leadId> NX EX 600`).
- Interest enum: `subscription` | `order` | `question`.
- Prices: Ethiopia Yirgacheffe 32 BYN, Colombia Huila 29 BYN, Brazil Cerrado 26 BYN (250 g); drip bags 10 pcs 18 BYN; subscription 2 x 250 g, 54 BYN/month, free delivery.
- Delivery Minsk, Fridays, free from 50 BYN; hours Mon-Fri 08:00-20:00, Sat-Sun 10:00-18:00; pickup ul. Korolya 9; time zone Europe/Minsk (UTC+3, no DST).
- Assumptions to write in README: order cutoff Wednesday 20:00; flat delivery fee below 50 BYN (amount marked as assumption); landlines (17) rejected.
- Mobile Lighthouse 90+ in all four categories; animations honor `prefers-reduced-motion`; contrast 4.5:1; tap targets at least 44 px.

## Review Focus

- Phone input containing letters, emoji or only punctuation: rejected with a field error, never a 500 (Task 2).
- Whitespace-only name, or a comment over 500 chars: rejected server-side (Task 4).
- Redis unavailable at claim or save time: respond 503 with a retry message; if save fails after the claim, release the claim so the retry is not reported as a duplicate (Task 5).
- Telegram throws or times out, or lead text contains `<`, `&`: lead still succeeds; message is HTML-escaped (Task 6).
- Exact boundaries: Thursday at the roast hour, Wednesday 20:00 cutoff, 20:00 weekday close, Sunday 18:00 close (Task 3).

## File Structure

- `lib/phone.ts`, `lib/schedule.ts`, `lib/lead-schema.ts`, `lib/store.ts`, `lib/handle-lead.ts`, `lib/telegram.ts`, `lib/attribution.ts`: logic, one responsibility each.
- `app/api/lead/route.ts`: thin adapter.
- `app/layout.tsx`, `app/page.tsx`, `app/robots.ts`, `app/sitemap.ts`, `app/privacy/page.tsx`: shell and routes.
- `components/*`: one file per page section; `components/LeadForm.tsx`, `Countdown.tsx`, `OpenNow.tsx`, `StickyCta.tsx`, `AttributionCapture.tsx` are client components.
- `theme/theme.ts`, `theme/registry.tsx`: MUI theme and Emotion SSR registry.
- `tests/*.test.ts`: Vitest.

## Parallelism

Task 1 first. Then Tasks 2, 3, 4, 7 are independent and can run as parallel agents. Task 5 needs 2 and 4; Task 6 needs 4; Task 8 sections are independent of each other; Task 9 needs 2, 5, 7. Tasks 10-12 are sequential at the end.

---

### Task 1: Scaffold, theme, fonts, test runner

**Files:**
- Create: Next.js project files in repo root, `theme/theme.ts`, `theme/registry.tsx`, `.env.example`, `vitest.config.ts`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `theme` (MUI theme object, default export of `theme/theme.ts`); `ThemeRegistry` component wrapping children; CSS variables from `next/font` for `--font-literata`, `--font-onest`, `--font-jetbrains`; `npm test` runs Vitest.

- [ ] **Step 1: Scaffold with `create-next-app` (TypeScript, App Router, no Tailwind, no `src/`) into the existing repo; install `@mui/material @mui/material-nextjs @emotion/react @emotion/styled @emotion/cache @upstash/redis zod` and dev `vitest`.**
- [ ] **Step 2: Implement `theme/theme.ts`** with tokens: cream paper background, espresso ink text, roast-red primary, yolk-yellow CTA colour; heading font Literata, body Onest, labels JetBrains Mono; Cyrillic subsets; `display: 'swap'`. Verify text/background pairs meet 4.5:1.
- [ ] **Step 3: Implement `theme/registry.tsx`** using `AppRouterCacheProvider` and `ThemeProvider`; set `lang="ru"` in `app/layout.tsx`.
- [ ] **Step 4: Run `npm run build`.** Expected: succeeds.
- [ ] **Step 5: Add `npm test` script and a trivial passing test; run `npm test`.** Expected: PASS.
- [ ] **Step 6: Commit** `git add -A && git commit -m "Scaffold Next.js app with MUI theme and fonts."`

### Task 2: Phone normalization

**Files:**
- Create: `lib/phone.ts`
- Test: `tests/phone.test.ts`

**Interfaces:**
- Produces: `normalizeBelarusPhone(input: string): string | null` returning E.164 or `null`; `formatPhoneMask(input: string): string` for the input mask.

- [ ] **Step 1: Write failing tests** asserting `normalizeBelarusPhone` returns `'+375291234567'` for `'+375 29 123-45-67'`, `'80291234567'`, `'375291234567'`, `'29 1234567'`; returns `null` for `'+375 17 123-45-67'` (landline), `'+375 99 123-45-67'`, `'abc'`, `'😀'`, `'---'`, `''`, and a number with 8 subscriber digits. Test `formatPhoneMask('291234567')` equals `'+375 29 123-45-67'`.
- [ ] **Step 2: Run `npm test -- phone`.** Expected: FAIL (module missing).
- [ ] **Step 3: Implement both functions in `lib/phone.ts`:** strip non-digits, then accept `375XXXXXXXXX` (12 digits), `80XXXXXXXXX` (11 digits), or 9 digits; check code against 25, 29, 33, 44.
- [ ] **Step 4: Run `npm test -- phone`.** Expected: PASS.
- [ ] **Step 5: Commit** `git add lib/phone.ts tests/phone.test.ts && git commit -m "Add Belarusian phone normalization."`

### Task 3: Schedule functions

**Files:**
- Create: `lib/schedule.ts`
- Test: `tests/schedule.test.ts`

**Interfaces:**
- Produces: `nextRoast(now: Date): Date` (next Thursday 09:00 Minsk; if now is at or past that moment on Thursday, the following week); `nextDelivery(now: Date): Date` (next Friday 12:00 Minsk, same rule); `orderCutoff(now: Date): Date` (Wednesday 20:00 Minsk before the next delivery); `isOpenNow(now: Date): boolean`; `hoursLabel(now: Date): string`.

- [ ] **Step 1: Write failing tests** using fixed UTC instants (Minsk = UTC+3): Thursday 08:59 Minsk gives that day's roast, Thursday 09:00 gives next week; Wednesday 19:59 is before cutoff and 20:00 is not; `isOpenNow` is true Mon 08:00, false Mon 20:00, true Sat 10:00, false Sun 18:00, false Sat 09:59.
- [ ] **Step 2: Run `npm test -- schedule`.** Expected: FAIL.
- [ ] **Step 3: Implement in `lib/schedule.ts`** with pure date arithmetic on a fixed +3h offset (no DST), no external date library.
- [ ] **Step 4: Run `npm test -- schedule`.** Expected: PASS.
- [ ] **Step 5: Commit** `git add lib/schedule.ts tests/schedule.test.ts && git commit -m "Add Minsk schedule helpers."`

### Task 4: Lead validation schema

**Files:**
- Create: `lib/lead-schema.ts`
- Test: `tests/lead-schema.test.ts`

**Interfaces:**
- Consumes: `normalizeBelarusPhone` (Task 2; stub locally until merged).
- Produces: `leadSchema` (zod) and `type LeadInput = { name: string; phone: string /* E.164 */; interest: 'subscription'|'order'|'question'; comment: string; idempotencyKey: string; website: string /* honeypot */; renderedAt: number; attribution: Record<string,string> }`; `parseLead(body: unknown): { ok: true, data: LeadInput } | { ok: false, errors: Record<string,string> }`.

- [ ] **Step 1: Write failing tests:** valid payload parses and phone is E.164; name `'   '` fails with a `name` error; name under 2 chars fails; comment of 501 chars fails; unknown interest fails; invalid phone gives a `phone` error with a Russian hint; non-object body returns `ok: false`.
- [ ] **Step 2: Run `npm test -- lead-schema`.** Expected: FAIL.
- [ ] **Step 3: Implement.** Trim name, 2-60 chars; comment max 500; error messages in Russian; attribution values capped at 300 chars each.
- [ ] **Step 4: Run `npm test -- lead-schema`.** Expected: PASS.
- [ ] **Step 5: Commit** `git add lib/lead-schema.ts tests/lead-schema.test.ts && git commit -m "Add lead validation schema."`

### Task 5: Store and lead handler

**Files:**
- Create: `lib/store.ts`, `lib/handle-lead.ts`, `app/api/lead/route.ts`
- Test: `tests/handle-lead.test.ts`

**Interfaces:**
- Consumes: `parseLead` (Task 4).
- Produces: `interface LeadStore { claimPhone(e164: string, leadId: string, ttlSeconds: number): Promise<string | null> /* null = claimed now, else existing leadId */; releasePhone(e164: string): Promise<void>; saveLead(lead: StoredLead): Promise<void>; hitRate(ip: string): Promise<number> }`; `createUpstashStore(): LeadStore`; `createMemoryStore(now?: () => number): LeadStore` (honors TTL via injected clock); `handleLead(req: { body: unknown; ip: string }, deps: { store: LeadStore; notify: (lead: StoredLead) => Promise<void>; now: () => number }): Promise<{ status: number; body: { ok: boolean; leadId?: string; errors?: Record<string,string>; message?: string } }>`.

- [ ] **Step 1: Write failing tests** with `createMemoryStore` and a fake notifier: valid lead gives 200 and one saved lead; same phone twice inside 10 minutes gives 200 both times, same `leadId`, one saved lead; same phone after 10 minutes (advance injected clock 601 s) saves a second lead; honeypot filled gives 200 and saves nothing; `renderedAt` under 3 s before `now` gives 200 and saves nothing; sixth request from one IP within 10 minutes gives 429; invalid body gives 400 with `errors`; store whose `saveLead` throws gives 503 and the phone claim is released (a retry then succeeds); notifier that throws still gives 200.
- [ ] **Step 2: Run `npm test -- handle-lead`.** Expected: FAIL.
- [ ] **Step 3: Implement `handleLead`** in the order: validate, spam checks, rate limit, claim, save (release on failure), notify wrapped in try/catch. `leadId` is the request's idempotency key. `createUpstashStore` uses `SET ... NX EX` for the claim and an `INCR`/`EXPIRE` pair for the rate limit.
- [ ] **Step 4: Implement `app/api/lead/route.ts`:** read JSON (400 on malformed body), IP from `x-forwarded-for`, call `handleLead` with the Upstash store and the Telegram notifier from Task 6 (a no-op notifier until then).
- [ ] **Step 5: Run `npm test`.** Expected: PASS.
- [ ] **Step 6: Commit** `git add lib app/api tests && git commit -m "Add lead endpoint with atomic dedupe and spam checks."`

### Task 6: Telegram notification

**Files:**
- Create: `lib/telegram.ts`
- Modify: `app/api/lead/route.ts`
- Test: `tests/telegram.test.ts`

**Interfaces:**
- Consumes: `StoredLead` (Task 5).
- Produces: `formatLeadMessage(lead: StoredLead): string` (HTML parse mode; includes name, phone, interest, comment, utm source/campaign/content, click ids, landing URL, time in Minsk); `sendTelegram(lead: StoredLead): Promise<void>` (no-op when env vars are unset; 5 s timeout via `AbortSignal.timeout`).

- [ ] **Step 1: Write failing tests:** `formatLeadMessage` escapes `<`, `>`, `&` in name and comment; includes `+375291234567` and the `utm_campaign` value; `sendTelegram` with a stubbed `fetch` posts to `https://api.telegram.org/bot<token>/sendMessage`.
- [ ] **Step 2: Run `npm test -- telegram`.** Expected: FAIL.
- [ ] **Step 3: Implement both and wire `sendTelegram` into the route.**
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Commit** `git add lib app/api tests && git commit -m "Duplicate leads to Telegram."`

### Task 7: Attribution capture

**Files:**
- Create: `lib/attribution.ts`, `components/AttributionCapture.tsx`
- Test: `tests/attribution.test.ts`

**Interfaces:**
- Produces: `captureAttribution(search: string, referrer: string, href: string, storage: Pick<Storage,'getItem'|'setItem'>): Record<string,string>` (first-touch: if storage already holds values, return them unchanged); `readAttribution(storage): Record<string,string>`; `AttributionCapture` client component that calls capture once on mount and renders nothing.

- [ ] **Step 1: Write failing tests:** captures `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `yclid`, `ysclid`, `fbclid`, plus `landing` (href) and `referrer`; a second call with different params returns the first values; storage that throws does not throw out of the function.
- [ ] **Step 2: Run `npm test -- attribution`.** Expected: FAIL.
- [ ] **Step 3: Implement with try/catch around storage, key `kvarta_attr`.**
- [ ] **Step 4: Run `npm test -- attribution`.** Expected: PASS.
- [ ] **Step 5: Commit** `git add lib components tests && git commit -m "Capture first-touch attribution."`

### Task 8: Page sections

**Files:**
- Create: `components/Header.tsx`, `Hero.tsx`, `Week.tsx`, `Range.tsx`, `Subscription.tsx`, `Delivery.tsx`, `About.tsx`, `Faq.tsx`, `Footer.tsx`, `Countdown.tsx`, `OpenNow.tsx`, `StickyCta.tsx`, `app/privacy/page.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `theme` (Task 1), `nextRoast`, `nextDelivery`, `orderCutoff`, `isOpenNow` (Task 3).
- Produces: each section a default-exported component taking no props, except `Range` product buttons which link to `#order?interest=<value>` and `StickyCta` which links to `#order`. Section anchor ids: `week`, `range`, `subscription`, `delivery`, `about`, `faq`, `order`.

- [ ] **Step 1: Implement sections as server components** following the Figma/Pixso frames (mobile 390, tablet 768 from 640, desktop 1440) and the Global Constraints copy and prices. `Countdown`, `OpenNow`, `StickyCta` are client components.
- [ ] **Step 2: Write specific Russian copy** from the brief facts (5 kg batches, since 2019, Anya and Dmitry, 1-3 days from roast to cup); no generic filler lines.
- [ ] **Step 3: Include in Delivery** the click-to-call, map link to ul. Korolya 9, the Wednesday 20:00 cutoff, and the labelled flat fee below 50 BYN.
- [ ] **Step 4: Run `npm run build` and open the page at 390, 768 and 1440 widths.** Expected: no horizontal scroll, no layout shift on load.
- [ ] **Step 5: Commit per section group,** e.g. `"Add hero and week sections."`, `"Add range and subscription sections."`, `"Add delivery, about, FAQ and footer."`

### Task 9: Lead form UI

**Files:**
- Create: `components/LeadForm.tsx`
- Modify: `app/page.tsx`, `components/Range.tsx`
- Test: `tests/lead-form.test.tsx` (optional, only if cheap; otherwise covered by the manual checklist)

**Interfaces:**
- Consumes: `formatPhoneMask`, `normalizeBelarusPhone` (Task 2), `readAttribution` (Task 7), `POST /api/lead` response shape (Task 5).
- Produces: `LeadForm` client component, pre-selecting `interest` from the URL hash/query.

- [ ] **Step 1: Implement the form:** name, masked phone, interest radios, comment, honeypot field hidden from users and screen readers, consent line linking `/privacy`, one idempotency key (`crypto.randomUUID()`) per mount, `renderedAt` timestamp.
- [ ] **Step 2: States:** disabled button while pending; inline field errors tied by `aria-describedby`; failure shows a retry button plus fallback phone and Telegram/Instagram link and keeps typed values; success shows next steps with a working-hours caveat.
- [ ] **Step 3: Verify manually against the live dev server and a stubbed store:** invalid phone, four valid formats, double click, API forced to fail, same phone twice.
- [ ] **Step 4: Commit** `"Add lead form with validation and failure handling."`

### Task 10: SEO, sharing, favicon

**Files:**
- Create: `app/robots.ts`, `app/sitemap.ts`, `app/opengraph-image.tsx` or `public/og.png` (1200x630), `app/icon.svg`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add metadata:** title, description, Open Graph and Twitter tags, `metadataBase`, 1200x630 image, favicon.
- [ ] **Step 2: Add robots and sitemap.**
- [ ] **Step 3: Verify tags in the built HTML** (`curl` the local server and grep `og:`). Expected: all present.
- [ ] **Step 4: Commit** `"Add SEO metadata and link preview."`

### Task 11: Performance and accessibility pass

- [ ] **Step 1: Run Lighthouse (mobile) against `npm run build && npm start`.** Record the four scores.
- [ ] **Step 2: Fix anything under 90:** convert or shrink images with explicit dimensions, lazy-load below the fold, keep MUI imports path-based, move non-critical animation to CSS and wrap it in `prefers-reduced-motion`.
- [ ] **Step 3: Re-run Lighthouse.** Expected: 90+ in all four categories; save the report under `docs/lighthouse/`.
- [ ] **Step 4: Commit** `"Tune performance and accessibility to Lighthouse 90+."`

### Task 12: README and deploy prep

**Files:**
- Create: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Write README** with the design idea, what I did versus what AI did, where AI was wrong and how it was caught (filled from the session notes), the storage choice and why (serverless filesystem is ephemeral; Redis gives atomic dedupe), the Global Constraints assumptions, and what was skipped.
- [ ] **Step 2: Deploy** once Vercel and GitHub access is confirmed: add env vars, deploy, then run the manual test checklist against the live URL (not localhost).
- [ ] **Step 3: Commit** `"Add README and deployment notes."`
