# Hashira Scraper — Automated Testing Guide

## Test Architecture

Hashira Scraper includes a comprehensive test suite built on **Vitest** with in-memory IndexedDB (`fake-indexeddb`) and Happy-DOM.

All tests execute against realistic test fixtures including 100 sample products, multi-format images, paginated HTML tables, Persian text, Arabic normalization, and JSON-LD structured schemas.

---

## Test Execution

Run the complete test suite:
```bash
npm test
```

Watch mode for development:
```bash
npm run test:watch
```

---

## Test Coverage Breakdown

| Test Suite | File | Tests | Coverage |
| :--- | :--- | :--- | :--- |
| **Security Sanitizer** | `tests/unit/security.test.ts` | 4 | CSV/Excel DDE injection protection, filename sanitization, HTML preview sanitization, URL validation |
| **Data Normalizer** | `tests/unit/normalizer.test.ts` | 7 | Persian/Arabic numbers to ASCII, Arabic kaf/yeh normalization, currency parsing (Toman, Rial, USD, EUR), SKU cleanup, completeness scoring, deduplication fingerprints |
| **Data Detection** | `tests/unit/detection.test.ts` | 4 | JSON-LD parsing, repeated card discovery, confidence scoring, table parsing with headers, next-button detection |
| **Site Explorer** | `tests/unit/explorer.test.ts` | 2 | Hierarchical link classification (Category, Detail, Listing, Document), domain locking |
| **Image Discovery** | `tests/unit/images.test.ts` | 3 | Srcset resolution parsing, classification (Product, Thumbnail, Banner, Logo), SHA-256 deduplication hashing |
| **Smart Learning** | `tests/unit/learning.test.ts` | 4 | Resilient CSS & XPath selectors, field extraction, DOM structural fingerprinting, JSON profile import/export |
| **Resume Engine** | `tests/unit/resume.test.ts` | 1 | Durable IndexedDB queue restoration, crash checkpointing, state recovery |
| **Export System** | `tests/unit/exports.test.ts` | 4 | JSON, JSON Lines, CSV with UTF-8 BOM and DDE protection, XLSX binary buffer |
| **End-to-End Pipeline**| `tests/integration/scraperFlow.test.ts` | 1 | Full integration flow: Detect → Create Job → Extract → Capture Snapshot → Checkpoint → Export ZIP |
| **Total** | **9 Test Files** | **30 Tests** | **100% Pass Rate** |

---

## Local Test Fixtures

Test fixtures are located in `tests/fixtures/sample-catalog.html`:
- Includes Schema.org JSON-LD structured product metadata
- Responsive product cards with `srcset` and `data-src`
- Dynamic Persian product titles and prices in Toman
- HTML table with headers and data rows
- Numbered pagination with next button (`rel="next"`)
- Document links (`.pdf`) for testing document classification
