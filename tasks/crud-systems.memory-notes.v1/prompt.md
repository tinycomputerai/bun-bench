# In-memory Notes CRUD API

Implement a Bun HTTP API for in-memory notes.

## Requirements

- Listen on the port provided by `PORT`.
- `POST /notes` accepts JSON with a non-empty string `text`.
- A valid create returns HTTP 201:

```json
{ "id": "note_1", "text": "hello" }
```

- `GET /notes` returns:

```json
{ "notes": [{ "id": "note_1", "text": "hello" }] }
```

- Notes must remain in insertion order.
- Missing or blank text returns HTTP 422 with `{ "error": "invalid_text" }`.
