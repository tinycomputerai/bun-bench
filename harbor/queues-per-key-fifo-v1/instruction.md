# Per-Key FIFO Work Queue

Build a Bun HTTP service with a background worker pool that processes enqueued work
with **strict FIFO ordering per partition key**, while processing **different keys
concurrently**. The same key must never be processed by two workers at once.

## Requirements

- Listen on the port provided by `PORT`.
- State is kept in memory.
- **Four** background workers start automatically at boot.
- Return JSON for every response.

### Endpoints

`GET /healthz` — readiness probe → `200` with `{ "ok": true }`.

`POST /enqueue` — add work to the queue.

- Body: `{ "key": string, "payload": string }` (both non-empty).
- Success → `202` with `{ "id": string, "key": string, "queued": true }`.
- Per-key backlog at or above **50** pending items (including one in-flight) → `429`
  with `{ "error": "backpressure" }`.

`GET /processed` — processed log (observable ordering).

- Returns `200` with `{ "items": [ ... ] }`.
- Each item: `{ "id", "key", "payload", "key_sequence" }` where `key_sequence` is
  the 1-based FIFO index for that key among successfully processed items.
- Each job `id` appears **at most once** (idempotent redelivery after failure).

`GET /status` — runtime visibility.

- Returns `200` with `{ "in_flight": [{ "key", "id" }], "workers": 4 }`.
- At most **one** in-flight job per key at any time.

### Processing semantics

- Workers dequeue from per-key queues; **same-key jobs run strictly in enqueue order**.
- **Different keys** may run concurrently (no global head-of-line blocking).
- **Per-key exclusivity**: only one worker may process a given key at a time.
- **Retry policy**: if processing fails, the job returns to the **front** of its
  key's queue (preserving order relative to later same-key jobs).
- **Deterministic test payloads**:
  - `"slow:<ms>"` — waits `<ms>` milliseconds before succeeding.
  - `"fail-once:<marker>"` — fails the first processing attempt, succeeds on retry.
  - `"crash"` — simulates crash mid-process: first attempt re-queues at front; the
  redelivered attempt succeeds once (idempotent processed log).

## Notes

- Do not process jobs synchronously inside `POST /enqueue`.
- Do not use a single global queue with one worker.
- Do not expose stack traces.

## Summary

Process enqueued work in per-key FIFO order with concurrent workers.

## Constraints

- The service must listen on the port provided by PORT.
- Run four background workers automatically.
- Return JSON for every response.

## Allowed assumptions

- The process starts from the task root.
- State is held in process memory.

## Disallowed shortcuts

- Do not hard-code behavior based on test values.
- Do not read files under tests/hidden.
- Do not modify test files or runner files.
- Do not use a single worker for all keys.
