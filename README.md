# Hashira Scraper

A local-first, multi-site Chrome Manifest V3 extension with a React side panel, generic rendered-DOM extraction, user-corrected site profiles, scoped crawling, image-file downloads and portable exports.

**Version 0.2.2 — branch capture preview release.** Source and production bundles are supplied. Core/browser-harness tests pass; native extension installation, real Chrome Downloads callbacks and forced MV3 worker termination still require the included acceptance suite on a full desktop Chrome/Chromium installation. This is not a claim of completed production certification.

## Install on Windows

1. Extract `Hashira_Scraper_v0.2.2_Chrome.zip` to a permanent folder.
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**.
3. Select the folder containing `manifest.json` (the `hashira-scraper-chrome` folder).
4. Pin Hashira Scraper, open an authorized website and click **Open workspace**.
5. Choose **Analyze current tab**, grant access to that site, review records and scope, then start.

No Node.js or server is required for the prebuilt extension. Chrome 120+ is the minimum declared version. Chrome on iPhone does not load desktop extensions. See [INSTALLATION.md](INSTALLATION.md) and [docs/WINDOWS_FA.txt](docs/WINDOWS_FA.txt).

## Implemented workflow

- Generic card/list extraction from structural repetition and semantics; JSON-LD product records and key-value specifications. Optional Shopify, WooCommerce, Magento, PrestaShop and OpenCart selector hints always retain the generic fallback.
- Confidence-scored preview; selectable extraction groups and image URLs; manual field rules with CSS, semantic attributes, text labels and XPath fallbacks.
- Persistent origin/URL-scoped profiles, coverage/structure validation, extraction history and import/export. This is deterministic learning, not machine learning.
- Bounded explorer jobs with a live URL tree; category/detail/pagination traversal, include/exclude globs, same-origin enforcement, robots.txt rules and duplicate fingerprints.
- Bounded scrolling, Load More clicks and MutationObserver settling for rendered JavaScript pages.
- Nested HTML tables, rowspan/colspan expansion and original/normalized structures.
- Image discovery from img/currentSrc/srcset/picture, lazy attributes, CSS URL/image-set candidates, metadata and JSON-LD. Advertised candidates are verified by bytes and browser decoding; no guessed high-resolution URLs.
- Durable fetch/write states, bounded retries, Retry-After cooldowns, content hashes, image/product references, MIME signatures and raster/SVG validation. Bytes remain in IndexedDB for export. Separate image files are complete only after Chrome reports completion and existence.
- Existing Chrome-session browsing with manual login; pause on detected authentication/access walls. No password/token collection.
- Optional inert HTML snapshots, metadata, visible text, embedded JSON with secret-key redaction, accessible PDFs and explicitly configured same-origin JSON API GET paths.
- Atomic page checkpoints, lease reclamation, browser-restart interruption and explicit resume, checkpoints and error history.
- JSON, JSONL, UTF-8 CSV, XLSX, HTML snapshot ZIP and dataset ZIP with image bytes, references and logs. Streaming JSONL uses the File System Access API when available.
- English/Persian interface, RTL/LTR and dark/light themes. Diagnostic messages retain technical identifiers in English.

## Automatic semantic classification (0.2.1)

Hashira now detects tree/ARIA/navigation/breadcrumb hierarchies, typed codes, numeric values, prices, quantities, text and clickable image targets. ZIP exports include `classification/` and per-category `categories/<code-name-id>/` folders with separate JSON/CSV files plus an offline clickable `index.html`. Identifier strings preserve leading zeroes. Ambiguous values retain confidence and evidence. Shared image bytes are stored once and linked from each category. See [docs/SEMANTIC_EXTRACTION_FA.md](docs/SEMANTIC_EXTRACTION_FA.md).

## Build from source

Install Node.js 22.12+ or 24 LTS, then run:

```powershell
npm ci
npm run build
```

Load the generated `dist` directory in Chrome. All runtime code and libraries are bundled locally. Nothing is fetched as executable code at runtime.

```powershell
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run test:extension
npm run package
```

Core/browser-harness tests and native extension acceptance are separate. See [TESTING.md](TESTING.md) and [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md) for exactly what ran in the delivery environment.

## Documentation

- [Architecture and durable-state design](ARCHITECTURE.md)
- [Installation and usage](INSTALLATION.md)
- [Security and permissions](SECURITY.md)
- [Known limitations](docs/LIMITATIONS.md)
- [Roadmap](docs/ROADMAP.md)
- [Development phases and acceptance evidence](docs/PROGRESS.md)

The extension does not bypass CAPTCHA, authentication, access rules or rate limits. Run it only on data you are authorized to access. Unusual sites may require a visual profile; support for every website is not promised.
