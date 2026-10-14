# Kvarta roastery landing page: design

> **Update 2026-10-14:** the Pixso layout supersedes this document where they differ (fonts, colors, form fields, delivery copy, no sticky CTA). See `docs/superpowers/specs/2026-10-14-kvarta-design-delta.md`; it wins.

Date: 2026-10-14. Deadline: Mon 19 Oct 2026, 18:00 Moscow time.

## Goal

A Russian-language landing page for Kvarta, a fictional small roastery in Minsk, with a working
lead form. A manager calls the lead back; there is no cart and no online payment. The page must
look studio-made, not template-generated. Source brief: tz.vitai.world (test task).

## Stack (approach A)

- Next.js App Router, TypeScript, deployed on Vercel.
- Material UI with a custom theme built from the design tokens; Emotion SSR registry for the App Router.
- Upstash Redis for storage and dedupe.
- Fonts self-hosted via `next/font`: Literata (headings), Onest (body), JetBrains Mono (labels), `font-display: swap`.
- Telegram Bot API for lead duplication.

## Visual direction

Printed label and Thursday roast. Cream paper, espresso ink, roast-red quarter-circle mark
(Кварта means quarter), mono "stamp" labels, yolk-yellow CTA. Tone: warm and simple, no "premium"
gloss. Avoid purple gradients, uniform rounded card grids, a centered generic hero and emoji bullets.
Layouts follow the Figma/Pixso frames: mobile 390, tablet 768, desktop 1440; tablet layout used
from 640 to 1023 px. Tap targets are at least 44 px.

## Page structure

1. Header and hero (what Kvarta is, 5 kg batches, since 2019).
2. "Our week": Thursday roast, Friday delivery, with a countdown to the next roast. Shows freshness instead of claiming it.
3. Range with prices: Ethiopia Yirgacheffe 32 BYN, Colombia Huila 29 BYN, Brazil Cerrado 26 BYN (250 g each), drip bags 18 BYN (10 pcs).
4. Subscription: 2 x 250 g per month, free delivery, 54 BYN/month.
5. Delivery and pickup: Minsk on Fridays, free from 50 BYN; pickup at ul. Korolya 9; open-now indicator in Minsk time; click-to-call; map link.
6. About: founders Anya and Dmitry, former baristas.
7. FAQ: grind, storage, how freshness is measured, how to cancel the subscription.
8. Lead form, then footer and contacts.
9. Mobile sticky CTA.

Product-card buttons pre-select the matching interest in the form and scroll to it.

## Components

Server components by default. Client components only where needed: lead form, roast countdown,
open-now indicator, sticky CTA, attribution capture.

- `lib/phone.ts`: normalize to E.164, accepting `+375 29 123-45-67`, `80291234567`, `375291234567`, `29 1234567`. Allowed codes: 25, 29, 33, 44. Shared by client and server.
- `lib/schedule.ts`: pure functions for next roast, delivery, order cutoff and open-now, in the Europe/Minsk time zone.
- `lib/attribution.ts`: first-touch capture into sessionStorage.
- `app/api/lead/route.ts`: the endpoint.
- `lib/store.ts`: Upstash access (dedupe, save, rate limit).
- `lib/telegram.ts`: notification.

## Lead API: `POST /api/lead`

Payload: name, phone, interest (`subscription` | `order` | `question`), comment, attribution fields,
idempotency key, honeypot field, form-render timestamp.

Order of operations:

1. Validate on the server, duplicating every client check (name length, phone, interest enum, comment length cap). Respond 400 with per-field errors.
2. Spam checks: honeypot filled or submission faster than the minimum fill time. Respond with a fake success so bots learn nothing. IP rate limit returns 429.
3. Dedupe: atomic `SET phone:<E164> <leadId> NX EX 600`. If the key exists, return the original lead's success response; no second lead is created. The idempotency key covers retries after timeouts the same way.
4. Save the lead (Redis list plus a hash of the lead JSON).
5. Notify Telegram. Save first, notify second: a Telegram failure is logged and never fails the lead.

The token and the Redis credentials live in environment variables only, never in the repo.

## Form UX

- Name, phone (mask while typing), interest, comment, consent line linked to a short privacy note.
- Labels bound to inputs, error messages tied to fields via `aria-describedby`, visible focus.
- The submit button is disabled while the request is in flight; one idempotency key per form instance.
- On failure: inline error with a retry button, a fallback phone number and a Telegram/Instagram link. Typed values are kept.
- Success state: what happens next ("we call within X hours"), with a working-hours caveat.

## Attribution

Capture `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `yclid`, `ysclid`,
`fbclid`, landing URL, `document.referrer` and a submit timestamp. Persist first-touch values at
first load in sessionStorage. Send them as hidden fields and show them in the Telegram message.

## Performance and quality

- Target mobile Lighthouse 90+ in all four categories. MUI and Emotion add JavaScript weight, so keep most sections as server components and measure early, not at the end.
- Optimized images (`next/image`, modern formats, explicit dimensions, lazy loading below the fold); photos from Unsplash/Pexels or illustrated.
- Animations in CSS or lightweight JS, honoring `prefers-reduced-motion`, off the critical path.
- Accessibility: 4.5:1 contrast, `lang="ru"`.
- SEO and sharing: title, description, Open Graph and Twitter tags with a 1200x630 image, favicon, robots and sitemap.
- Analytics: a stub or a note only.

## Assumptions (to be written into the README)

- Order cutoff for Friday delivery: Wednesday 20:00.
- Delivery below 50 BYN: a flat fee, marked as an assumption (brief gives none).
- Minsk landlines (17) are not accepted; mobile codes only.
- Subscription math: two Brazil bags cost 52 BYN, so 54 BYN buys free delivery plus a choice of beans. This is noted as an assumption.
- Roast levels for Colombia and Brazil, and the subscription pause/cancel policy, are unconfirmed with the client.

## Testing

Unit tests for phone normalization, schedule functions and request validation. API tests for dedupe
(same phone twice within 10 minutes, and after 10 minutes), the idempotency key, the honeypot, the
rate limit and a forced Telegram failure. Manual checklist before sending: invalid phone, several
valid formats, double click, API forced to fail, UTM and `yclid` carried through, and the live site
end to end.

## Delivery

Small commits, one sentence each, step by step: scaffold, theme, content, sections, form UI,
endpoint, dedupe, attribution, Telegram, performance, README. The README covers what I did versus
what AI did, where AI was wrong, the storage choice, assumptions and what was skipped. Deployment
target is Vercel; account access is deferred and decided at deploy time.
