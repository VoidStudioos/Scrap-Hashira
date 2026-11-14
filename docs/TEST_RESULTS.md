# v0.3.1 portability recheck — 2026-11-14

- Initial clean npm ci exposed an unavailable tinyglobby 0.2.27 tarball (HTTP 404).
- Pinned explicit tinyglobby override to 0.2.17 and regenerated its lock entry.
- Clean dependency installation succeeded with Node 24.22.1 / npm 11.9.0.
- Vitest: 84 tests passed across 9 files. ESLint and strict TypeScript/Vite/esbuild passed.
- Release pipeline validates ZIP CRCs, SHA-256 archive checksums, manifest version, required runtime files and each packaged runtime file against BUILD_MANIFEST.json.
- Source archives use an explicit list of source roots and root files; node_modules, local test results and git history are excluded.
- Native Chrome acceptance is NOT included in the release command. Previous native test attempts could not launch Chromium because socket() was denied by the environment. Windows/macOS and the authenticated target site remain unverified.
- Media, streaming, click-only traversal and job migration limitations remain documented in DEPLOYMENT_FA.md and MEDIA_0.3.0.md.

- Repeated the entire release command from the Complete ZIP extracted into a fresh path containing spaces: passed. Its runtime inventory hashes matched the primary build exactly.
