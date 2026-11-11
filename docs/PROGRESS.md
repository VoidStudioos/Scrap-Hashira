# Development phases and evidence

| Phase                      | Implementation                                                                           | Evidence / remaining validation                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1. Repository/architecture | Modular strict TypeScript, build and interfaces                                          | Type check and build                                                                |
| 2. Chrome extension/UI     | MV3 manifest, popup, side panel, offscreen resource processor                            | Built; browser UI harness; native installation blocked by host environment          |
| 3. Detection               | Generic semantics/repetition, JSON-LD, optional adapters                                 | Unit and multi-layout browser fixtures                                              |
| 4. Visual selector         | Overlay, repeated ancestors, CSS/XPath, field rules                                      | Actual browser pointer/click test                                                   |
| 5. Smart Learning          | Origin/pattern profiles, drift validation, correction history                            | Unit and persistent browser profile test                                            |
| 6. Explorer                | URL classification, discovery-only job, live tree/branches                               | Tree unit tests and scheduler scope tests                                           |
| 7. Images                  | Broad advertised discovery, byte fetch, decode, hashing and Chrome managed-download flow | Six raster formats and SVG core tests; real Chrome Downloads acceptance pending     |
| 8. Crawler                 | Bounded URL/depth/filter traversal, dynamic interaction                                  | Scheduler integration and JavaScript fixture interaction                            |
| 9. Full Capture            | Inert HTML/text/metadata/JSON/tables, explicit JSON APIs and accessible PDFs             | Capture sanitization and export tests; broad authenticated-site coverage pending    |
| 10. Resume                 | Transactions, leases, restart states, download reconciliation                            | Rollback/reopen and simulated dead-worker/restart tests; native termination pending |
| 11. Exports                | JSON/JSONL/CSV/XLSX/HTML ZIP/dataset ZIP, actual image bytes                             | Browser export-worker and ZIP/XLSX integrity tests                                  |
| 12. Performance            | Bounded traversal/concurrency/resources, batched DB, worker exports, budget guards       | Config/policy tests; large-scale benchmarks not claimed                             |
| 13. Security               | Least privilege, scope, CSP/redaction, formula/path and byte checks                      | Unit/integration checks; external professional audit not claimed                    |
| 14. Tests                  | Vitest, Playwright and representative local fixtures                                     | Exact executed counts in TEST_RESULTS.md; native suite separate                     |
| 15. Production build       | Local Vite/esbuild output, no remote runtime code                                        | Build succeeds; production certification remains open                               |
| 16. Packaging/docs         | Source, prebuilt Chrome ZIP, Windows instructions, results and roadmap                   | ZIP integrity and SHA-256 package manifests                                         |

All listed modules contain executable functionality. No TODO/placeholder path is used to represent completed behavior. Pending platform validation and supported alternatives are stated explicitly in LIMITATIONS.md and TEST_RESULTS.md.

## 0.2.0 semantic extraction update

Implemented automatic typed fields, ARIA/list/breadcrumb trees, per-category JSON/CSV outputs and offline image click indexes. Semantic snapshots persist alongside page data without an IndexedDB schema migration. Image files are shared with explicit per-category references. New pages gain semantic metadata; older jobs need recapture for new classification. Executed results: 51 Vitest tests, 20 Playwright core/UI/semantic tests, type/build/lint pass. Native Chrome acceptance remains open.

## 0.2.1 options recheck

All twelve UI sections were reviewed and exercised through a browser harness. Configuration forwarding, image selections and profile edits are covered. Scope/concurrency/cooldown/timeout/export/profile-validation issues were corrected with regressions. Executed: 69 unit/integration and 24 browser tests, lint and build pass. Native retry: setup failure before extension loading (full Chrome SIGSEGV); two remaining native tests did not run. See OPTION_RECHECK_FA.md for limits and unsupported cases.
