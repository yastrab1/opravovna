# Docker deployment

The image runs the compiled application on local workerd through Miniflare. D1 and R2 bindings persist to a local directory; hosted Cloudflare storage is not used by this runtime. A separate Node worker-thread pool generates exports.

## Build

Use `just deploy` for the checked production workflow. The image builds on r2d2 through the dedicated `opravovna-r2d2` Buildx builder over SSH and pushes directly to GHCR. Package downloads stay cached on the server. Supply your public Clerk key when building, and keep the secret key in an ignored runtime environment file.

```sh
node --env-file=.env.production scripts/build-container.mjs ghcr.io/yastrab1/opravovna:production
```

Configure `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `APP_ORIGIN` in the runtime environment. The public origin must match your Clerk production domain. Clerk's Google sign-in needs your own OAuth credentials, configured in Clerk and Google Cloud.

Use [personal-project.compose.yml](personal-project.compose.yml) as a template for the app and Cloudflare Tunnel. Mount the tunnel configuration and tunnel-specific credentials, rather than the account-wide Cloudflare certificate. Persistent storage must be writable by UID/GID 1000.

Pin a tested image digest for deployment. Keep the previous digest for rollback. The self-hosted Workers compatibility date is pinned to `2026-05-15` so build-tool updates cannot silently exceed the runtime binary's supported date. Only override `WORKER_COMPATIBILITY_DATE` after testing an updated runtime.

## Existing unified stack

The live instance uses `/home/r2d2/unified/personal-project.compose.yml`, included by the unified `apps` stack. Update only the Opravovna service:

```sh
cd /home/r2d2/unified
docker compose -f docker-compose.apps.yml -f docker-compose.config-api.yml up -d --no-deps opravovna
docker compose -f docker-compose.apps.yml -f docker-compose.config-api.yml logs --tail=50 opravovna
curl -f http://127.0.0.1:8791/healthz
```

The tunnel forwards to `http://opravovna:8787` on the private Compose network. The app's published port is bound to server loopback. `APP_ORIGIN` restores the public HTTPS origin before Clerk and same-origin checks inspect requests.

Only one app instance should write to a given data directory. Do not run a second tunnel pointing to an independent writable copy of the database for the same hostname.

## Persistent files and backups

- `data/opravovna/`: database and PDF/archive blobs. For an existing Wrangler migration, use the contents of `.wrangler/state/v3`, preserving binding IDs.
- `secrets/opravovna.env`: runtime Clerk keys, readable only by the service account.
- `secrets/opravovna-tunnel/`: tunnel-specific credentials and ingress configuration.
- `/mnt/data/backups/opravovna/`: full verified PDF/archive and database backups on the data disk, kept outside the repository.

Stop the app before copying the complete data directory to obtain a consistent snapshot of SQLite WAL files and blob metadata. Back up secrets separately. Restore the entire snapshot with UID/GID 1000 ownership, then start the app. Keep database, keys and image compatible when rolling back an authentication migration.

Schema migrations under `drizzle/` run once at startup. Existing initial schemas are recognized. `/healthz` becomes ready after migration and checks database access; it does not test Clerk availability.

`migrate-clerk-owners.py` is an optional one-time tool for mapping development account IDs to production IDs. It needs a private JSON mapping and a stopped, backed-up database. The regular deployment path does not run it.

## Export capacity

Set `EXPORT_WORKERS` to 1–16; the live r2d2 stack uses 12. Each thread owns its native renderer and font registry. PDF rendering runs in parallel; one archive packs at a time, with up to three further jobs queued. Original PDF basenames and the root `/points.json` entry match the Arnold interchange contract. Annotations are flattened into the exported PDFs.

Native Skia renders embedded images and bundled fonts. External annotation image URLs are rejected before hydration. Unchanged PDFs skip canvas rendering. Temporary ZIPs expire after 30 minutes or a process restart; at most eight finished jobs are retained. Identical snapshots reuse an existing job. Status and downloads require the initiating account and current project access.

The browser polls progress and downloads the result. Generation continues if that browser disconnects. Runtimes without the internal `EXPORTER` binding use the browser fallback.

## Validation

```sh
npm test
npm run test:export
npm audit --prefix deploy/runtime --omit=dev
```

Rendering checks require Poppler. Optional real-authentication smoke tests use `tests/container-auth.mjs` with `CLERK_SECRET_KEY`, an active `CLERK_TEST_SESSION_ID`, and `TEST_URL` passed through a protected environment. They verify cookie/bearer authentication and request validation without creating production data. `TEST_CREATE=1` is restricted to an isolated localhost container.

The container installs OS CA certificates for workerd's Clerk requests. Keep TLS verification enabled. Health checks alone do not verify authenticated routes; check real sign-in before switching a production image.
