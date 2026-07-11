# Bogatka dependency inventory summary

This tracked file is intentionally compact. The complete per-file JSON inventory is generated in CI and uploaded as the `bogatka-dependency-inventory` GitHub Actions artifact.

Files inventoried: **222**.

Observed main-runtime JavaScript requests: **101**.
Observed main-runtime CSS requests: **33**.
Service Worker asset entries: **151**.

## Classification totals

- `ACTIVE_CANONICAL`: 95
- `ACTIVE_BASE`: 21
- `COMPATIBILITY_REQUIRED`: 23
- `MERGE_INTO_CANONICAL`: 0
- `TEST_ONLY`: 70
- `REPORT_ONLY`: 10
- `RESET_ONLY`: 3
- `ORPHAN_CONFIRMED`: 0
- `ACCIDENTAL`: 0
- `UNKNOWN_BLOCKED`: 0

## Working-context entry point

- Read `ACTIVE_WORKING_SET.md` first and open only the relevant functional block.
- Keep `runtime-request-evidence.json` as the checked-in runtime request evidence source.
- Use the CI JSON artifact only for a full dependency audit.

## Safety rules

- `UNKNOWN_BLOCKED` is never eligible for deletion.
- A confirmed orphan has no loader, dynamic reference, Service Worker entry, observed request, report/reset consumer, behavioral test dependency, saved-data responsibility, or unique compatibility responsibility.
- Filename age or a version-like name is not deletion evidence.