# Opravovňa

A Slovak workspace for teams reviewing competition solutions in PDF. Sign in with Clerk, import a ZIP, annotate solutions, assign points and export an Arnold-compatible archive.

## Features

- Projects with owner, editor and viewer permissions; email-based sharing and revocable join links.
- ZIP imports with three concurrent PDF uploads, bounded retries for transient chunk/read failures and no redundant upload for existing solutions. Original archives and PDFs remain on the server.
- Text comments wrap at the page edge. Format existing text boxes or selected text, and drag boxes between pages with edge scrolling and undo/redo. Added pages become editable immediately. Freehand drawing, highlighting, images, arrows and shapes; configurable tool defaults saved to the account.
- Continuous page scrolling, appended blank pages and rotation of an embedded scan while preserving the PDF header.
- Non-negative decimal grades with no upper limit. Invalid imported grades open a correction dialog before upload; cancel stops the import.
- Sorting and filters share one compact dropdown: alphabetic/category/points order, independent graded-first ordering, categories, grading status, decimal point comparisons and any/specific tag. All preferences are account-bound. Project tags can be deleted globally, with confirmation when in use.
- Owners can assign categories to collaborators beside Save/Share. Ungraded work is split evenly into `assigned:FirstName` tags; reassignment clears old assignment tags and preserves other tags and annotations.
- Each open solution updates the address bar to `/?project=<id>&solution=<id>`. Copy this link to share it with project members; it survives reloads and restarts, waits for sign-in and supports browser Back/Forward.
- Live project viewers beside Settings, with profile photos and names on hover or keyboard focus. Click a reviewer to open their latest focused solution, saving your own edits first. Multiple tabs count once; abandoned sessions expire automatically.
- Project tags beside thumbnails; search, grading status, tag/category selection, decimal points filters (equal/less/greater), and sorting saved per project to the account. Unsynced edits survive immediate reloads in an account-specific local backup and retry when the connection returns.
- Explicit next-solution button, removable grading stamps, undo and redo.
- Automatic saves, five-second synchronization and revision checks to prevent silent overwrites.
- Merge corrected exports, skip identical submissions, and choose the existing or incoming version for conflicts.
- Server-side PDF export through a configurable worker-thread pool, with a browser fallback.

## Local development

Requires Node 22.19+ (Node 24 recommended), npm, and a Clerk application. Enable verified email sign-in or configure your own Google OAuth credentials in Clerk.

```sh
npm ci
```

Create ignored `.env.local` and `.dev.vars` files containing your Clerk keys:

```dotenv
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key
```

The publishable key is included in the frontend build. The secret key stays server-side. Use development keys for localhost.

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_premium_leech.sql
npm start
```

Open http://127.0.0.1:8787. `npm run dev` builds and starts the local Worker. `npm run dev:hot` starts the framework development runner. Local D1/R2 data is stored in ignored `.wrangler/state`.

## Archive compatibility

Submission filenames follow `p<problem>-c<category>-<hyphenated-name>-<submission-id>.pdf`, optionally inside a problem folder. Category codes remain unchanged in storage; the interface displays numeric years and prima/sekunda/tercia/kvarta.

Import understands Arnold MessagePack `changes.arn`, its tag-ID catalog, `points.json`, legacy graded-PDF names and Opravovna version-1 metadata. Numeric strings with a decimal dot or comma are normalized. Invalid scores require a replacement before the archive is uploaded.

Final exports contain only graded PDFs at the ZIP root, with each **original PDF basename preserved**, and Arnold's literal **`/points.json` entry**. The leading slash on this metadata entry matches the supplied Arnold export; it does not create a wrapper folder. Ungraded solutions are omitted. Points metadata preserves scoring criteria and uses submission IDs to match PDFs. A namespaced `opravovna` field inside `points.json` preserves project tag names, colors and solution assignments for re-import. Arnold grading fields remain unchanged. Editable annotation sidecars are not included in this final interchange ZIP: annotations are flattened into the PDFs.

PDF.js decoder assets (WASM, fallback JavaScript, CMaps and fonts) are copied from the installed version into a versioned public directory during the build. Browser viewers and server export workers use matching assets.

The ZIP filename derives from the original problem folder. For example: `4. Kto druhemu jamu kope sam do nej spadne_opravene.zip`.

## Architecture

- `app/`: routes and workspace/editor composition.
- `components/`: focused workspace dialogs, sidebars and editor controls.
- `hooks/`: project persistence, account preferences, import dialog state and canvas lifecycle.
- `lib/import/`: archive preparation, score corrections and merge decisions.
- `lib/export/`, `lib/archive-export.ts`: browser/server export clients and shared archive contract.
- `lib/server/`: authenticated project API handlers and state validation.
- `lib/pdf-*.ts`: scan extraction, layout, annotation interchange and rendering.
- `deploy/runtime/`: local workerd host, export jobs and PDF worker-thread pool.

## Checks

```sh
npm run check
npm run lint
npm run format:check
npm run check:size
npm test
npm run test:export
npm run build
```

Tests use synthetic documents and isolated Miniflare D1/R2 bindings; no private competition files or Clerk credentials are required. Rendering tests require Poppler (`pdftoppm` and `pdftotext`; Debian/Ubuntu package `poppler-utils`). Scratch files are written under ignored `.test-tmp`.

See [CODE_REVIEW.md](CODE_REVIEW.md) for resolved findings, validation and remaining limits.

## Deployment

The live instance is https://opravovna.tech, running Docker on a server behind Cloudflare Tunnel. Database and file storage are local persistent volumes; this avoids hosted Workers CPU limits during application requests. See [deploy/README.md](deploy/README.md) for setup, backups and updates.

Self-hosting needs an always-on server and domain. Cloudflare Tunnel can connect it without an exposed inbound port. Hosted Cloudflare Workers/D1/R2 remain possible, but the framework and PDF workload need capacity testing before choosing that route.

## Practical limits

Imports accept up to 1 GiB compressed, 2 GiB expanded, 2000 solutions and 40 MiB per original PDF. Browser ZIP loading still requires memory proportional to the archive. Export jobs process PDFs in parallel but pack one archive at a time. A document revision conflict requires choosing which state to keep; synchronization is not simultaneous character-level collaboration.

Scan rotation currently requires a supported standalone raster image on an upright PDF page. It rotates the embedded image pixels, excluding surrounding PDF text and borders. White margins already baked into the image remain part of that scan. Flattened exports preserve visual annotations but cannot recover their original editable objects.

## One-command deployment

Run `just deploy` from a clean, committed checkout. It runs type/lint/format/size checks and all API, PDF, export and deployment tests, builds and pushes a commit-tagged GHCR image, then pins its registry digest in the unified stack. It backs up the compose file, consistent SQLite snapshots and all persisted PDF/archive blobs before restarting only Opravovňa. Database integrity and file hashes are verified; a failed backup stops deployment. Full backups include a SHA-256 manifest under the server’s `/mnt/data/backups/opravovna/deploy-…/state/` directory. Failed container startup or local health checks restore the previous compose image automatically. Public HTTP and permission checks follow deployment. `just check` runs the checks alone.

The default target is `r2d2@r2d2`, stack `/home/r2d2/unified`, image `ghcr.io/yastrab1/opravovna` and site `https://opravovna.tech`. Override with `DEPLOY_HOST`, `DEPLOY_STACK`, `DEPLOY_IMAGE` and `DEPLOY_ORIGIN`, `DEPLOY_BACKUP_ROOT`. SSH and Docker registry login must already work. Build keys load from ignored `.sites-runtime/clerk-production.env`, or `DEPLOY_ENV_FILE`; environment variables also work. Set `CLERK_TEST_SESSION_ID` with `CLERK_SECRET_KEY` to include the existing-session authenticated smoke test. No secrets belong in the justfile or repository.
