# Architecture

## Components

| Module                        | Responsibility                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `src/background/index.ts`     | MV3 event listeners, validated extension-page commands, job creation and alarms         |
| `src/background/scheduler.ts` | Scoped URL queue, tab lifecycle, robots checks and atomic checkpoints                   |
| `src/background/downloads.ts` | Resource fetches, MIME/hash verification, Chrome download submission and reconciliation |
| `src/background/offscreen.ts` | Local Blob URLs and browser image validation; runtime messaging only                    |
| `src/content`                 | Isolated-world DOM analysis, bounded interaction and visual overlay                     |
| `src/engines/detection`       | Generic repetition, JSON-LD, tables and optional platform hints                         |
| `src/engines/learning`        | Reusable selector rules, drift validation and profile import validation                 |
| `src/engines/explorer`        | Link classification and a depth-aware tree                                              |
| `src/engines/images`          | Advertised image discovery, byte signatures, bounded reads and image decode             |
| `src/engines/resume`          | Lease reclamation, interrupted jobs and pause/resume transitions                        |
| `src/storage`                 | Dexie schema and persisted statistics                                                   |
| `src/exports`                 | Format generation in a Web Worker and streaming JSONL                                   |
| `src/components`              | Independent UI views, scope controls, previews, profiles and jobs                       |
| `src/security`                | URL scope, filename/cell validation, redaction and inert HTML capture                   |

The extension's service worker contains no DOM-dependent capture code. Content analysis is bundled as a single isolated-world IIFE. Extension pages/background use local ES modules. The offscreen page uses IndexedDB and `chrome.runtime`; Chrome Downloads calls are issued by the background worker.

## Durable state

`jobs`, `pages`, `records`, `snapshots`, `resources`, `blobs`, `profiles`, `logs` and `selections` are separate IndexedDB tables. A page lease has a worker owner and deadline. A checkpoint transaction commits extracted records, snapshot, newly discovered URLs, image references, the finished task and job checkpoint together. Partial transactions roll back.

Page states: `PENDING → LEASED → DONE`, with bounded retries and `FAILED` / `BLOCKED` alternatives.

Resource states: `PENDING → FETCHING → FETCHED → SAVING → COMPLETED`. `FETCHED` means validated bytes exist locally; it does not claim a separate disk file exists. `SAVING` retains Blob URL and Chrome download ID. Reconciliation searches Chrome downloads after startup/events and checks `state === complete && exists`. A worker dying between submission and ID persistence can reconcile through the stored Blob URL. Duplicate bytes share the SHA-256-addressed Blob store and can reference an already confirmed file.

A fresh service worker reclaims foreign/expired leases. Browser `onStartup` marks running jobs `INTERRUPTED`, restores queues and waits for explicit Resume. Completed files of unfinished jobs are checked when recovery runs. Files of finished jobs are not silently recreated if a user deletes them. Stored bytes remain exportable.

## Scheduling and boundaries

- Synchronous Chrome event registration at worker module load.
- Persistent 30-second alarm re-created when missing; the open side panel also requests scheduling ticks.
- No background setInterval, permanent keepalive, long-running page timer or dependency on global-memory queues.
- At most three page tabs; downloads bounded by user concurrency and per-resource byte budget. Server throttling reduces effective concurrency and persists cooldowns.
- Request delay separates page batches; bounded parallel requests inside a batch can start together. Closing the panel can reduce throughput because Chrome controls alarm timing.
- A global in-worker guard serializes scheduler batches. IndexedDB is authoritative across worker restarts. A task is replayable and content identities use SHA-256 text fingerprints.
- All page discovery remains inside the approved exact origin. External resource origins require both per-job approval and Chrome host permission. External images are not preview-fetched automatically in the collector.
- Robotic access rules are loaded before a job traverses pages. Unavailable/non-success robots responses pause the job except a normal 404. An unsupported site policy must be handled by the user; no evasion is implemented.

## Extension points

Register a new `PlatformAdapter` in `adapters.ts`: supply a signature and optional selector hints. It cannot replace the crawler/storage/downloader. Profiles are data-only rules, scoped to exact origins and matching URL globs. Multiple profiles/groups can be selected. Invalid/stale profiles retain generic preview and diagnostics.

Exports are generated in a dedicated Web Worker. Formats requiring whole workbooks/ZIPs enforce estimated byte budgets; they are not advertised as unlimited streaming. JSONL can stream in 250-record batches to a user-chosen file.

## 0.2.1 recheck

PageTask.branchId preserves selected-branch provenance when a category links to product/detail URLs outside the category path. Sibling query categories are filtered using the selected query parameters. Persistent server cooldownUntil is distinct from normal inter-batch blockedUntil and extends monotonically. Native SAVING resources count against download concurrency. Content messages have a timeout/request ID and cooperative ABORT handling. Non-running/no-in-flight export guards avoid reading a moving record set. Explicit JSON endpoints use bounded streaming reads and feed scalar values into semantic category/type exports.
