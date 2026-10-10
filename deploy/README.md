# Self-hosted test on r2d2

The image runs the compiled application on local workerd through a pinned
Miniflare runtime. It does not run Wrangler's development server, watch files,
or call hosted D1/R2. The live deployment uses Clerk's production instance for
`opravovna.tech`, with Google OAuth and verified domain/email DNS.

Build with the public Clerk key (never a secret key):

```sh
npx clerk env pull --instance prod --file .sites-runtime/clerk-production.env
node --env-file=.sites-runtime/clerk-production.env scripts/build-container.mjs ghcr.io/yastrab1/opravovna:production
docker push ghcr.io/yastrab1/opravovna:production
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
the `production` tag for initial setup; replace it with the digest when deploying.
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

## Production authentication cutover

The production Clerk instance is `ins_3KVT9YhcVblXiwbLYqX3gqTqFYp` in the same
Opravovna application. Google OAuth credentials are stored in Clerk, not in the
container. Production Clerk API keys are runtime secrets; only the publishable
key is supplied at image build time. Local development continues to use its
separate development keys.

The runtime image installs `ca-certificates`: workerd uses the OS trust store
when fetching Clerk signing keys and user records. Node's built-in certificates
alone are insufficient. Keep TLS certificate verification enabled.

To check real authentication, run `node tests/container-auth.mjs` with
`CLERK_SECRET_KEY`, an active `CLERK_TEST_SESSION_ID`, and `TEST_URL` supplied
through a protected environment. This verifies cookie and bearer authentication,
rejects anonymous/invalid sessions, and checks project request validation without
creating data. Set `TEST_CREATE=1` only against an isolated localhost container
with a disposable data copy to also verify project creation. Session tokens and
account details are never printed. This optional check is separate from the
regular API suite, which mocks identity.

Clerk development sessions and user IDs do not carry over. A replacement
production account was provisioned with the existing verified email, and its
account preferences were copied. The application's project owners and upload
owners were remapped to the production account ID, preserving all PDF and
annotation records. Existing memberships remain keyed by email. Users must sign
in again on the production domain.

`migrate-clerk-owners.py` previews or applies this one-time ID remapping using a
private JSON map. Stop the application and take a database backup before using
`--apply`; the script checks for unmapped owners and preserves document rows.
The server retains the private map in `secrets/opravovna-account-map.json` and a
pre-cutover database, environment and Compose snapshot under
`backups/opravovna/before-clerk-production-*`. Restore the database, keys and
image together when rolling this authentication cutover back.

## Parallel server exports

The self-hosted runtime provides an internal `EXPORTER` binding. Protected API
routes take a saved project snapshot, then a Node worker-thread pool renders the
annotated PDFs with the same annotation conversion and PDF placement code as
the browser editor. Flattened PDFs use the original submission basename plus
`_graded.pdf` so reviewers can match each annotation to its source by name.
The importer also accepts older ID-only names such as `41608_graded.pdf`.
Original PDFs, MessagePack metadata, the Opravovna sidecar,
attachments and the `_opravene.zip` naming contract are preserved. Native Skia
renders embedded images and bundled fonts; annotation images cannot fetch URLs
from the server. Pages without annotations skip canvas rendering.

Set `EXPORT_WORKERS` to tune parallelism (1–16). The r2d2 Compose configuration
uses 12 threads. One archive generates at a time, with up to three more queued,
so simultaneous users cannot multiply the thread pool and memory usage. R2
files are consumed as streams rather than through large proxy RPC results.
The browser polls progress, then downloads the finished ZIP. Generation does
not depend on an open browser connection. Identical snapshots reuse a finished
archive for 30 minutes, and the most recent eight finished jobs are retained.
Job status and downloads require both the creating account and current project
access. Temporary archives are deleted on expiration or process restart;
database and PDF storage are unchanged. Hosts without the binding retain the
browser export fallback.

`npm run test:export` checks threaded export, the interchange schema, original
bytes, decimal grades, rotation, extra pages, image rendering, job isolation,
cached retries and rejection of remote image URLs. It requires Poppler's
`pdftoppm` for an actual rendered-image assertion. `tests/container-auth.mjs`
checks real-session authentication separately.

Project tag names are retained in the existing `legacy.tags` vocabulary when a
document is saved. SQLite appends missing tags in the same transaction as the
document revision update, preserving concurrent reviewer changes. Removing an
assignment keeps the project tag available for other solutions and exports.
