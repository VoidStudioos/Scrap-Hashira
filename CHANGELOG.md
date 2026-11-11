# Changelog

## 0.2.2 — 2026-11-11

- Capture multiple open catalog branches from the original browser tab, with explicit paths and durable checkpoints even when the page URL stays the same.
- Accept embedded images declared as image/jpg and save with the file extension verified from the decoded data.
- Link shared files from nested category folders and preserve clickable image evidence when a JavaScript handler provides no URL.

## 0.2.1 — 2026-11-03

- Rechecked all twelve UI navigation options and configuration-to-job wiring.
- Fixed stale previews/site selections, query-category boundaries and selected-branch detail traversal.
- Counted existing native saves against concurrency and made server cooldowns monotonic across API/resource responses.
- Added content-analysis deadlines/cooperative abort and text/attribute mutation settling.
- Fixed profile editing identity, validated malformed profiles/configuration and preserved generic fallback on corrupt saved rules.
- Added consistent-export guards, bounded API response reads and semantic typing of API records.
- Hardened SVG style/animation checks; exposed traversal modes and corrected the displayed version.
- Extended unit/integration and browser UI/content regression coverage; native browser startup remains blocked.

## 0.2.0 — 2026-11-03

- Automatic semantic field typing: identifiers with leading-zero preservation, generic numbers, prices, quantities, text and URLs.
- ARIA trees, nested lists/navigation and breadcrumb hierarchy with stable category IDs, parent/child paths and collapsed-branch diagnostics.
- Clickable thumbnail/original relationships, advertised extensionless gallery endpoints and byte-verified image links in exports.
- Per-category JSON/CSV files and an offline clickable HTML index, preserving record/category/resource relationships and shared image bytes.
- Semantic preview, persisted semantic snapshots, new unit and real-browser regression coverage.
- Native desktop extension acceptance remains pending; this is still a preview release.

## 0.1.0 — 2026-11-02

- Original MV3 extension, React workspace and local bundled build.
- Generic multi-site DOM/JSON-LD extraction, platform hints and nested tables.
- Visual selector, persistent origin-scoped deterministic learning and profile import/export.
- Bounded explorer/crawler, scoped URL queues, snapshots, authorized session reuse and robots checks.
- Image candidate discovery, real-byte validation, MIME/decode/SHA-256 checks, durable managed-download flow and product associations.
- Atomic checkpoints, lease reclamation, interrupted-job handling and bounded error recovery.
- JSON/JSONL/CSV/XLSX/HTML/ZIP exports, streaming JSONL alternative and formula/path protections.
- Persian normalization, localized RTL/LTR UI, dark/light themes and real persisted statistics.
- Local fixtures, unit/integration/core-browser tests and a separate native acceptance suite.
- Preview release: native extension/Windows acceptance remains open due the delivery environment's full-Chrome socket restriction.
