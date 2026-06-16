# Write-Skew Safe On-Call Roster

Build a Bun HTTP service managing an on-call roster with the invariant that **at
least one engineer must remain on-call**. Concurrent go-off-call requests must not
both succeed when only two engineers are on-call.

## Requirements

- Listen on the port provided by `PORT`.
- Engineers `eng-1` and `eng-2` start on-call.
- Return JSON for every response.

### Endpoints

`GET /healthz` → `200` `{ "ok": true }`.

`GET /oncall` → `200` `{ "on_call": string[] }`.

`POST /oncall/:id/off` — mark engineer off-call.

- Unknown id → `404`.
- Already off → `409` `{ "error": "already_off" }`.
- Would violate invariant (≤1 on-call) → `409` `{ "error": "invariant_violation" }`.
- Success → `200` `{ "id", "on_call": false }`.

`POST /oncall/:id/on` — mark engineer on-call → `200` `{ "id", "on_call": true }`.

## Notes

- Use row-level locking or equivalent so two concurrent off requests cannot both pass
  the invariant check.
- Do not expose stack traces.
