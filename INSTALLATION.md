# Installation and usage

## Prebuilt Windows installation

1. Extract the Chrome ZIP fully. Do not choose the ZIP itself in Chrome.
2. Put the extracted `hashira-scraper-chrome` folder somewhere permanent, for example `C:\Tools\HashiraScraper`.
3. Open `chrome://extensions` in desktop Chrome 120 or newer.
4. Turn on **Developer mode** and click **Load unpacked**.
5. Choose the folder directly containing `manifest.json`.
6. Pin the extension from Chrome's Extensions menu.
7. Open a normal HTTP(S) website. Restricted Chrome pages and the Chrome Web Store cannot be injected.
8. Click Hashira, then **Open workspace**. Choose the website tab from the top dropdown if necessary.

For the complete source ZIP, the prebuilt extension is in `hashira-scraper/dist`. Loading the source repository root will fail because it does not contain the built content/background bundles next to the source manifest.

## First extraction

1. Log into the authorized site manually if required; keep this Chrome profile/session.
2. Click **Analyze current tab**. Chrome asks for the site's host access. The extension declares potential HTTP(S) hosts as optional; it requests only this origin at runtime.
3. Inspect fields, confidence and the preview. Choose a candidate extraction group and analyze again if needed.
4. Set max pages/depth/images, delays, scrolling and snapshots. Defaults are intentionally bounded.
5. Click **Start extraction**. New background tabs are created only for queued in-scope pages; your original tab is preserved.
6. If a CDN/image host needs access, the job reports it. In Jobs Manager, approve that origin, grant Chrome permission, and Resume. A denied host remains visible as a blocked operation.
7. Use Pause/Resume. An in-flight page may finish its checkpoint while pausing; scheduled pages stop and Chrome downloads are paused where supported. Cancel stops scheduling and requests cancellation of active managed downloads.
8. Export from Export Center. ZIP contains validated stored bytes even if a separate Chrome download failed; the manifest preserves each operation's actual status.

## Visual corrections and learning

- Open Visual Selector or Smart Learning and choose **Select on page**.
- For a record selection, Hashira finds the nearest repeated block. Alt selects the immediate parent; Escape exits.
- Use the selection's Record button to fill the record selector.
- Enter a field name, select its element and add it as a field. With a saved record selector, generated field CSS is relative to that record.
- Edit selectors, attributes and transformations; save the profile. Review its URL patterns before saving.
- Profiles are validated on matching pages; invalid rules produce diagnostics and a generic fallback.
- Profile checkboxes allow selecting multiple extraction groups. Re-analyze after changing rules or group selections.
- Export/import profiles as JSON. Imports do not grant website permission and never execute code.

## Explorer

Analyze a page, then open Smart Site Explorer. The initial tree is the current page's internal links. **Explore bounded pages** starts a discovery-only job using your current page/depth/filter limits and builds a tree from captured links as pages finish. Select branches to constrain the later extraction job. You can pause explorer jobs from Jobs Manager.

## Data and files

Managed image downloads are grouped under `Downloads/Hashira/<job>/images/<product>/`. Chrome controls the real Downloads root and may apply operating-system policies. Names are normalized for Windows. Original image format is preserved. Hash identities provide stable names across retries.

Dataset ZIP:

```text
hashira-export/
  manifest.json
  data/products.json
  data/products.csv
  data/products.xlsx
  data/tables.json
  pages/page-0001.html
  images/<product>/<content-hash>.<original-extension>
  documents/<product>/<content-hash>.pdf
  metadata/images.json
  metadata/pages.json
  metadata/errors.json
  logs/scraping-log.json
```

HTML snapshots are inert and block remote resources/scripts. Raw and normalized records are retained in JSON; tables include original HTML and span-expanded grids. XLSX/CSV contain normalized records. CSV has a UTF-8 BOM for Persian compatibility in Excel. JSONL streaming exports normalized rows in batches; JSON includes the richer raw data.

Do not uninstall the extension or clear its site data before exporting: IndexedDB is local browser storage, not a cloud backup. Moving an unpacked extension to a different path can change its identity and storage. Export profiles/data before moving it.

## Development

Node.js 22.12+ or 24 LTS. Run `npm ci`, `npm run build`. Reload the unpacked extension in `chrome://extensions` after rebuilding. `npm run dev` serves UI assets only; extension APIs require the loaded build.

If Chrome shows a service-worker error, inspect it from the extension's card and compare Diagnostics. See TESTING.md for native acceptance instructions and the current environment limitation.

## 0.2.1 recheck fixes

Changing pages clears stale previews and image/candidate selections; changing origins also clears site-specific profile/branch choices. Saving an edited learning profile updates its existing identity; use New profile for a separate group. Category query parameters are enforced and linked detail/pagination tasks inherit the selected branch. Download concurrency counts files already being saved by Chrome. Server cooldowns cannot be shortened by a later response. Timeout also bounds content analysis and requests cancellation of bounded interactions. Pause and wait for active page/fetch checkpoints before exporting.
