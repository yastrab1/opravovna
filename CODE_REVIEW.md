# Code review — 2026-10-10

## Resolved findings

| Area | Finding and correction |
| --- | --- |
| Imported grades | Numeric strings and grades outside the old 0–5 range could stop import. Scores now accept finite non-negative numbers without an upper limit. A single preflight dialog collects replacements for negative/non-numeric values before upload. Decimal dots and commas are normalized, linked editable stamps are updated, and cancel stops the import. |
| API validation | Grade, page, rotation, annotation and tag validation is centralized. Request byte limits are enforced while reading streams, and invalid JSON returns a client error. Negative grades are rejected on both initial document creation and later edits. |
| PDF decoders | PDF.js 6 requires version-matched WASM and fallback assets for JBIG2/CCITT scans. Build preparation copies decoders, CMaps and standard fonts; browser document creation and Node export use centralized asset options. Monochrome bitpacked and browser bitmap images are supported. |
| Import interruptions | Safe read/upload-chunk requests have bounded retries. Already stored PDFs are not uploaded again. Lost archive-completion responses are confirmed against server state before continuing. A failed solution names the file and preserves earlier successful work for re-import. |
| Text comments | New comments use bounded text boxes and wrap at the right margin, including oversized unbroken tokens. Formatting handles imported character overrides and selected ranges. Text boxes can move between pages with zoom-aware coordinates, edge scrolling and undo/redo; appended pages activate immediately. |
| Scan rotation | Cropping a rendered page also captured PDF headers and surrounding decoration. The renderer now decodes the embedded raster itself, reserves header space, centers it and fits it to the available area. Preview/export use the same layout and clockwise orientation. Unsupported pages are rejected before recording a rotation. |
| Canvas lifecycle | Fabric wrapped a React-owned canvas, creating competing DOM ownership during page changes. React now owns an empty host and Fabric owns the inserted canvas. Disposal completes before the next canvas initializes. Inactive pages render annotation previews. |
| Saving and synchronization | Edits arriving during an in-flight save could be left behind when switching documents. The save queue drains pending changes and updates revisions immediately. Stale polling responses are ignored after changing projects. |
| Tag round trips | Final exports previously omitted tags. Optional namespaced metadata inside root points.json now preserves the project vocabulary and each exported solution's tag names, IDs and colors, including empty assignments. Original Arnold score fields remain unchanged. |
| Project presence | Authenticated, project-scoped heartbeats use trusted Clerk names/photos. Read-only members participate; multiple tabs deduplicate by account. Leave only removes the caller’s session, abandoned sessions expire, and revoked members are excluded immediately. Follow targets are project-validated, resolve freshly on click, and prefer the most recently focused tab rather than background heartbeats. Browser checks verify immediate location updates, fresh document loading, save-before-navigation and preserving unsaved edits on conflicts. |
| Review filters and defaults | All list filters (search, grading status, tag, categories, decimal point comparisons) and sorting persist per project in account preferences. Account-keyed pending edits recover after immediate reloads; writes are debounced and serialized. Regression coverage checks complete filter restoration, account/project isolation and legacy preferences. The settings tool selector is visually separated from the selected tool's default-value fields; its static layout is verified in headless Firefox. |
| Merge PDF versions | Choosing an incoming version now commits its PDF and state together using an optimistic revision check. Replayed uploads are idempotent, previews use the actual incoming PDF, and editor/thumbnail caches follow file versions. Duplicate detection no longer hides changed drawings behind identical original bytes. |
| Export contract | Browser and server export implementations duplicated archive assembly. Shared helpers preserve original PDF basenames, include only graded PDFs, write Arnold's root `/points.json` entry and reject duplicate basenames. No wrapper folder or `_graded` suffix is introduced. |
| Export isolation | The runtime separates jobs, archive packing and a bounded thread pool. Job/download access is scoped to the initiating account and current project permission. External annotation image references are rejected in both renderers. |
| Maintainability | Workspace/editor composition, persistence, dialogs, import preparation, API handlers and renderer tasks have focused modules. Unused starter UI and dependencies were removed. Application TypeScript/JavaScript files have an enforced 300-line ceiling. |
| Dependency/runtime compatibility | Updated vulnerable framework/PDF/Fabric dependencies and pinned patched container transitive dependencies. The container keeps a stable Workers compatibility date, avoiding a newer build-tool default exceeding the self-hosted binary's supported date. |
| Public repository preparation | Runtime data, credentials, private PDFs/ZIPs and dependency directories are ignored. Tests use synthetic documents. Bundled font notices are included. |

## Validation

- TypeScript check, ESLint, formatting and application source-size checks.
- API tests against isolated Miniflare D1/R2: authentication boundary, project isolation, owner/editor/viewer permissions, revocable join links, upload ownership, multipart persistence, optimistic revisions, grade removal, decimal scores above five and negative-score rejection.
- Import-score tests: valid decimal strings, values above five, grouped invalid-score correction, linked stamp changes, untouched comments and cancellation.
- Decoder tests: versioned WASM over HTTP, native filesystem decoding, JavaScript fallback, real upstream JBIG2 sample and monochrome/bitmap scan rotation.
- Text tests: page-edge wrapping, long tokens, imported character styles, range formatting, serialization and zoom-aware page transfers. Browser checks cover pointer insertion on added pages, existing-text formatting, cross-page dragging, edge scrolling and undo/redo.
- Network tests: bounded transient retries, no replay of non-idempotent writes, permission-error handling and lost archive completion recovery.
- Merge tests: disjoint exports, unchanged duplicates, empty-state protection, both conflict choices and legacy metadata preservation.
- Native renderer tests with Poppler output: raster-only rotation at 90/180/270 degrees, upright headers, centered maximum fit, preview/export parity, annotations and appended pages.
- Threaded archive tests: exact root schema, original filenames, decimal metadata, text/path/image rendering, appended pages, job isolation, cached retry and rejection of remote image URLs.
- Production container startup and HTTP health; real Clerk cookie/bearer authentication, anonymous/invalid-session rejection, and authenticated validation on the public deployment. Project creation was tested only in an isolated localhost container.
- Secret scans of the Git history and staged public source before publication.

Production application dependencies and the container runtime each report **zero vulnerabilities** with `npm audit --omit=dev` at review time. The complete development dependency tree still has upstream advisories involving glob parsing and the Drizzle build toolchain. These are tracked by Dependabot; npm's suggested major downgrades are not applied blindly. Run `npm audit` to obtain the current advisory list.

ESLint exits successfully. Remaining warnings identify deliberately stable ref-backed effect lifetimes. Those effects have been reviewed; compiler-only rules that misclassify imperative canvas refs are scoped in the lint configuration.

## Remaining limits

- Browser UI end-to-end testing could not run because the browser-control service was unavailable. Native rendering, API integration, build, container startup and real authentication were exercised; interactive scrolling and editing still need a human browser smoke check.
- Arnold itself was not executed. Interoperability checks verify the supplied archive contract and generated metadata/PDFs.
- The browser holds imported ZIPs in memory. Server export rendering is parallel, but source ZIP loading and one archive's packing still consume memory proportional to its contents.
- Rotation supports a standalone raster on an upright PDF page. Margins baked into that raster remain image pixels. Complex tiled, skewed, masked or pre-rotated image layouts are rejected.
- Flattened corrected exports cannot reconstruct editable annotation objects. Correcting an imported score updates metadata and any linked editable stamp; an old score already flattened into a PDF cannot be erased automatically.
- Unresolved merge choices are held in browser memory; after a reload, re-import the ZIP to reconstruct them.
- Synchronization detects document revision conflicts; it is not simultaneous character-level collaborative editing.

## Release status

The reviewed release includes score corrections, decoder assets, resilient imports, comment wrapping and atomic PDF-version merging. It is tested in an isolated container before the unified stack is updated to a pinned image digest.
