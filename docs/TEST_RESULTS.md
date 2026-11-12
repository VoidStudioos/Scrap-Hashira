# v0.3.0 — 2026-11-12

- Vitest: 84 tests passed across 9 files.
- ESLint: passed.
- Strict TypeScript and production build: passed.
- Added tests: mislabeled GIF, video/container signatures, unsupported streams, limits, video queue/byte storage/Chrome completion mocks, and CREATE_JOB live-tab checkpoint without opening a new tab.
- Native Playwright: attempted; first attempt lacked bundled Chromium. Retried with /usr/lib/chromium/chromium; browser aborted before extension load: socket() failed: Operation not permitted. One setup failure, two tests did not run. Native installation, real Chrome downloads, worker restart and Windows target-site behavior remain unverified.
- Signature-only tests establish classification and queue behavior, not codec decoding or full video integrity.
