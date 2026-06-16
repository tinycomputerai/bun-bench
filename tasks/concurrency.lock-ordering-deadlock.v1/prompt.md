# Deadlock-Free Account Transfers

Build a Bun HTTP service that transfers funds between in-memory accounts using
**consistent global lock ordering** so concurrent opposite-direction transfers
never deadlock, while disjoint transfers still run concurrently.

## Requirements

- Listen on the port provided by `PORT`.
- Accounts `a`, `b`, `c`, `d` start with balance **1000** each.
- Return JSON for every response.

### Endpoints

`GET /healthz` → `200` `{ "ok": true }`.

`GET /accounts/:id` → `200` `{ "id", "balance" }` or `404`.

`POST /transfer` — move funds atomically.

- Body: `{ "from": string, "to": string, "amount": positive integer }`.
- Same account → `422` `{ "error": "same_account" }`.
- Unknown account → `404`.
- Insufficient funds → `409` `{ "error": "insufficient_funds" }`.
- Success → `200` `{ "ok": true, "from", "to" }` with updated balances.

## Notes

- Acquire locks in a consistent order (e.g. sorted account ids).
- Self-transfer must not double-lock the same account.
- Do not expose stack traces.
