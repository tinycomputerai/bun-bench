# HTTP Conditional Cache Semantics

Build a Bun HTTP service that implements origin caching validators and a simple
`Vary`-aware intermediary cache with correct conditional request handling.

## Requirements

- Listen on the port provided by `PORT`.
- State is kept in memory.
- Return appropriate HTTP status codes and headers.

### Endpoints

`GET /healthz` — readiness probe → `200` with `{ "ok": true }`.

`GET /resource` — origin resource (varies by `Accept-Encoding`).

- Without conditionals → `200` with body and headers:
  - `ETag` (strong quoted entity tag)
  - `Last-Modified` (HTTP-date)
  - `Cache-Control: public, max-age=60`
  - `Vary: Accept-Encoding`
- If `Accept-Encoding` includes `gzip` → body is prefixed with `gzip:` (gzip variant).
- Otherwise → plain identity body.
- `If-None-Match` matching the selected variant's ETag (weak comparison allowed) →
  `304` with **no body**, echoing `ETag`, `Last-Modified`, `Cache-Control`, `Vary`.
- If `If-None-Match` is absent and `If-Modified-Since` is at/after the resource time →
  `304` as above.
- When **both** `If-None-Match` and `If-Modified-Since` are present, **ETag wins**.

`PUT /resource` — update the resource (strong precondition).

- Requires `If-Match` with a **strong** ETag match against the current **identity**
  representation.
- Match → `200` with updated body/validators; mismatch/missing → `412`
  `{ "error": "precondition_failed" }`.
- Clears intermediary cache on update.

`GET /cached/resource` — intermediary cache in front of the origin.

- Cache keys include `Accept-Encoding` (`Vary` awareness).
- Fresh cached entry → `200` with `X-Cache: HIT`.
- Conditional `If-None-Match` against cached ETag → `304` without body.
- Must not serve a gzip variant to a client that requested identity, and vice versa.

## Notes

- Never send a response body with `304`.
- Do not expose stack traces.
