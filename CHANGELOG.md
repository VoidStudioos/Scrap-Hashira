# Changelog

All notable changes to **Hashira Scraper** are documented here.

## [2.0.0] - Production Release

### Added
- **Multi-Stage Automatic Detection**:
  - DOM hierarchy and structural similarity clustering.
  - JSON-LD and Schema.org Product/ItemList parsing.
  - Table matrix extractor handling `rowspan`, `colspan`, and nested tables.
  - Pagination next-button and load-more heuristics.
- **Smart Learning Engine**:
  - Persistent profile storage indexed by domain and URL patterns.
  - Multi-signal selector resilience (CSS + XPath fallback + semantic tags).
  - Structural DOM fingerprinting for automatic drift and redesign detection.
  - Profile import/export via standardized JSON.
- **Smart Site Explorer**:
  - Hierarchical visual sitemap generator.
  - Link classification: Categories, Listings, Details, Documents, Internal Pages.
  - Branch selection with strict domain-locking to prevent unauthorized external crawls.
- **Advanced Image Collector**:
  - Extraction from `img.src`, `srcset` resolution parsing (selecting highest available resolution), `<picture><source>`, `data-src`, and CSS `background-image`.
  - Machine-classifier distinguishing Product, Thumbnail, Logo, Icon, and Banner images.
  - SHA-256 deduplicated binary download queue with HTTP 429 exponential backoff.
- **Crash-Proof Resume Engine**:
  - IndexedDB durable state persistence for `CREATED`, `RUNNING`, `PAUSED`, `INTERRUPTED`, `COMPLETED`, `FAILED`.
  - MV3 service worker termination resilience via `chrome.alarms` heartbeat watchdog.
  - Automatic interrupted queue recovery.
- **Comprehensive Export Center**:
  - Formats: JSON, JSON Lines (JSONL), CSV (formula-injection protected with UTF-8 BOM), Excel (.xlsx).
  - Complete master ZIP export with `manifest.json`, `data/`, `pages/`, `images/`, `metadata/`, and `logs/`.
- **Localization & Themes**:
  - Full English and Persian (fa) localization with RTL/LTR switching.
  - Dark and Light modes.
  - Responsive Chrome Side Panel interface and quick-launch popup.
- **Testing & Verification**:
  - 30 automated Vitest unit and integration tests passing at 100%.
