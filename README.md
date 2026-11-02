# Hashira Scraper — Intelligent Local-First Chrome Extension v2.0

> **Hashira Scraper** is an enterprise-grade, local-first Chrome extension designed for deep web data extraction, actual high-resolution image acquisition, adaptive site learning, crash-proof resumption, and intelligent hierarchical website exploration.

---

## 🌟 Key Features

1. **One-Click Automatic Data Detection**
   - Multi-stage structural analysis: DOM hierarchy, repeated sibling element discovery, text density, Schema.org / JSON-LD extraction, and table structures.
   - Real-time confidence scoring and interactive preview table.

2. **Smart Learning Engine (Core Feature)**
   - Learns site extraction profiles from user selections and corrections.
   - Resilient selector engine: primary CSS selectors with automated XPath fallback, text-label relationships, and structural DOM fingerprints.
   - Detects website redesigns and structural drift automatically.
   - Full JSON import/export of site profiles.

3. **Smart Site Explorer**
   - Scopes and visualizes internal site structure into a navigable tree.
   - Automatic URL classification: Categories, Listings, Product Detail Pages, Pagination, Documents (PDF/Excel), and Internal Pages.
   - Branch selection to scrape only approved subcategories without crawling external domains.

4. **Advanced Image Discovery & Downloader**
   - Discovers image sources from `img.src`, `srcset` (choosing highest resolution candidate), `<picture><source>`, `data-src`, `data-original`, and CSS `background-image`.
   - Automatic classification: Product image, Thumbnail, Logo, Icon, Banner.
   - Actual binary downloads via Chrome Downloads API into organized folders (`PRODUCT-123456/`).
   - Bounded concurrent queue with exponential backoff on HTTP 429.
   - SHA-256 deduplication and MIME type integrity checks.

5. **Crash-Proof Resume Engine**
   - IndexedDB durable queue persisting all states: `CREATED`, `RUNNING`, `PAUSED`, `INTERRUPTED`, `COMPLETED`, `FAILED`.
   - Fully resilient against Chrome Manifest V3 service worker termination (30s inactivity kill) using `chrome.alarms` watchdogs and durable checkpoints.
   - Automatically recovers interrupted queues upon browser restart.

6. **Comprehensive Export Center**
   - Formats: JSON, JSON Lines (JSONL), CSV (formula-injection protected with UTF-8 BOM), Microsoft Excel (.xlsx), and raw HTML snapshots.
   - Complete production ZIP archive matching exact specification with data, snapshots, images, and telemetry manifests.

7. **Bilingual & Accessible UI**
   - English and Persian (fa) localization with full RTL (Right-to-Left) and LTR layout switching.
   - Modern Dark and Light themes.
   - Responsive Chrome Side Panel alongside web pages + quick-launch popup.

---

## 🚀 Quick Start (Installation)

1. Clone or download this repository.
2. In terminal:
   ```bash
   npm install
   npm run build
   ```
3. Open Google Chrome and navigate to `chrome://extensions`.
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the `dist/` folder in this repository.
6. Alternatively, extract `hashira-scraper-v2.0.0.zip` and load the unzipped folder.

See [INSTALLATION.md](file:///c:/Users/Administrator/Desktop/AG/Extension/INSTALLATION.md) for detailed step-by-step instructions.

---

## 🧪 Testing

Run the full automated test suite (30 unit and integration tests):
```bash
npm test
```

See [TESTING.md](file:///c:/Users/Administrator/Desktop/AG/Extension/TESTING.md) for details on test coverage and fixtures.

---

## 🔒 Security & Privacy

Hashira Scraper operates strictly **local-first**. No scraped data, authentication credentials, or browser cookies are ever transmitted to external servers.

See [SECURITY.md](file:///c:/Users/Administrator/Desktop/AG/Extension/SECURITY.md) for our security architecture.
