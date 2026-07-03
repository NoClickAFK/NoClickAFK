# Bogatka active working set

Use this map before opening source files. For a small task, start with one block and read only the listed 3–10 files. Expand beyond the block only when a direct loader, data-contract, report, sync, or Service Worker dependency proves that the boundary is crossed.

`Canonical runtime files` are the current implementation path. `Compatibility files` preserve existing saved data or wrapper order and must not be removed or bypassed without a separate migration audit. `Do not read by default` identifies irrelevant areas that increase context without helping the named task.

## Location header

**Canonical runtime files**
- `ui-v2.js`
- `location-card-collapse-v422.js`
- `location-card-collapse-v422.css`
- `status-next-task-v447.js`
- `status-next-task-v447.css`
- `card-progress-v448.js`
- `card-progress-v448.css`

**Compatibility files**
- `location-data-stability-v452.js`
- `ui-stability-v402.js`

**Relevant tests**
- `tests/location-card-collapse-v422.spec.mjs`
- `tests/location-card-collapse-mobile-v422.spec.mjs`
- `tests/status-next-task-v447.spec.mjs`
- `tests/ui-refine-v462.spec.mjs`

**Do not read by default**
- `report/`, `reset/`, sync internals, critical-deal internals, traffic/opening-project modules, and Service Worker manifests.

## Inspection and landlord

**Canonical runtime files**
- `inspection-layout-v461.js`
- `inspection-layout-v461.css`
- `location-profile-v416.js`
- `location-profile-v416.css`
- `location-panels-v419.js`
- `location-panels-v419.css`
- `landlord-conditions-v449.js`
- `location-data-v452.js`

**Compatibility files**
- `location-data-stability-v452.js`
- `field-integrity-v416.js`
- `object-type-normalize-v416.js`
- `object-type-reset-stability-v453.js`
- `durable-fields-v452.js`

**Relevant tests**
- `tests/inspection-layout-v461.spec.mjs`
- `tests/landlord-conditions-v449.spec.mjs`
- `tests/location-profile-v416.spec.mjs`
- `tests/location-data-v452.spec.mjs`

**Do not read by default**
- report generation, cloud synchronization, traffic/opening-project logic, auth/reset, and Service Worker files.

## Progress and recommendation

**Canonical runtime files**
- `card-progress-init-v448.js`
- `card-progress-v448.js`
- `card-progress-v448.css`
- `card-progress-report-v448.js`
- `decision-core-v340.js`
- `decision-ui-v340.js`
- `status-next-task-v447.js`

**Compatibility files**
- `durable-fields-v452.js`
- `release-integrity-v456.js`

**Relevant tests**
- `tests/card-progress-v448.spec.mjs`
- `tests/ui-refine-v462.spec.mjs`
- `tests/location-card-collapse-mobile-v422.spec.mjs`
- `tests/status-next-task-v447.spec.mjs`

**Do not read by default**
- auth/reset, public report renderer, sync transport, traffic/opening-project modules, and Service Worker files unless the task changes an asset reference.

## Critical deal

**Canonical runtime files**
- `critical-deal-schema-v430.js`
- `critical-deal-refine-v433.js`
- `critical-deal-v430.css`
- `decision-panel-v412.js`
- `decision-panel-v412.css`
- `decision-core-v340.js`
- `decision-ui-v340.js`

**Compatibility files**
- `critical-deal-persistence-v453.js`
- `report-live-fixes-v427.js`

**Relevant tests**
- `tests/critical-deal-bootstrap-v430.spec.mjs`
- `tests/critical-deal-v430.spec.mjs`
- `tests/validate-critical-deal-v430.mjs`
- `tests/landlord-conditions-v449.spec.mjs`

**Do not read by default**
- traffic/opening-project UI, inspection layout, sync internals, reset flow, and Service Worker manifests.

## Traffic and competitors

**Canonical runtime files**
- `traffic-competitors-v453.js`
- `traffic-competitors-v453.css`
- `location-evaluation-refine-v446.js`

**Compatibility files**
- `traffic-competitors-persistence-v453.js`
- `traffic-competitors-compat-v453.js`
- `durable-fields-v452.js`
- `release-integrity-v456.js`

**Relevant tests**
- `tests/traffic-competitors-v453.spec.mjs`
- `tests/traffic-competitors-v453-integration.spec.mjs`
- `tests/release-integrity-v456.spec.mjs`

**Do not read by default**
- critical-deal rendering, inspection/landlord layout, report styling, auth/reset, sync transport, and Service Worker files.

## Opening project

**Canonical runtime files**
- `launch-gate-v454.js`
- `launch-gate-v454.css`
- `opening-project-v455.js`
- `opening-project-v455.css`

**Compatibility files**
- `opening-project-persistence-v455.js`
- `durable-fields-v452.js`
- `release-integrity-v456.js`

**Relevant tests**
- `tests/launch-gate-v454.spec.mjs`
- `tests/launch-gate-v454-integration.spec.mjs`
- `tests/opening-project-v455.spec.mjs`
- `tests/opening-project-v455-integration.spec.mjs`
- `tests/release-integrity-v456.spec.mjs`

**Do not read by default**
- inspection/landlord presentation, report styling, sync transport, auth/reset, and Service Worker files. Read traffic or critical-deal modules only when the gate input itself changes.

## Reports

**Canonical runtime files**
- `report-live-v427.js`
- `report-polish-v428.js`
- `report-authority-v428.js`
- `report-v400.js`
- `card-progress-report-v448.js`
- `report/index.html`
- `report/app.js`

**Compatibility files**
- `report-live-fixes-v427.js`
- `report-stability-v429.js`
- `report/fix-v400.js`

**Relevant tests**
- `tests/browser-workflows.spec.mjs`
- `tests/report-live-v427.spec.js`
- `tests/report-polish-v428.spec.js`
- `tests/report-stability-v429.spec.js`
- `tests/validate-report-live-v427.mjs`
- `tests/validate-report-polish-v428.mjs`

**Do not read by default**
- auth/reset, sync transport, unrelated location UI CSS, and Service Worker internals. Read a domain module only when its data must be added to the report.

## Sync and persistence

**Canonical runtime files**
- `cloud.js`
- `sync-merge-v412.js`
- `sync-state-v412.js`
- `sync-runtime-v412.js`
- `sync-ui-v412.js`
- `select-sync-v407.js`
- `backup-v400.js`

**Compatibility files**
- `cloud-stability-v401.js`
- `sync-field-compat-v416.js`
- `field-integrity-v416.js`
- `backup-import-v400.js`
- `cloud-archive-v400.js`
- `address-fix-v400.js`

**Relevant tests**
- `tests/browser-sync-stability.spec.mjs`
- `tests/browser-select-sync.spec.mjs`
- `tests/sync-integrity-v412.spec.mjs`
- `tests/backup-v400.spec.mjs`

**Do not read by default**
- presentation-only CSS, report styling, progress/recommendation rendering, opening-project UI, and old Service Worker implementations.

## Service Worker

**Canonical runtime files**
- `sw.js`
- `sw-v340.js`
- `version-authority-v426.js`
- `access-version-v400.js`
- `manifest.webmanifest`

**Compatibility files**
- None. Do not reintroduce deleted historical Service Worker implementations.

**Relevant tests**
- `tests/service-worker-assets-v414.spec.mjs`
- `tests/version-authority.spec.js`
- `tests/browser-smoke.spec.mjs`

**Do not read by default**
- domain implementation files listed inside the cache manifest. Open only the specific asset whose path or load order is being changed. Do not inspect Supabase, production data, report/reset logic, or unrelated UI modules for a cache-only task.
