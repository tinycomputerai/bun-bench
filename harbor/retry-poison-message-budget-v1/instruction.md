# Poison Message Retry Budget

Build a Bun HTTP service that processes jobs with failure classification, bounded
retry with backoff, dead-lettering, and idempotent side effects.

## Requirements

- Listen on the port provided by `PORT`.
- State is kept in memory.
- Return JSON for every response.

### Payload conventions

| Payload | Behavior |
|---------|----------|
| `ok` | Succeed immediately |
| `transient:N` | Fail transiently for first N attempts, then succeed |
| `permanent` | Permanent failure — no retry |
| `poison` | Always transient until retry budget exhausted |

Maximum **4** attempts (1 initial + 3 retries) before dead-letter.

### Endpoints

`GET /healthz` → `200` `{ "ok": true }`.

`POST /process` — enqueue/process a job.

- Body: `{ "id": string, "payload": string }`.
- Returns `200` when completed, `202` when still queued/processing.
- Body includes `{ "id", "state", "attempts", "side_effects" }`.
- `side_effects` increments **at most once** per id even under retry.

`GET /status/:id` — job status.

- Returns `{ "id", "state", "attempts", "last_error", "side_effects" }`.
- `state`: `queued`, `processing`, `completed`, or `dead_letter`.

## Notes

- Permanent failures go directly to dead-letter.
- Concurrent requests for the same id must not double-execute.
- Do not expose stack traces.

## Summary

Classify failures, retry transient errors with bounded backoff, and dead-letter poison messages.

## Constraints

- The service must listen on the port provided by PORT.
- Return JSON for every HTTP response.

## Allowed assumptions

- The process starts from the task root.
- State is held in process memory.

## Disallowed shortcuts

- Do not hard-code behavior based on test values.
- Do not read files under tests/hidden.
- Do not modify test files or runner files.
