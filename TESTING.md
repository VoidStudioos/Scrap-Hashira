# Testing

## Reproduce

```powershell
npm ci
npm run build
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run test:extension
```

`test:e2e` runs core and UI browser-harness suites against local fixtures. `test:extension` separately loads the actual MV3 build in full Chromium and exercises Chrome APIs; headless shell cannot substitute for extension acceptance. Set `HASHIRA_NATIVE_CHROME` to a full browser executable only when necessary. `HASHIRA_CHROMIUM_PATH` selects the browser used by core/UI tests. These are test configuration variables, not product settings.

## Fixtures

The local server on `127.0.0.1:4173` contains 100 unique sample products, four pages of a custom catalog, detail pages, a WooCommerce-like layout with pagination, Persian/RTL cards, JavaScript hydration/Load More/scroll behavior, nested tables with merged cells, seven image formats, galleries, srcset/picture, CSS backgrounds, lazy attributes, JSON-LD, PDF, an explicit JSON API and 403/404/429/auth/corrupt-resource paths. No external site credentials are needed.

## Coverage boundaries

- Unit: normalization, numeric formats, URL scope, globs, robots, signatures, filename/formula protections, inert captures, generic detection, tables, selectors, drift, profile imports and SHA-256 identifiers.
- Integration: atomic rollback/reopen, scheduler checkpoints, page bounds, duplicate content, dead-worker leases, browser-restart interruption, authentication pause, robots boundaries, permanent errors, Retry-After and unapproved resource hosts. Chrome APIs are controlled fakes in this suite.
- Browser harness: actual Chromium DOM/layout/interaction, IndexedDB profiles, real image bytes/decoding, export workers and ZIP/XLSX round trips. The UI test uses explicit fake Chrome APIs and real fixture data.
- Native suite: actual manifest installation, Chrome managed downloads, persistent crawl pause/resume and CDP forced worker termination. This needs a normal desktop/full browser environment. Fixture-only host access is added to a temporary copy **after** the untouched production-manifest installation check. That temporary grant is not shipped.

The report identifies each layer separately. A simulated scheduler test is not proof of native worker termination, Downloads API callbacks, permission dialogs, or Windows behavior.

## Manual desktop acceptance

1. Load `dist` in current desktop Chrome with no pre-existing permissions.
2. Confirm permission is requested for the selected site only.
3. Run all five layouts and then an unfamiliar authorized real site.
4. Inspect card/table/profile/image associations and select a narrower scope.
5. Confirm actual image files and their byte hashes in Downloads.
6. Pause/resume a job; stop its extension service worker; restart Chrome and explicitly resume.
7. Export and open JSON/CSV/XLSX/ZIP. Check Persian, image bytes, raw/normalized tables and per-record references.
8. Revoke a host permission and observe a pause/block. Trigger authentication and 429 fixtures and verify no bypass or unbounded retry.
9. Test narrow/RTL layout, keyboard use and theme changes.
10. Test storage quota pressure and an export above the selected memory budget.

See [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md) for the delivered run, rather than assuming all acceptance items were executed.
