# Media and live-page capture — 0.3.0

Start extraction now checkpoints the selected tab's rendered DOM before crawling other URLs. This preserves the currently opened SPA catalog state. It does not automatically traverse every JavaScript click-only branch: use Branch Capture and enter the actual branch path for those branches. DOM trees and breadcrumbs are extracted when present; unseen descendants cannot be inferred reliably.

## Formats

Images: JPEG, PNG/APNG, GIF (original animation bytes retained), WebP, AVIF, BMP, safe SVG and ICO. TIFF, HEIC/HEIF and JPEG XL are identified by signatures and saved without conversion; their manifest validation is `signature-only`, not a claim of successful decoding or file completeness. GIF labeled image/jpg is identified from GIF bytes and saved as .gif.

Direct video candidates: video/src, video/source, common video anchors and Open Graph video metadata. MP4, MOV, WebM, Matroska, AVI and Ogg Theora signatures determine filenames. Video validation is signature-only; codec playback, duration and full-file integrity are not verified. No transcoding or thumbnail extraction. A wrong content-type or missing URL extension does not determine the saved format.

Blob/MediaSource and m3u8/mpd streams are reported with limitations, not silently saved as video. No DRM or streaming-segment assembly. Unknown formats fail with a diagnostic; this release does not support every possible media format.

Videos use the existing bounded fetch/retry/resume/host-approval/download-confirmation pipeline. Default limit: 100 videos per job. The existing per-resource byte limit (20 MB default, configurable up to 100 MB) still applies, so large movies require another authorized download workflow. UI permits disabling video downloads. No video autoplay or prefetch is used in preview.

## Hierarchy and exports

Manual branch paths remain preserved in download and ZIP folders. Automatic downloads use rendered breadcrumb paths when available. ZIP exports include original video bytes under videos/, all resource statuses in metadata, discovered video candidates in classification/videos.json, and observed category paths in classification/tree.json plus an indented tree.txt. Unresolved branches require user navigation; path guessing is not treated as verified hierarchy.

## Windows update

Unzip Hashira_Scraper_v0.3.0_Chrome.zip. Replace the contents of the existing unpacked extension folder with hashira-scraper-chrome contents, keeping the same folder location. In chrome://extensions click Reload and verify 0.3.0. Reload the target website once, log in if required, reopen the desired catalog branch, Analyze, then Start a new job. Existing jobs retain their original queues/configuration; they are not automatically rescanned by upgrading.

Next improvements: approved click-only branch traversal with durable interaction paths, bounded page-local blob transfer, JSON-LD video associations, codec-aware video validation, and native Windows acceptance tests.
