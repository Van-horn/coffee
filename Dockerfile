# syntax=docker/dockerfile:1
# Kvarta landing: Next.js standalone server + SQLite file on a volume. See docs/deploy-server.md.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# better-sqlite3 ships prebuilt binaries inside the npm package. npm 10 (bundled with Node 22) would still
# try node-gyp for it when installing from the lockfile, so scripts are skipped: no compiler is needed.
RUN npm ci --ignore-scripts

FROM node:22-bookworm-slim AS build
WORKDIR /app
# NEXT_PUBLIC_* values are inlined into the bundle at build time: pass the real site URL.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    LEADS_DB_PATH=/data/leads.sqlite
# Standalone server (includes the traced node_modules), then the files it does not copy itself.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Operator tools: docker compose exec kvarta node scripts/export-leads.mjs
COPY --from=build --chown=node:node /app/scripts ./scripts
RUN mkdir -p /data /app/.next/cache && chown node:node /data /app/.next/cache && chmod 700 /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "server.js"]
