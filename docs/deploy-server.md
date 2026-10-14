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
| `TELEGRAM_BOT_TOKEN` | yes | Bot token from BotFather. See `docs/telegram-channel.md`. |
| `TELEGRAM_CHAT_ID` | private | The PRIVATE manager chat: receives the full lead (name, phone, comment). May be unset: then the details are stored only in the database file and nobody is notified of them. |
| `TELEGRAM_CHANNEL_ID` | private | The PUBLIC channel (for example `-1001234567890`): receives only anonymized posts (interest and time). Never set it equal to `TELEGRAM_CHAT_ID`. |
| `LEADS_DB_PATH` | no | Database file. Optional: defaults to `./data/leads.sqlite` under the working directory. On a server it is always explicit, and set by `docker-compose.yml` (`/data/leads.sqlite`) or the systemd unit (`/var/lib/kvarta/leads.sqlite`), not in the env file. |
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
3. nginx and certbot: `sudo apt install nginx certbot`.
4. Disk encryption: the file holds customer names and phone numbers. Enable full-disk encryption (LUKS) at provisioning,
   or at least keep the data directory on an encrypted volume.

### nginx and TLS (both paths)

Get the certificate first with `certonly` (certbot only obtains it and does not rewrite the config, so the
redirect block is never edited into a loop), then enable the HTTPS block:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/kvarta
sudo sed -i 's/kvarta.example/your.domain/g' /etc/nginx/sites-available/kvarta
sudo mkdir -p /var/www/certbot
sudo ln -s /etc/nginx/sites-available/kvarta /etc/nginx/sites-enabled/kvarta
# 1. nginx cannot load the 443 block before the certificate files exist: comment out the whole
#    "listen 443" server block (the second server { } in the file) for now.
sudo nginx -t && sudo systemctl reload nginx          # port 80 only; it serves /.well-known/acme-challenge/
# 2. obtain the certificate only (webroot method, uses the challenge location of the port-80 block)
sudo certbot certonly --webroot -w /var/www/certbot -d your.domain
# 3. uncomment the 443 block, test and reload
sudo nginx -t && sudo systemctl reload nginx
# 4. renewal: check it now, and reload nginx after each renewal
sudo certbot renew --dry-run
echo -e '#!/bin/sh\nsystemctl reload nginx' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx >/dev/null
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
```

The config was checked with `nginx -t` on nginx 1.18, 1.22 and the current release. `listen 443 ssl http2;` is
accepted by all of them (nginx 1.25.1 and newer print a deprecation warning and also accept a separate
`http2 on;` line instead). The port-80 block serves the ACME challenge and redirects everything else.

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
# edit .env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_CHANNEL_ID, NEXT_PUBLIC_SITE_URL=https://your.domain
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

Logs: `docker compose logs -f kvarta` (compose rotates them: 5 files of 10 MB). Export: see "Exporting leads".

## B. Bare Node + systemd

Prerequisites: Node 22 or newer (`node -v`), git. No compiler needed.

```bash
sudo useradd --system --home /var/lib/kvarta --shell /usr/sbin/nologin kvarta
sudo install -d -o kvarta -g kvarta -m 0700 /var/lib/kvarta /var/backups/kvarta
sudo install -d -o root -g kvarta -m 0750 /etc/kvarta
sudo git clone <repo> /opt/kvarta && sudo chown -R kvarta:kvarta /opt/kvarta
# --cache keeps the npm cache out of the data directory and the home of the service user
sudo -u kvarta sh -c 'cd /opt/kvarta && npm ci --ignore-scripts --cache /tmp/npm-cache'

sudo install -m 0640 -o root -g kvarta /dev/null /etc/kvarta/env
# Only secrets go here (TELEGRAM_BOT_TOKEN=..., TELEGRAM_CHAT_ID=..., TELEGRAM_CHANNEL_ID=...). Do NOT put LEADS_DB_PATH in this file:
# the unit sets it, and an empty or different value in the EnvironmentFile would override the unit.
sudoedit /etc/kvarta/env

# build with the public URL (build-time variable), then copy what the standalone folder does not include
sudo -u kvarta sh -c 'cd /opt/kvarta && NEXT_PUBLIC_SITE_URL=https://your.domain npm run build'
sudo -u kvarta sh -c 'cd /opt/kvarta && mkdir -p public .next/standalone/.next \
  && cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/'

sudo cp deploy/kvarta.service /etc/systemd/system/
# The unit runs /usr/bin/node: adjust ExecStart if Node is installed elsewhere (check with `command -v node`).
sudo systemctl daemon-reload && sudo systemctl enable --now kvarta
systemctl status kvarta && curl -sI http://127.0.0.1:3000/ | head -1

# daily backups: the backup directory (and the job's log) were created above, 0700, owned by kvarta
sudo cp deploy/backup.cron /etc/cron.d/kvarta-backup
# one-line manual test of exactly what cron runs; it must print a path and leave a file behind
sudo -u kvarta sh -c 'cd /opt/kvarta && LEADS_DB_PATH=/var/lib/kvarta/leads.sqlite node scripts/backup-db.mjs --dir /var/backups/kvarta --keep 14 >> /var/backups/kvarta/backup.log 2>&1' && ls -l /var/backups/kvarta
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

Logs: `journalctl -u kvarta -f`. Export: see "Exporting leads".

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
database read-only and does not load the web app. The output is personal data: create the file private
before writing into it, never with a plain `>` under the default umask.

```bash
# path B
( umask 077; sudo -u kvarta env LEADS_DB_PATH=/var/lib/kvarta/leads.sqlite node /opt/kvarta/scripts/export-leads.mjs > leads.csv )
# path A
( umask 077; docker compose exec -T kvarta node scripts/export-leads.mjs > leads.csv )
```

Cells starting with `=`, `+`, `-` or `@` get a leading single quote
so spreadsheets do not run them as formulas (phones therefore appear as `'+375...`).

## Privacy and retention

- The file contains customer names, phone numbers and free-text comments. It is created `0600` inside a `0700`
  directory; keep it that way and use disk encryption.
- The privacy page promises leads are kept 12 months. Run the purge regularly (monthly is enough):
  ```bash
  npm run leads:purge -- --db /var/lib/kvarta/leads.sqlite --older-than-days 365          # dry run: only counts
  npm run leads:purge -- --db /var/lib/kvarta/leads.sqlite --older-than-days 365 --apply  # deletes
  ```
  With `--apply` the script turns on `secure_delete`, deletes, then runs `VACUUM` and truncates the WAL so purged
  names and phones do not linger in free pages. The cost: `VACUUM` rewrites the whole file and briefly blocks
  writers (seconds for a database this size), so run it off-peak.
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
  and answers 503; fix the cause. The app retries opening the file by itself after about 30 s, so a restart is not required. Restore from a backup if the file is corrupt.
- **Several processes:** pm2 cluster or two containers on one volume are safe, all writes are `BEGIN IMMEDIATE`
  transactions with a 5 s busy timeout. The volume must be a local disk, not NFS. Database calls are
  synchronous: while a writer waits on a lock (`SQLITE_BUSY`, up to 5 s) that Node process serves no other request.
- **Rate limit address:** correct only because nginx overwrites `X-Forwarded-For`. Never publish port 3000.
