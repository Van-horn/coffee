# Deploying Kvarta on your own server

All leads live in one SQLite file on the server. There is no third-party database. The app is a Next.js
standalone server (`output: 'standalone'`) behind nginx.

Two supported ways to run it: **A. Docker + compose** or **B. bare Node + systemd**. Both put nginx in front for TLS.

## Why SQLite, and why `better-sqlite3`

| | `node:sqlite` (built in) | `better-sqlite3` (chosen) |
|---|---|---|
| Install | nothing | `npm ci`; prebuilt binaries for linux x64/arm64 (glibc and musl) are inside the npm package, no download, no compiler |
| Stability | "experimental" in Node 22: prints `ExperimentalWarning` on every start, API may change between minors | mature, synchronous API, widely deployed |
| Next.js | bundler support for the `node:sqlite` scheme is uneven across Next/Turbopack versions | in `serverExternalPackages`, traced into `.next/standalone` (verified) |
| Concurrency | same SQLite engine | same SQLite engine |

Decision: `better-sqlite3` 13 (requires Node 22 or newer). It needs no compiler on the server and gives no runtime
warning. Caveat: npm 10 (the npm bundled with Node 22) starts `node-gyp` for it when installing from a lockfile, which
fails without Python and a compiler. Always install with `npm ci --ignore-scripts` (the Dockerfile does).

Settings: `journal_mode=WAL`, `busy_timeout=5000`, `synchronous=FULL` (a lead is worth the fsync). Every write runs in
a `BEGIN IMMEDIATE` transaction, so several processes (pm2 cluster, two containers on one volume) can share the
file safely. Expired dedupe, notification and rate-limit rows are purged inside those transactions; leads are never
purged automatically. Schema version is kept in `PRAGMA user_version`.

## Why not Vercel

Vercel's filesystem is ephemeral and per instance: a SQLite file there disappears on the next deploy or cold start,
and instances do not share it. Orders would be lost silently. The app therefore refuses to open the database when
`VERCEL` is set (it logs one error and answers 503) unless `ALLOW_EPHEMERAL_FILE_STORE=1` is set, which you should only
do for a throwaway preview. Use a server with a persistent disk.

## Environment variables

| Variable | Secret | Notes |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | yes | Bot that posts orders to the private channel. See `docs/telegram-channel.md`. |
| `TELEGRAM_CHAT_ID` | private | The channel id (for example `-1001234567890`). Without the token and chat id the site still works and saves leads, it just does not notify. |
| `LEADS_DB_PATH` | no | Database file. Optional: defaults to `./data/leads.sqlite` under the working directory. On a server always set it explicitly: `/data/leads.sqlite` (Docker) or `/var/lib/kvarta/leads.sqlite` (systemd). |
| `NEXT_PUBLIC_SITE_URL` | no | Public origin, for example `https://kvarta.example`. Needed at **build time**: Next.js inlines `NEXT_PUBLIC_*` values into the bundle (canonical URL, Open Graph, sitemap), so changing it later requires a rebuild. |
| `PORT`, `HOSTNAME` | no | Standalone server listen address. Keep `HOSTNAME=127.0.0.1` outside Docker so only nginx can reach it. |
| `ALLOW_EPHEMERAL_FILE_STORE` | no | Vercel guard override. Leave unset. |

Secrets live only in `.env` (Docker) or `/etc/kvarta/env` (systemd), never in the repository. `.env.example` lists names only.

The Open Graph images are static routes rendered at build time (the Roboto `.woff` files are read during `next build`
only), so nothing font-related is needed at runtime.

## Common to both: server preparation

1. A VPS with Debian or Ubuntu, a DNS `A` record for your domain pointing at it.
2. Firewall, only SSH, 80 and 443 open (the app listens on 127.0.0.1 only):
   ```bash
   sudo ufw default deny incoming && sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
   ```
3. nginx and certbot: `sudo apt install nginx certbot python3-certbot-nginx`.
4. Disk encryption: the file holds customer names and phone numbers. Enable full-disk encryption (LUKS) at provisioning,
   or at least keep the data directory on an encrypted volume.

### nginx and TLS (both paths)

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/kvarta
sudo sed -i 's/kvarta.example/your.domain/g' /etc/nginx/sites-available/kvarta
sudo ln -s /etc/nginx/sites-available/kvarta /etc/nginx/sites-enabled/kvarta
# certificates first (nginx cannot start with a missing certificate file): temporarily comment out the 443 server block, then
sudo certbot --nginx -d your.domain
sudo nginx -t && sudo systemctl reload nginx
```

What the config does: HTTP redirects to HTTPS; proxies to `127.0.0.1:3000`; **overwrites** `X-Forwarded-For` with
`$remote_addr` (the app rate-limits on the first entry, so a client-supplied header must never pass through);
`client_max_body_size 20k`; `limit_req` on `/api/lead` as a second layer; HSTS, `nosniff`, `Referrer-Policy`,
`Permissions-Policy`; gzip; one-year immutable cache for `/_next/static/`. It deliberately has no
Content-Security-Policy: MUI/Emotion inject inline styles and Next.js inlines bootstrap scripts, so a CSP without
per-request nonces would break the page or need `unsafe-inline` and protect nothing. Certbot renews certificates
through its systemd timer (`systemctl list-timers | grep certbot`).

## A. Docker + compose

Prerequisites: Docker Engine with the compose plugin.

```bash
git clone <repo> /srv/kvarta && cd /srv/kvarta
cp .env.example .env && chmod 600 .env
# edit .env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, NEXT_PUBLIC_SITE_URL=https://your.domain
docker compose up -d --build
docker compose ps            # STATUS should become "healthy"
curl -sI http://127.0.0.1:3000/ | head -1
```

- The compose service `kvarta` binds `127.0.0.1:3000` only, runs as the unprivileged `node` user with a read-only root
  filesystem (tmpfs for `/tmp` and `/app/.next/cache`), all capabilities dropped.
- The database is in the named volume `kvarta-data`, mounted at `/data` (`LEADS_DB_PATH=/data/leads.sqlite`).
- `NEXT_PUBLIC_SITE_URL` is passed to the image build as a build argument from `.env`.

Update:

```bash
cd /srv/kvarta && git pull && docker compose up -d --build   # the volume, and the leads, stay
```

Logs: `docker compose logs -f kvarta`. Export: `docker compose exec -T kvarta node scripts/export-leads.mjs > leads.csv`.

## B. Bare Node + systemd

Prerequisites: Node 22 or newer (`node -v`), git. No compiler needed.

```bash
sudo useradd --system --home /var/lib/kvarta --shell /usr/sbin/nologin kvarta
sudo install -d -o kvarta -g kvarta -m 0700 /var/lib/kvarta /var/backups/kvarta
sudo install -d -o root -g kvarta -m 0750 /etc/kvarta
sudo git clone <repo> /opt/kvarta && sudo chown -R kvarta:kvarta /opt/kvarta
sudo -u kvarta sh -c 'cd /opt/kvarta && npm ci --ignore-scripts'

sudo install -m 0640 -o root -g kvarta /dev/null /etc/kvarta/env
sudoedit /etc/kvarta/env      # TELEGRAM_BOT_TOKEN=...  TELEGRAM_CHAT_ID=...  (names only in git, values only here)

# build with the public URL (build-time variable), then copy what the standalone folder does not include
sudo -u kvarta sh -c 'cd /opt/kvarta && NEXT_PUBLIC_SITE_URL=https://your.domain npm run build'
sudo -u kvarta sh -c 'cd /opt/kvarta && mkdir -p public .next/standalone/.next \
  && cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/'

sudo cp deploy/kvarta.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now kvarta
systemctl status kvarta && curl -sI http://127.0.0.1:3000/ | head -1
```

`.next/standalone` contains `server.js` and the traced `node_modules` (including `better-sqlite3`); `public/` and
`.next/static/` are not copied by Next.js and must be copied as above after every build. The unit hardens the process
(`NoNewPrivileges`, `ProtectSystem=strict`, only `/var/lib/kvarta` writable, `PrivateTmp`).

Update:

```bash
cd /opt/kvarta && sudo -u kvarta git pull && sudo -u kvarta npm ci --ignore-scripts
# repeat the build and copy commands above, then
sudo systemctl restart kvarta
```

Logs: `journalctl -u kvarta -f`. Export: `sudo -u kvarta LEADS_DB_PATH=/var/lib/kvarta/leads.sqlite npm --prefix /opt/kvarta run -s leads:export > leads.csv`.

## Backups and restore

`npm run leads:backup -- --dir <dir> [--keep 14]` writes `leads-YYYYMMDD-HHMMSS.sqlite` (SQLite `VACUUM INTO`, a
consistent snapshot while the app keeps running), mode 0600, and keeps the newest 14. Schedule it with
`deploy/backup.cron` (path B) or a host cron entry running it through `docker compose exec` (path A), and copy the
backup directory off the server (it contains personal data: encrypt it in transit and at rest).

**Never back up by copying `leads.sqlite` alone.** In WAL mode recent writes sit in `leads.sqlite-wal`; the main file
can look empty. Use the backup script, or stop the app and copy the file together with `-wal` and `-shm`.

Restore (tested: a restored backup exports the same leads):

```bash
# path B
sudo systemctl stop kvarta
sudo -u kvarta rm -f /var/lib/kvarta/leads.sqlite /var/lib/kvarta/leads.sqlite-wal /var/lib/kvarta/leads.sqlite-shm
sudo -u kvarta cp /var/backups/kvarta/leads-20261014-031500.sqlite /var/lib/kvarta/leads.sqlite
sudo -u kvarta chmod 600 /var/lib/kvarta/leads.sqlite
sudo systemctl start kvarta
# path A: docker compose stop kvarta, then copy the backup over /data/leads.sqlite with a throwaway container:
#   docker run --rm -v kvarta_kvarta-data:/data -v "$PWD":/b node:22-bookworm-slim sh -c \
#     'rm -f /data/leads.sqlite*; cp /b/leads-20261014-031500.sqlite /data/leads.sqlite; chown 1000:1000 /data/leads.sqlite; chmod 600 /data/leads.sqlite'
#   docker compose start kvarta
```

Check afterwards: `npm run leads:export -- --db /var/lib/kvarta/leads.sqlite | wc -l` (one header line plus one per lead).

## Exporting leads

`npm run leads:export -- --db /path/leads.sqlite` prints CSV; add `--json` for JSON. Columns: `created_at` (ISO),
`id`, `interest`, `name`, `phone`, `comment`, `utm_source`, `utm_medium`, `utm_campaign`, `landing`, `referrer`. It opens the
database read-only and does not load the web app. Cells starting with `=`, `+`, `-` or `@` get a leading single quote
so spreadsheets do not run them as formulas (phones therefore appear as `'+375...`).

## Privacy and retention

- The file contains customer names, phone numbers and free-text comments. It is created `0600` inside a `0700`
  directory; keep it that way and use disk encryption.
- The privacy page promises leads are kept 12 months. Run the purge regularly (monthly is enough):
  ```bash
  npm run leads:purge -- --db /var/lib/kvarta/leads.sqlite --older-than-days 365          # dry run: only counts
  npm run leads:purge -- --db /var/lib/kvarta/leads.sqlite --older-than-days 365 --apply  # deletes
  ```
  Backups keep older data until they rotate out (14 days by default).
- Orders also go to the private Telegram channel; delete messages there on the same schedule.

## Operations

- **Rotate a secret:** create a new bot token in @BotFather (`/revoke`), put it into `.env` or `/etc/kvarta/env`,
  then `docker compose up -d` or `systemctl restart kvarta`. The site never needs a rebuild for runtime secrets
  (only `NEXT_PUBLIC_SITE_URL` is build-time).
- **Disk full:** SQLite then fails writes and the form answers 503 (nothing is lost silently; the customer is
  asked to retry or call). Free space (`journalctl --vacuum-size=200M`, `docker system prune`, remove old backups),
  and the service recovers on its own. Take a backup first. Watch free space with your provider's monitoring.
- **Database cannot be opened** (permissions, corrupt file): the app logs `lead store: cannot open the file database`
  once and answers 503; fix the cause, then restart. Restore from a backup if the file is corrupt.
- **Several processes:** pm2 cluster or two containers on one volume are safe, all writes are `BEGIN IMMEDIATE`
  transactions with a 5 s busy timeout. The volume must be a local disk, not NFS.
- **Rate limit address:** correct only because nginx overwrites `X-Forwarded-For`. Never publish port 3000.
