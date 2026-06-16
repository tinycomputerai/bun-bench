# Signed URL Replay Protection

Build a Bun HTTP service that issues HMAC-signed URLs binding method, path, and
query parameters with expiry, bounded clock skew, and single-use nonces.

## Requirements

- Listen on the port provided by `PORT`.
- Signing secret: `signed-url-secret` (fixed for this task).
- Clock skew tolerance: **30** seconds.
- Return JSON for every response.

### Endpoints

`GET /healthz` → `200` `{ "ok": true }`.

`POST /sign` — create a signed URL.

- Body: `{ "method": string, "path": string, "query"?: object, "ttl"?: seconds }` (default ttl 300).
- Canonicalize query keys sorted; exclude `sig`, `exp`, `nonce` from the signed query string.
- Returns `200` `{ "url": "<path>?...&exp=&nonce=&sig=", "exp", "nonce" }`.

Any request whose URL includes `sig`, `exp`, and `nonce` query params is verified:

- Valid first use → `200` `{ "ok": true, "path" }`.
- Expired, tampered, missing, or replayed nonce → `403` `{ "error": "forbidden" }`.
- Use constant-time signature comparison.

## Notes

- Nonces are single-use even within the validity window.
- Do not expose stack traces.

## Summary

Issue and verify HMAC signed URLs with expiry, skew tolerance, and single-use nonces.

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
