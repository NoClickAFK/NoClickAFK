# Cleanup evidence

## Accidental artifact

- `THIS_SHOULD_NOT_EXIST` was removed by the squashed PR #64 net tree. It had no loader, dynamic reference, Service Worker entry, report/reset consumer, global export, test dependency, or compatibility logic.

## Confirmed orphan files

| File | Loader/dynamic | SW | Full-suite request | Report/reset | Tests | Required global | Unique compatibility | Replacement |
|---|---|---|---|---|---|---|---|---|
| `archive-safety-v400.js` | none | no | no | none | none | none | none | active `archive-label-v400.js` already hides permanent deletion for preset locations |
| `role-guard-v400.js` | none | no | no | none | none | none | none | active `archive-label-v400.js` plus `viewer-extra-v400.js` provide viewer locking |
| `sw-register-v33.js` | none | no | no | none | none | none | none | active `version-authority-v426.js` registers the Service Worker |
| `sw-register-v340.js` | none | no | no | none | none | none | none | active `version-authority-v426.js` registers the Service Worker |
| `version-v34.js` | none | no | no | none | none | none | none | active `version-authority-v426.js` and `access-version-v400.js` own version display |

## Consolidated files

- `card-progress-v460.css` merged into `card-progress-v448.css`.
- `ui-refine-v462.css` merged into `card-progress-v448.css`.
- `ui-refine-v462.js` merged into `card-progress-v448.js`; `window.BogatkaUIRefineV462` remains available as a compatibility surface.
- `index.html`, `v23.js`, and `sw-v340.js` now load/cache only canonical assets.

## Blocked files

`actions.js`, `compare-v332.js`, `diagnostics-v400.js`, `recovery-v31.js`, `sw-v3.js`, `sw-v33.js`, `sw-v34.js`, and `ui.js` remain `UNKNOWN_BLOCKED` and were not deleted.
