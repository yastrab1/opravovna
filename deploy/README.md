# Self-hosted test on r2d2

The image runs the compiled application on local workerd through a pinned
Miniflare runtime. It does not run Wrangler's development server, watch files,
or call hosted D1/R2. The Clerk instance is still the development instance.

Build with the public Clerk key (never a secret key):

```sh
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
docker build --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY -t ghcr.io/yastrab1/opravovna:test .
docker push ghcr.io/yastrab1/opravovna:test
```

On `r2d2`, `/home/r2d2/unified/personal-project.compose.yml` is included by
both `docker-compose.yml` and `docker-compose.apps.yml`. The app is a service in
the existing `apps` Compose project. Operate only its services:

```sh
cd /home/r2d2/unified
docker compose -f docker-compose.apps.yml -f docker-compose.config-api.yml up -d opravovna opravovna-tunnel
docker compose -f docker-compose.apps.yml -f docker-compose.config-api.yml logs --tail=50 opravovna opravovna-tunnel
curl -f http://127.0.0.1:8791/healthz
```

The deployment pins the application image digest. The checked-in template uses
the `test` tag for initial setup; replace it with the digest when deploying.
Updates require building/pushing a new image, changing the image digest in the
personal Compose file, and running `up -d` for these two services.

## Files on the server

- `data/opravovna/`: persistent local database and PDF/archive blobs. This is
  the contents of the original `.wrangler/state/v3`, not its parent directory.
- `secrets/opravovna.env`: runtime `CLERK_SECRET_KEY` and
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (mode 600).
- `secrets/opravovna-tunnel/credentials.json`: tunnel-specific credentials.
  The account-wide `cert.pem` is not needed and is not copied.
- `secrets/opravovna-tunnel/config.yml`: existing tunnel ID, public hostname,
  and origin `http://opravovna:8787` on the private Compose network.
- `backups/opravovna/`: pre-migration snapshots and configuration backups.

The containers run as UID/GID 1000. The bind-mounted data and secret files must
be readable by this identity. The HTTP port is published only on server
loopback; public traffic arrives through Cloudflare Tunnel. `APP_ORIGIN` restores
the HTTPS public origin before Clerk and same-origin validation handle requests.

Never start the laptop tunnel and server tunnel together while they point at
independent writable database copies. Cloudflare can send requests to either
connector. Keep the old laptop services disabled after cutover.

## Backup and restore

Stop the two Opravovna services before copying the data directory to get a
consistent snapshot of SQLite WAL files and blob metadata. Keep secrets in a
separate protected backup. To restore, stop the same services, restore the entire
data snapshot with UID/GID 1000 ownership, then restart them. Keep one running
application instance per data directory.

Container restarts automatically preserve data. Initial schema creation and
future checked-in SQL migrations run at startup. The imported initial schema
is recognized and is not recreated. The health check verifies database
availability after migrations; it does not validate external Clerk availability.

The old workers.dev test has its own remote D1/R2 data. It is not the source of
this laptop-to-r2d2 migration and is left intact.
