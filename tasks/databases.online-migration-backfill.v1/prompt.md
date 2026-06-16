# Online Migration with Backfill

Build a Bun HTTP service that migrates records from a legacy numeric field to a
normalized field using phased dual-write, resumable backfill, cutover, and rollback.

## Requirements

- Listen on the port provided by `PORT`.
- State is kept in memory.
- **Normalization rule**: `normalized_value = legacy_value * 2`.
- Return JSON for every response.

### Phases (`GET /migration/status`)

- `legacy_only` — only `legacy_value` is used.
- `dual_write` — writes update both fields; reads prefer `normalized_value` when set.
- `backfilling` — dual-write continues; backfill catches up historical rows.
- `cutover` — reads/writes use `normalized_value` as authoritative `value`.
- `rolled_back` — migration aborted; reads use `legacy_value` again.

### Endpoints

`GET /healthz` — readiness → `{ "ok": true }`.

`POST /records` — create `{ "legacy_value": integer }` → `201` record.

`GET /records/:id` / `PATCH /records/:id` — read/update; response includes
`{ "id", "value", "legacy_value", "normalized_value", "write_version" }` where
`value` reflects the correct field for the current phase.

`POST /migration/start` — begin migration from `legacy_only` or `rolled_back` →
`dual_write` and dual-write all existing rows.

`POST /migration/backfill?batch=N` — process up to `N` rows (default 10).

- Idempotent/resumable: rows already backfilled at the current `write_version` are skipped.
- If a row's `write_version` changes during backfill (concurrent write), that row is
  **skipped** (not clobbered) and retried on a later batch.
- Returns `{ "processed", "skipped", "backfill_complete": boolean }`.

`POST /migration/cutover` — move to `cutover` only when `backfill_complete` is true.

`POST /migration/rollback` — abort to `rolled_back`, clearing normalized fields.

`GET /migration/status` — `{ "phase", "backfill_complete", "record_count" }`.

## Notes

- Do not cut over before backfill completes.
- Do not let backfill overwrite newer concurrent writes.
- Do not expose stack traces.
