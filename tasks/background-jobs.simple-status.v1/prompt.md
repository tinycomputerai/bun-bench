# Simple Background Job Status

Implement a Bun HTTP API for simple in-memory jobs.

## Requirements

- Listen on the port provided by `PORT`.
- `POST /jobs` creates a job and may complete it immediately.
- The first created job must have id `job_1`, then `job_2`, and so on.
- A created job returns HTTP 202:

```json
{ "id": "job_1", "status": "completed" }
```

- `GET /jobs/:id` returns the same job object for existing ids.
- Unknown job ids return HTTP 404 with `{ "error": "not_found" }`.
