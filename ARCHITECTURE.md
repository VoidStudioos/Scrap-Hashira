# Hashira Scraper — System Architecture

## Overview

Hashira Scraper is built on **Chrome Manifest V3** with strict TypeScript, React, Tailwind CSS, Zustand, and Dexie.js (IndexedDB). It adheres to a local-first, modular architecture designed for high throughput, memory safety, and complete resilience against browser worker termination.

```
                    ┌─────────────────────────┐
                    │      Active Webpage     │
                    └────────────┬────────────┘
                                 │ Content Script Injection
                    ┌────────────▼────────────┐
                    │      Content Script     │
                    │   - Page Scanner        │
                    │   - Visual Selector     │
                    │   - DOM Extractor       │
                    └────────────┬────────────┘
                                 │ Chrome Runtime Messaging
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Side Panel  │◄───────►│  Background  │◄───────►│    Popup     │
│  Control UI  │         │Service Worker│         │ Quick Launch │
└───────┬──────┘         └───────┬──────┘         └──────────────┘
        │                        │
        └───────────┬────────────┘
                    ▼
       ┌────────────────────────┐
       │   IndexedDB (Dexie)    │
       │ - Jobs & Checkpoints   │
       │ - Profiles (Learned)   │
       │ - Extracted Records    │
       │ - Discovered Images    │
       │ - Page Snapshots       │
       └────────────────────────┘
```

---

## Core Components

### 1. Storage & Persistence (`src/storage/`)
- **Engine**: IndexedDB managed via Dexie.js (`HashiraScraperDB`).
- **Tables**:
  - `jobs`: Tracking scraping lifecycle (`CREATED`, `RUNNING`, `PAUSED`, `INTERRUPTED`, `COMPLETED`, `FAILED`, `CANCELLED`).
  - `profiles`: Reusable learned site patterns with DOM fingerprints and multi-signal selectors.
  - `records`: Normalized and raw product/catalog items with completeness scores.
  - `extractedTables`: Normalized HTML table structures with headers and row matrices.
  - `images`: Image manifests with SHA-256 deduplication hashes and download statuses.
  - `queue`: Durable URL crawl queue with depth levels and status tracking.
  - `snapshots`: Full rendered HTML snapshots with metadata.
  - `logs`: Diagnostic error and info telemetry.

### 2. Detection Engine (`src/engines/detection/`)
- Multi-stage pipeline:
  1. **Structured Data**: JSON-LD and Schema.org `Product` / `ItemList` graph parsing.
  2. **Card Clustering**: Repeated sibling element discovery via tag and class similarity heuristics.
  3. **Table Analysis**: Extraction of regular and dynamic tables, handling `rowspan` and `colspan`.
  4. **Pagination**: Next-button, numbered pagination, and load-more detection.
- Generates candidate schemas with deterministic confidence metrics.

### 3. Smart Learning Engine (`src/engines/learning/`)
- Solves website fragility by saving validated site profiles.
- **Selector Resilience**:
  - Primary CSS selector.
  - XPath fallback generated alongside semantic attributes.
  - DOM structure fingerprinting (`generateDomFingerprint`) to detect site updates or structural drift.
- Supports profile import and export in JSON format.

### 4. Image Discovery & Downloader (`src/engines/images/`)
- **Discovery**: Evaluates `img.src`, `srcset` descriptors (`w` / `x`), `<picture><source>`, `data-src`, `data-original`, and CSS `background-image`.
- **Classification**: Distinguishes product photos from thumbnails, logos, icons, and banners.
- **Download Queue**:
  - Bounded concurrency controls (1 to 8 concurrent streams).
  - Exponential backoff for HTTP 429 (Rate Limit).
  - Binary SHA-256 deduplication to prevent duplicate file downloads.
  - Downloads saved via Chrome Downloads API into structured folders (`hashira_images/PRODUCT_ID/`).

### 5. Multi-Page Crawler (`src/engines/crawler/`)
- Durable queue-driven crawling with configurable depth and page boundaries.
- Prevents infinite loops through content fingerprinting and visited URL sets.
- Smooth automated scrolling for lazy-loaded image triggers.

### 6. Crash-Proof Resume Engine (`src/engines/resume/`)
- **Chrome MV3 Service Worker Termination Mitigation**:
  - MV3 service workers shut down after 30 seconds of inactivity.
  - Uses `chrome.alarms` for periodic heartbeat monitoring (`hashira_job_watchdog`).
  - State is persisted continuously in IndexedDB so that restarts immediately detect interrupted tasks and restore incomplete queues without data loss.

### 7. Export Engine (`src/exports/`)
- Formats: JSON, JSONL, CSV (with DDE formula injection prevention), and XLSX.
- Full master ZIP generation matching specification:
  ```
  hashira-export/
    manifest.json
    data/
      products.json
      products.csv
      products.xlsx
      tables.json
    pages/
      page-001.html
    images/
      PRODUCT-001/
    metadata/
      images.json
      pages.json
      errors.json
    logs/
      scraping-log.json
  ```
