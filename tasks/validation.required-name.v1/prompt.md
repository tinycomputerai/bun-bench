# Required User Name Validation

Implement a Bun HTTP service that creates a user only when a valid name is provided.

## Requirements

- Listen on the port provided by `PORT`.
- `POST /users` accepts JSON with a non-empty string `name`.
- A valid request returns HTTP 201 with:

```json
{ "id": "user_1", "name": "Ada" }
```

- Missing, null, non-string, or blank `name` values return HTTP 422 with:

```json
{ "error": "invalid_name" }
```

- Unsupported paths or methods must return HTTP 404 with a JSON body.
