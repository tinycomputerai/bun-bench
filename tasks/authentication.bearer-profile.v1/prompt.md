# Bearer Token Profile Endpoint

Implement a Bun HTTP service with one authenticated profile endpoint.

## Requirements

- Listen on the port provided by `PORT`.
- `GET /profile` must require this exact header:

```text
Authorization: Bearer benchmark-token
```

- A valid token returns HTTP 200 with:

```json
{ "id": "user_1", "email": "user@example.com" }
```

- Missing or invalid tokens return HTTP 401 with:

```json
{ "error": "unauthorized" }
```

- All responses must be JSON.
