# Security and permissions

## Required API permissions

| Permission  | Use                                                                        |
| ----------- | -------------------------------------------------------------------------- |
| `activeTab` | User-initiated access to the current website tab                           |
| `scripting` | Inject the bundled isolated-world DOM analyzer/selector on granted hosts   |
| `storage`   | Persist theme, language and default configuration                          |
| `downloads` | Create managed local files and reconcile their actual completion/existence |
| `sidePanel` | Show the extraction workspace next to the user's page                      |
| `alarms`    | Durable periodic scheduling across MV3 worker termination                  |
| `offscreen` | Decode stored image bytes and hold local Blob URLs without an open UI      |

There are no required host permissions. `http://*/*` and `https://*/*` are optional manifest declarations so an unfamiliar site can be supported. Runtime prompts request the exact chosen site's origin. No `cookies`, `webRequest`, `debugger`, `history` or `unlimitedStorage` permission is requested. The Tabs API is used without the broad `tabs` permission; granted hosts/activeTab expose the necessary site tab metadata.

## Boundaries

- No telemetry, cloud backend, credential storage, automatic login, password form submission, CAPTCHA solving, stealth fingerprinting or proxy/IP rotation.
- Extension commands accept messages only from the same extension. Content-script senders may submit a selection for their own URL; privileged commands require extension-page senders.
- Discovery defaults to an exact origin and bounded queues. Destructive-looking logout/delete/checkout routes are excluded. API paths must be explicit same-origin GET paths. Cross-origin resource approvals are stored per job and must also be granted in Chrome.
- Authentication/access walls pause the page queue; permanent HTTP errors do not retry forever. 429 responses persist cooldowns; downloads use Retry-After and reduce effective concurrency.
- Robots allow/disallow groups and wildcard/end rules are checked. The implementation is intentionally conservative for inaccessible robots responses. robots.txt is not a permission grant: the user must still have authorization.
- Resource requests reject redirects rather than silently contacting a new origin. A redirecting image is diagnosed; use an accessible approved final URL in a profile when appropriate.
- HTML preview is rendered through React text nodes, never inserted as active site HTML. Captures remove scripts, active frames/objects, input values, event handlers and dangerous URL attributes, then apply a restrictive offline CSP.
- Structured/API data recursively drops keys resembling passwords, tokens, sessions or secrets. This is a protective heuristic, not a guarantee that all sensitive business content is removed. Capturing authorized visible data is the purpose of the extension.
- Images require recognized byte signatures and browser decode; active SVG scripts/foreignObject/event handlers/external hrefs are rejected. Supported PDF documents require a PDF signature. Formats outside the allowlist fail visibly.
- SHA-256 identities/deduplication; filename normalization rejects separators, Windows device names, traversal and controls. Export spreadsheet cells neutralize leading formula characters including whitespace-prefixed payloads. Data is never interpreted as spreadsheet formulas.
- ZIP/XLSX generation has estimated memory checks. Individual network resources have enforced byte limits and timeouts. Browser storage quota pressure pauses scheduling.

## Dependencies and updates

Runtime dependencies are React, Zustand, Dexie, JSZip and SheetJS (`xlsx`) with a committed lockfile. SheetJS's npm 0.18.5 release has known advisories in workbook parsing; this application **only writes workbooks**. It does not import untrusted XLSX files. The only XLSX reads are tests of generated fixtures. Do not add workbook import without selecting and reviewing a maintained patched parser. This constraint is a release limitation, not a declaration that the dependency is generally vulnerability-free.

No remote executable scripts or libraries are loaded. Development test dependencies are excluded from the production bundle. A Chrome Web Store release needs dependency/license review and full desktop/native acceptance before publication.
