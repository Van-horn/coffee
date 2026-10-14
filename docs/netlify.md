# Deploying Kvarta to Netlify

Live site: https://kvarta-coffee.netlify.app (Netlify site `kvarta-coffee`).

Netlify is a quick public preview and demo host. For durable order storage use your own server: see [deploy-server.md](deploy-server.md).

## What is deployed

- Next.js 16 app built by the Netlify Next.js runtime (OpenNext adapter, auto-detected, no plugin entry needed). SSR and `/api/lead` run in one Netlify Function; static assets go to the CDN.
- `netlify.toml`: `npm run build`, publish `.next`, Node 22. No install flags are needed: `better-sqlite3` ships prebuilt binaries and the runtime traces it into the function (verified by a live `/api/lead` call).
- `next.config.ts` skips `output: 'standalone'` when `NETLIFY=true` (Netlify sets it during builds). Every other build still produces `.next/standalone` for the server deployment; `tests/next-config.test.ts` checks both.
- Site protection ("team-only" SSO) is switched off for this site, otherwise visitors and link-preview crawlers get HTTP 401.

## Environment variables

| Name | Secret | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | no | Canonical origin, inlined at BUILD time (metadataBase, Open Graph URLs, sitemap, robots) |
| `ALLOW_EPHEMERAL_FILE_STORE` | no | `1`: explicit opt-in to the non-durable file store |
| `LEADS_DB_PATH` | no | `/tmp/leads.sqlite`, the only writable path on Netlify |
| `TELEGRAM_BOT_TOKEN` | yes | Bot token |
| `TELEGRAM_CHANNEL_ID` | yes | Channel that receives anonymized order notices |
| `TELEGRAM_CHAT_ID` | yes | Manager chat with full order details (not set yet: see caveats) |

Secrets are set with `netlify env:set NAME value --secret --context production` (add `--` before a value that starts with `-`, such as a channel id). Do not commit values.

## Redeploy

```bash
NEXT_PUBLIC_SITE_URL=https://kvarta-coffee.netlify.app \
  netlify deploy --prod --build --site <site id>
```

Authenticate with `NETLIFY_AUTH_TOKEN` in the environment of that command only. Changed env vars apply after a redeploy.

## Storage limits (important)

Netlify functions have no persistent disk. The lead store is a per-instance SQLite file in `/tmp`:

- Data is lost on cold starts and is not shared between instances.
- Duplicate-order protection and rate limiting are best-effort only.
- Telegram is the only durable record of an order on Netlify.
- For durable storage run the app on your own server: [deploy-server.md](deploy-server.md).

Without `ALLOW_EPHEMERAL_FILE_STORE=1` the Netlify runtime refuses the file store (one error in the logs) and `/api/lead` answers 503.

## Rotate the Telegram token

1. Create the new token in @BotFather.
2. `netlify env:set TELEGRAM_BOT_TOKEN <new> --secret --context production --site <site id>`
3. Redeploy (see above). Revoke the old token in @BotFather.

## Open Graph preview

`app/layout.tsx` sets title, description, `og:*` and `twitter:*` tags, with `metadataBase` from `NEXT_PUBLIC_SITE_URL`, so the image URL is absolute. `app/opengraph-image.tsx` and `app/twitter-image.tsx` render a 1200x630 PNG through `lib/og-image.tsx` (Roboto Cyrillic from `@fontsource/roboto`); Next adds `og:image:width/height/type/alt`. The image URL has a content hash and carries an explicit `Cache-Control`.

Messengers cache previews. After changing the image or text, refresh the cache: Telegram, send the link to @WebpageBot; Facebook and WhatsApp, use the Facebook Sharing Debugger (developers.facebook.com/tools/debug).

## Custom domain

Add the domain in Netlify (Domain management), set `NEXT_PUBLIC_SITE_URL` to the new https origin, and redeploy: the value is inlined at build time.
