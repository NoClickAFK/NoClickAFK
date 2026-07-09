# Dependency inventory — 2026-07-08

Scope: comparison startup flicker / version 4.3.0 PR.

Baseline main: `3a1f7ab24ed19e09583442b5f465792d187c4749`.

## Direct runtime assets from `index.html`

### Static CSS loaded directly

- `style.css`
- `v21.css`
- `v22.css`
- `v23.css`
- `cloud.css`
- `premium-v30.css`
- `auth-v31.css`
- `members-v32.css`
- `stability-v33.css`
- `inspection-layout-v461.css`
- `polish-v34.css`
- `insights-v331.css`
- `compare-v332.css`
- `decision-v340.css`
- `critical-deal-v430.css`
- `compare-v340.css`
- `suite-v400.css`
- `visual-v411.css`
- `decision-panel-v412.css`
- `workflow-v414.css`
- `workflow-fixes-v415.css`
- `workflow-refine-v440.css`
- `location-profile-v416.css`
- `location-overview-v417.css`
- `location-panels-v419.css`
- `location-card-collapse-v422.css`
- `status-next-task-v447.css`
- `card-progress-v448.css`
- `quick-checklist-v451.css`
- `location-data-v452.css`
- `traffic-competitors-v453.css`
- `launch-gate-v454.css`
- `opening-project-v455.css`

Classification: active runtime.

### Static JS loaded directly

- Supabase CDN `@supabase/supabase-js@2`
- `supabase-config.js`
- `config.js`
- `core.js`
- `ui-v2.js`
- `location-v2.js`
- `report-v2.js`
- `report-v22.js`
- `v21.js`
- `v22.js`
- `critical-deal-schema-v430.js`
- `critical-deal-refine-v433.js`
- `v23.js`
- `cloud.js`
- `premium-v30.js`
- `auth-v31.js`
- `auth-signup-fix-v31.js`
- `members-v32.js`
- `stability-v33.js`
- `inspection-layout-v461.js`

Classification: active runtime.

## Dynamic runtime JS loaded by `v23.js`

- `auth-v31.js`
- `auth-signup-fix-v31.js`
- `members-v32.js`
- `invites-v408.js`
- `stability-v33.js`
- `stability-v331.js`
- `polish-v34.js`
- `account-v34.js`
- `insights-v331.js`
- `version-guard-v340.js`
- `critical-deal-schema-v430.js`
- `decision-core-v340.js`
- `suite-core-v400.js`
- `decision-ui-v340.js`
- `compare-v430.js`
- `suite-ui-v400.js`
- `archive-label-v400.js`
- `backup-v400.js`
- `report-v400.js`
- `access-version-v400.js`
- `visual-v411.js`
- `decision-panel-v412.js`
- `workflow-v414.js`
- `workflow-fixes-v415.js`
- `workflow-refine-v440.js`
- `score-guide-fix-v415.js`
- `sync-field-compat-v416.js`
- `field-integrity-v416.js`
- `object-type-normalize-v416.js`
- `location-profile-v416.js`
- `location-evaluation-refine-v446.js`
- `location-overview-v417.js`
- `location-overview-init-v417.js`
- `location-panels-v419.js`
- `location-panels-render-v419.js`
- `location-card-collapse-v422.js`
- `report-live-v427.js`
- `report-live-fixes-v427.js`
- `report-polish-v428.js`
- `report-authority-v428.js`
- `status-next-task-v447.js`
- `card-progress-init-v448.js`
- `card-progress-v448.js`
- `card-progress-report-v448.js`
- `landlord-conditions-v449.js`
- `technical-economics-v450.js`
- `technical-economics-report-v450.js`
- `quick-checklist-v451.js`
- `quick-checklist-report-v451.js`
- `location-data-v452.js`
- `location-data-stability-v452.js`
- `durable-fields-v452.js`
- `selftest-v400.js`

Classification: active runtime, compatibility, report-only, or migration support depending on the module. Files listed as compatibility in `ACTIVE_WORKING_SET.md` remain protected from deletion.

## Service Worker cached assets

`sw-v340.js` caches all direct runtime files above plus additional compatibility/report/reset assets, including:

- compatibility / migration: `critical-deal-persistence-v453.js`, `sync-field-compat-v416.js`, `field-integrity-v416.js`, `object-type-normalize-v416.js`, `location-data-stability-v452.js`, `durable-fields-v452.js`, `traffic-competitors-persistence-v453.js`, `traffic-competitors-compat-v453.js`, `object-type-reset-stability-v453.js`, `opening-project-persistence-v455.js`, `release-integrity-v456.js`, `cloud-stability-v401.js`, `sync-merge-v412.js`, `sync-state-v412.js`, `sync-runtime-v412.js`, `sync-ui-v412.js`, `select-sync-v407.js`, `address-fix-v400.js`, `backup-import-v400.js`, `ui-stability-v402.js`;
- report-only: `report/index.html`, `report/style.css`, `report/app.js`, `report/location-data-v452.js`, `report/location-details-v452.js`, `report/traffic-competitors-v453.js`, `report/launch-gate-v454.js`, `report/opening-project-v455.js`, `report/fix-v400.js`, `report/status-next-task-v447.js`;
- reset-only: `reset/index.html`, `reset/reset.css`, `reset/reset.js`;
- shell assets: `manifest.webmanifest`, `icon.svg`.

Classification: active cache/runtime support. No deletion is safe solely by age or version suffix.

## Tests and workflows referenced in this PR scope

- `tests/first-paint-style-stability-v466.spec.mjs` — focused comparison startup regression, first-paint shell stability, badge stability.
- `tests/card-progress-v448.spec.mjs` — recommendation/status badge owner stability.
- `tests/location-card-collapse-v422.spec.mjs` — interaction/collapse behavior.
- `tests/location-card-collapse-mobile-v422.spec.mjs` — mobile collapse behavior when selected by feature workflow.
- `tests/ui-refine-v462.spec.mjs` and other feature-selected tests are retained by workflow mapping.
- `tests/version-authority.spec.js` — visible version authority and cache-busting token.
- `.github/workflows/bogatka-feature-tests.yml` — changed-domain feature gate.

## Cleanup classification

### Active runtime

Files loaded directly by `index.html`, dynamically by `v23.js`, or cached by `sw-v340.js`.

### Compatibility / migration

Files explicitly listed as compatibility in `ACTIVE_WORKING_SET.md` or cached by Service Worker to preserve data/wrapper order. Not deleted in this PR.

### Report-only

Files under `report/` and report modules. Not deleted in this PR because reports/PDF/per-location export are out of scope.

### Reset-only

Files under `reset/`. Not deleted in this PR because auth/reset is out of scope.

### Test-only

Files under `tests/`. Not deleted in this PR.

### Definitely orphaned

None proven.

## Deletion decision

No runtime cleanup deletion is safe in this PR.

Reason: every inspected candidate is referenced by at least one of `index.html`, `v23.js`, `sw-v340.js`, tests/workflows, report/reset paths, or compatibility/migration inventory in `ACTIVE_WORKING_SET.md`.
