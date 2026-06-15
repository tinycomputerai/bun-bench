# Request Id Propagation Middleware

Implement a Bun HTTP service that propagates request ids.

## Requirements

- Listen on the port provided by `PORT`.
- `GET /request-id` requires an `X-Request-Id` request header.
- When present, return HTTP 200 with:

```json
{ "requestId": "the-header-value" }
```

- The response must also include the same `X-Request-Id` header value.
- Missing `X-Request-Id` returns HTTP 400 with:

```json
{ "error": "bad_request" }
```

- Unsupported paths or methods must return HTTP 404 with JSON.
