# Resumable Chunked Uploads

Build a Bun HTTP service for resumable chunked file uploads with out-of-order
chunk delivery, range tracking, idempotent retries, and SHA-256 finalization.

## Requirements

- Listen on the port provided by `PORT`.
- State is kept in memory.
- Return JSON for every response except chunk bodies (raw bytes on upload).

### Endpoints

`GET /healthz` → `200` `{ "ok": true }`.

`POST /uploads` — start an upload.

- Body: `{ "total_size": positive integer, "chunk_size"?: integer }` (default chunk_size 1024).
- Success → `201` `{ "upload_id", "chunk_size", "total_size" }`.

`PUT /uploads/:id/chunks?offset=<non-negative integer>` — upload raw bytes.

- Empty body → `400`. Offset out of range or chunk overflow → `400`.
- Success → `200` `{ "ok": true, "offset", "size" }`.
- Duplicate offset overwrites idempotently.

`GET /uploads/:id` — status.

- Returns `{ "upload_id", "total_size", "chunk_size", "complete", "received": [{start,end}] }`.

`POST /uploads/:id/complete` — finalize.

- Body: `{ "sha256": hex string }`.
- Missing ranges → `409` `{ "error": "incomplete", "missing" }`.
- Checksum mismatch → `422` `{ "error": "checksum_mismatch" }`.
- Success → `200` `{ "upload_id", "complete": true, "sha256" }`.

## Notes

- Chunks may arrive out of order.
- Do not expose stack traces.
