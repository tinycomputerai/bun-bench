# Client Fixed Window Rate Limit

Implement a Bun HTTP service with a simple per-client rate limit.

## Requirements

- Listen on the port provided by `PORT`.
- `GET /limited` requires an `X-Client-Id` header.
- Each client id may make two successful requests.
- Successful requests return HTTP 200 with:

```json
{ "ok": true, "remaining": 1 }
```

- The third request from the same client returns HTTP 429 with:

```json
{ "error": "rate_limited" }
```

- Missing `X-Client-Id` returns HTTP 400 with JSON.
