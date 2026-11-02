# Hashira Scraper — Security & Privacy Architecture

## Security Principles

Hashira Scraper is architected with strict security and data privacy standards:

1. **Local-First Processing**
   - 100% of scraped HTML, records, images, and sitemaps remain in the user's browser (IndexedDB).
   - No data is transmitted to third-party tracking, analytics, or external cloud backends.

2. **Least Privilege Chrome Permissions**
   - `storage` & `unlimitedStorage`: Used exclusively for saving scraping jobs, records, and learned profiles in IndexedDB.
   - `downloads`: Used solely to save user-requested image files directly to the local filesystem without remote intermediaries.
   - `alarms`: Used for heartbeat watchdogs to recover service worker state on inactivity.
   - `sidePanel`: Used to display the non-intrusive side control interface.
   - `activeTab` & `scripting`: Injected only into the active webpage when the user triggers data detection, visual selection, or scraping.

3. **Spreadsheet Formula Injection (DDE) Prevention**
   - Exported CSV and XLSX files sanitize all cell values starting with `= `, `+`, `-`, `@`, `\t`, or `\r`.
   - Dangerous formula prefixes are escaped with a leading single quote (`'`), preventing malicious command execution when opened in Excel or LibreOffice.

4. **Filename & Path Traversal Sanitization**
   - Image filenames and export directory paths are sanitized to eliminate path traversal characters (`..`, `/`, `\`) and illegal filesystem characters (`< > : " | ? *`).
   - Length limits are enforced to avoid OS-level buffer overflow or MAX_PATH issues.

5. **HTML Preview Sanitization**
   - Live extraction previews and table previews strip `<script>`, `<iframe>`, `<object>`, `<embed>`, inline event handlers (`onerror`, `onclick`), and `javascript:` URLs to eliminate Cross-Site Scripting (XSS).

6. **Authentication Boundaries**
   - Scraping utilizes the user's existing Chrome session without ever reading, exporting, or storing authentication passwords, tokens, or cookies.
   - If an authenticated session expires during crawling, the job enters a `PAUSED` state awaiting manual user re-authentication.

7. **Anti-Evasion Policy**
   - Hashira Scraper does not implement CAPTCHA bypass, stealth fingerprint spoofing, or rate-limit evasion mechanisms.
   - Crawlers respect bounded request delays and server 429 rate limit directives using exponential backoff.
