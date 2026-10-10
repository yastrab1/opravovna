# Opravovňa

Slovak, collaborative PDF grading workspace. Built with React, Vinext, Clerk, Cloudflare D1/R2, PDF.js, Fabric, pdf-lib, JSZip and MessagePack.

## Run locally

Requires Node 22.19+ (Node 24 recommended) and npm.

```sh
npm ci
npx clerk@latest init
npx clerk@latest env pull --file .dev.vars
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_premium_leech.sql
npm start
```

For this checkout, Clerk is already configured and the initial local migration has been applied. Start with `npm run dev` (build, then local Worker at http://127.0.0.1:8787). This intentionally uses the compiled Worker because the experimental framework's hot development runner has a dependency-loading issue. `npm run dev:hot` remains available for framework debugging.

Local D1/R2 data lives in ignored `.wrangler/state`. `.env.local`, `.dev.vars`, Clerk credentials and database contents are never included in source archives.

## Workflow

1. Sign in with Clerk and verify your primary email.
2. Create a project, then upload an original solutions ZIP or a corrected export.
3. Import stores the source ZIP with 8 MiB R2 multipart chunks. A pool of three workers extracts and uploads PDFs independently. Interrupted imports can be retried; existing submissions are preserved.
4. Search by name, submission ID or year code. Select multiple categories, filter graded/ungraded, or filter by tags.
5. Annotate with text, drawing, highlighter, image, arrow, rectangle or ellipse. Change font, size, color and line width. Rotate pages or append blank pages. Select objects to move/resize/delete; Ctrl+Z and Ctrl+Shift+Z undo/redo current-document edits.
6. Enter a numeric score (0–5, including decimals such as 4.67) and insert a score stamp on the current page. Assigning a new score replaces the previous score annotation. Imported scores retain their original precision.
7. Changes save after one second and synchronize every five seconds. A stale revision is rejected; download the unsaved state before loading the server version after a conflict. This is shared persistence with conflict detection, not simultaneous character-level co-editing.
8. Share from the modal. Add verified Clerk email addresses as editors or viewers. Alternatively generate a revocable join link, granting editor access to anyone signed in with that link. Revoking a link prevents future joins; remove existing members separately. No invitation emails are sent.
9. Import further corrected exports into the same project to merge work. Incoming empty records keep existing edits; incoming edits replace empty records; differing edits on both sides open a conflict modal. Compare scores, comments, tags, annotation counts or generate PDF previews, then pick the first (existing) or second (incoming) version for each solution. You can choose the same side for all conflicts. Export stays disabled until conflicts are resolved. If you postpone resolution, the notice reopens the dialog; a page reload requires re-importing the ZIP to reconstruct unresolved choices.
10. Export a corrected ZIP. PDF processing runs on the client, leaving the original pages intact and painting high-resolution annotations onto the separate graded PDF.

## Archive contract

Filename parser: `p<problem>-c<category>-<hyphenated-name>-<submission-id>.pdf` within the original problem folder. Alphabetic category codes (`k`, `p`, `s`, `t`, etc.) are preserved verbatim; no unverified year mapping is invented. Filename-derived names cannot recover diacritics not present in the filename.

- Original ZIP and PDF bytes are stored on the server.
- The server parses submission filenames and MessagePack `changes.arn` metadata.
- Import restores per-submission changes, tags and scoring, and preserves project-level scoring criteria and unknown legacy fields.
- Original PDF paths and `<submission-id>_graded.pdf` paths remain unchanged.
- Export contains MessagePack `changes.arn` with the original root structure (`tags`, `changes`, `scoringCriteria`). Names of score annotations remain linked through `scoring.annotName`.
- Text, paths and images remain editable interchange records. Geometric tools are serialized as SVG paths. Text styles are written in the legacy object-map format, rather than Fabric 6's compact array format.
- `opravovna.json` version 1 additionally preserves rotations and appended-page state for lossless re-import into this app. Existing tools can use the graded PDFs without understanding this supplemental file.
- Export filename derives from the original problem folder, independent of the project's display name. For the supplied folder it is exactly `4. Kto druhemu jamu kope sam do nej spadne_opravene.zip`.

The original sample has 176 submissions; the corrected sample contains 175 originals. The latter also contains zero and fractional scores, so these are preserved. The actual downstream software has not been run here; compatibility is verified against its supplied archive structure and metadata. Support for the supplemental rotation/page state in that software is unknown.

## Limits and permissions

ZIP up to 1 GB compressed, 2 GB expanded, 2000 submissions; individual PDFs up to 40 MB. The browser holds the ZIP for import/export and needs enough memory for large projects. R2 uploads and API endpoints require a verified Clerk user and check project roles. All writes check same-origin requests when an Origin header exists. Revisions prevent silent concurrent overwrites. The first deployment should remain private until production Clerk setup is complete.

## Validation

Tests use mocked verified identities against real local Miniflare D1 and R2 bindings; they do not bypass production authentication.

```sh
node --experimental-strip-types tests/api.mjs
node --experimental-strip-types tests/merge.mjs
node tests/pdf-render.mjs
npx tsc --noEmit
npm run build
```

Tests reference the supplied ZIPs one directory above this checkout. They cover permissions, viewer restrictions, join/revoke, upload ownership, multipart persistence, decimal scores, stale revision rejection, filename metadata, exact export naming, MessagePack roundtrip and PDF flattening, disjoint export merging and conflicting first/second version decisions. The renderer hydrates legacy annotations, preserves annotation IDs, checks appended pages/rotation and generates scratch PDFs/PNGs under `.test-tmp/pdf/` for visual inspection. It uses a native static canvas, not an automated browser. Browser end-to-end interaction has not been verified because the session's browser-control service is unavailable.

## Deploy

Recommended: Cloudflare Workers + D1 + R2. They provide free usage allowances suitable for a small team, subject to current quotas and billing requirements. Clerk has a free plan with its own limits. PDF rasterization and ZIP work happen in the browser to keep server CPU requirements low.

This checkout retains the Sites integration and `.openai/hosting.json` project identity for the private hosted version. Sites handles its D1/R2 provisioning and migrations. Production publication is pending Clerk's production setup, which requires your domain/DNS configuration:

```sh
npx clerk@latest deploy
npx clerk@latest deploy status
```

For independent Cloudflare hosting, build and create your own Wrangler deployment config based on `dist/server/wrangler.json`: set your Worker name, real D1 database ID, R2 bucket, `migrations_dir`, and asset directory. Apply migrations to your remote database, configure `CLERK_SECRET_KEY` using Wrangler secrets, and build with your production `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Never put the secret key in vars, source control or client bundles. Use your own domain matching the Clerk production instance. Deploy with `wrangler deploy` after applying migrations.

The dark charcoal/slate design follows the supplied editor reference, with cyan tools and active rows, warm orange scoring actions, and lazy PDF thumbnails. The local server explicitly serves static assets before invoking the framework Worker; the PDF.js worker is bundled as a versioned URL. This avoids the empty framework static-file marker response that originally prevented PDF loading.

## Account preferences and test deployment

Nastavenia beside the account saves per-tool color, line width and text font/size/bold/italic (including the grading stamp). Defaults, each project's selected categories and alphabetical/graded-first sorting are stored in the signed-in user's Clerk metadata. Category display uses 5–9 and prima/sekunda/tercia/kvarta; ZIP codes remain unchanged. Zrušiť hodnotenie removes the score and its stamp and supports undo.

The independent Cloudflare test environment uses `wrangler.test.json`, a separate D1 database and R2 bucket. It uses Clerk development credentials for testing on workers.dev, not a production Clerk instance. It starts with an empty project database; local project files are not copied automatically.

```sh
npm run build
node scripts/prepare-cloudflare-test.mjs
npx wrangler d1 migrations apply opravovna-test --remote --config wrangler.test.json
npx wrangler deploy --config wrangler.test.json
```

Set Clerk runtime keys using Wrangler secrets (never commit their values). Rebuild after changes to the publishable key.
