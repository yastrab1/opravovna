# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1 WRANGLER_SEND_METRICS=false CLOUDFLARE_CF_FETCH_ENABLED=false
COPY package.json package-lock.json ./
RUN npm ci --include=dev --include=optional --no-audit --no-fund
COPY . .
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data PORT=8787
# workerd uses the OS trust store for Clerk's HTTPS API and signing keys.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY deploy/runtime/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && mkdir /data && chown node:node /data
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
COPY deploy/runtime/server.mjs ./server.mjs
COPY deploy/runtime/entry.mjs ./dist/server/container-entry.mjs
USER node
EXPOSE 8787
HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:8787/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
