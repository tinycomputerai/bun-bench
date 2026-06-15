# Safe JSON Error Responses

Implement a Bun HTTP service with stable JSON errors.

## Requirements

- Listen on the port provided by `PORT`.
- `GET /health` returns HTTP 200 with:

```json
{ "ok": true }
```

- `GET /boom` returns HTTP 500 with:

```json
{ "error": "internal_error" }
```

- Unsupported routes return HTTP 404 with:

```json
{ "error": "not_found" }
```

- Do not expose stack traces in response bodies.
