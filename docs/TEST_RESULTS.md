# Test results — 0.2.2 branch capture

2026-11-11. Strict TypeScript, ESLint, the production build and 72 Vitest tests passed. New regression coverage checks mislabeled inline GIF bytes, extensionless images, nested Persian ZIP paths, repeated branch captures at a single URL, download filename/MIME and shared image deduplication. The queue integration test uses a simulated Chrome Downloads API.

The native manifest smoke test was blocked at Chromium startup because the container denied its Unix singleton socket. The browser never loaded the extension. The live authenticated catalog was not tested.

## Historical 0.2.1 options recheck

Run date: 2026-11-03. **69 unit/integration tests and 24 real-browser harness tests pass**. ESLint and strict TypeScript/Vite/esbuild production build pass. Reports: `recheck-unit-results.json`, `recheck-browser-results.json`, and `recheck-native-results.json`.

New coverage checks all twelve navigation options, presets/numeric/flag/API/traversal configuration reaching job creation, current image selection, profile identity-preserving edits, selected query-category boundaries and detail provenance (including old queued tasks), in-progress download concurrency, monotonic Retry-After, bounded JSON API capture and semantic typing, export guards, malformed-profile fallback, SVG external-style rejection, content timeout and actual bundled Load More/Full Capture/ABORT handling. Deleting a job preserves shared image bytes needed by other jobs.

**Native acceptance was attempted again and did not pass.** The native runner records one setup failure and two tests not run. Full Chrome exits with SIGSEGV before extension loading. A separate no-extension control and even the same binary's `--version` invocation also crash. The precise launch failure is not established. Consequently native manifest installation, permission dialogs, Side Panel/Offscreen/Downloads integration, forced worker termination and Windows behavior remain unverified. Successful harness tests do not replace those checks.

A detailed Persian feature/status matrix and fixes are in [OPTION_RECHECK_FA.md](OPTION_RECHECK_FA.md). This remains a preview release for desktop validation, not production certification.

---

## Historical delivery reports (earlier counts below are historical)

# Test results — delivered 0.2.0 update

Run date: 2026-11-03. Strict TypeScript/Vite/esbuild production build and ESLint pass. **51 unit/integration tests and 20 real-browser harness tests pass**, with zero failed tests. The machine-readable files alongside this report contain the executed results.

New coverage includes eight labeled/ambiguous type cases, ARIA and generic nested-list hierarchy, collapsed branch reporting, breadcrumb-to-record category assignment, identifier zero preservation, advertised extensionless gallery targets, category/type-separated exports and offline clickable HTML. A real-browser fixture verifies an extensionless AVIF click target using its actual bytes, then confirms `verified-image` metadata and a working archive path to the stored full image.

Existing multi-site detection, 100-product catalog, persistence, raster/SVG validation, image-file hash checks, ZIP/XLSX exports and Persian/RTL UI regression tests remain passing.

**Native installation/Chrome Downloads/MV3 forced-termination acceptance remains unverified.** This update uses the same browser-harness layer described below; no native acceptance pass is claimed. The 0.1.0 native startup restriction has not been resolved or retested as a successful native run.

---

## Historical 0.1.0 delivery evidence

### Test results — delivered 0.1.0 build

Run date: 2026-11-02. Environment: Linux container, Node.js 24.22.1, Chromium headless shell 153.0.8010.0 for the browser harness. Production assets target Chrome 120+.

| Check                                             | Executed result         | Meaning                                                                                                                    |
| ------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Strict TypeScript + Vite/esbuild production build | PASS                    | Bundled local extension assets generated                                                                                   |
| ESLint                                            | PASS                    | No lint errors                                                                                                             |
| Vitest                                            | 38 passed, 0 failed     | Unit/integration behavior; Chrome APIs are controlled fakes in queue tests                                                 |
| Playwright core/UI harness                        | 18 passed, 0 failed     | Real DOM interactions, browser IndexedDB, image decoding, export workers and normal browser file downloads                 |
| Native MV3 installation and Chrome API acceptance | BLOCKED / not completed | Full Google Chrome 156.0.8078.79 aborts before extension loading because the container prohibits its Unix singleton socket |
| Windows Chrome manual acceptance                  | NOT EXECUTED            | Needs desktop Windows/current Chrome                                                                                       |

Final browser run: 9.5 seconds. The final test output and machine-readable reports are included as `browser-results.json` and `unit-results.json`. Earlier failures were fixed and the final core/UI run passed. No failed/blocked native checks are counted as passes.

## Verified browser behavior

- Custom unfamiliar catalog, a commerce-platform fixture, Persian/RTL cards and JavaScript-rendered cards use the same detection engine.
- All four catalog pages yield 100 distinct product identities.
- Load More interactions append records; merged/nested/paginated tables preserve their intended grids.
- Visual pointer/click selection chooses repeated records and does not follow the clicked page link.
- Learned profiles survive reload, validate matching selectors and fall back on layout drift.
- JPEG, PNG, WebP, AVIF, GIF and BMP bytes decode at 640×480; safe SVG verifies at 320×240 and scripted SVG is rejected.
- For **each of five substantially different fixtures**, the core workflow detects records/data, persists them, fetches/validates actual image bytes, creates a normal browser download, reads the resulting disk file and compares its SHA-256, reopens stored data without duplicate records, and exports a ZIP whose image bytes match the downloaded file.
- JSON, JSONL, CSV, XLSX, HTML snapshot ZIP and dataset ZIP round-trip; Persian text, record/image references, embedded image bytes and snapshots are present.
- The actual React UI renders fixture previews and persisted zero statistics without inventing completed work; Persian RTL, light theme and 420-pixel width pass. Chrome APIs are explicitly faked for this UI harness.

## Verified integration behavior

- Atomic checkpoint rollback and successful database reopen.
- Scoped bounded queue, duplicate page fingerprints and concurrent commits honoring max-pages limits.
- Dead-worker lease reclamation preserves completed records.
- Simulated browser startup interrupts jobs until Resume.
- Authentication pauses, robots-disallowed pages remain unvisited, permanent 404 failures terminate with diagnostics.
- 429 Retry-After persists a cooldown and bounded retry count; an unapproved CDN host is never fetched.
- Persian character/digit/price normalization, selector resilience, imported-profile scope, spreadsheet formula protections, safe paths, redacted embedded secrets and inert captures.

## Native acceptance gap

Full Chrome was downloaded from Google's official distribution and its version command succeeded. Attempted browser startup failed with:

```text
FATAL:chrome/browser/process_singleton_posix.cc
socket() failed: Operation not permitted
```

That happens before a manifest or extension service worker can load. The passing browser harness uses a real headless Chromium binary that does not include extension support. It cannot validate Manifest V3 installation, host-permission dialogs, Chrome Side Panel behavior, Offscreen/Downloads API integration, native background-worker termination or a full Chrome restart. Their functional implementation and a separate `npm run test:extension` acceptance suite are included; they remain **unverified** here.

Ordinary browser download/file/hash tests are real file checks but must not be represented as evidence that `chrome.downloads.onChanged` has run successfully. Simulated queue/restart tests likewise must not be represented as native MV3 shutdown evidence.

The release is a functional preview. Production sign-off requires the native suite and desktop checks in TESTING.md, plus broader real-site/dependency review.
