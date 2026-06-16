# Exactly-Once Cron Scheduler

Build a Bun HTTP service with a background scheduler that runs recurring jobs
**exactly once per scheduled time slot**, honoring catch-up vs skip policies and
skipping overlapping runs.

## Requirements

- Listen on the port provided by `PORT`.
- A background tick loop starts automatically.
- Return JSON for every response.

### Endpoints

`GET /healthz` → `200` `{ "ok": true }`.

`POST /jobs` — register a recurring job.

- Body: `{ "name": string, "interval_ms": positive integer, "missed_policy"?: "catch_up"|"skip" }`
  (default `skip`).
- Success → `201` `{ "name", "interval_ms", "missed_policy" }`.

`GET /runs?job=<name>` — list executions.

- Returns `{ "runs": [{ "job", "scheduled_time", "status", "started_at?", "completed_at?" }] }`.
- `status` is `running`, `completed`, or `skipped`.

`POST /admin/restart` — simulate process restart after crash.

- Clears in-flight running flags without erasing completed slot markers.
- Returns `{ "restarted": true }`.

### Scheduling semantics

- Slots are aligned to `floor(now / interval_ms) * interval_ms`.
- Each `(job, scheduled_time)` runs at most once.
- **catch_up**: execute every missed slot since the last completed slot.
- **skip**: execute only the latest current slot if not yet completed.
- If a run is still in progress when the next slot arrives → record `skipped` (no concurrent duplicate).

## Notes

- Do not use a naive sleep loop that accumulates drift.
- Do not expose stack traces.
