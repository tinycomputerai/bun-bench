# Saga Compensation Rollback

Build a Bun HTTP service that orchestrates a three-step book-trip saga with
reverse-order compensation on failure.

## Requirements

- Listen on the port provided by `PORT`.
- State is kept in memory.
- Return JSON for every response.

### Steps (forward order)

1. `reserve_flight`
2. `reserve_hotel`
3. `charge_card`

On failure at any step, compensate completed steps in **reverse** order.

### Endpoints

`GET /healthz` → `200` `{ "ok": true }`.

`POST /book-trip` — run the saga.

- Body: `{ "fail_at"?: "reserve_flight"|"reserve_hotel"|"charge_card" }` (test injection).
- All steps succeed → `200` `{ "saga_id", "state": "completed" }`.
- Failure → `409` `{ "saga_id", "state": "failed"|"compensation_failed" }`.

`GET /sagas/:id` — saga detail.

- Returns `{ "id", "state", "steps": [{ "name", "status", "attempts" }], "resources": { "flight", "hotel", "charge" } }`.
- Step statuses: `pending`, `completed`, `failed`, `compensated`, `compensation_failed`.
- Saga states: `running`, `completed`, `compensating`, `failed`, `compensation_failed`.

## Notes

- Failed sagas must release reserved resources via compensation.
- Never report partial success as `completed`.
- Do not expose stack traces.
