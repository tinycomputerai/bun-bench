# DST-Safe Recurrence Scheduling

Build a Bun HTTP service that expands **daily** recurring schedules in an IANA
timezone to UTC instants, correctly handling daylight saving transitions.

## Requirements

- Listen on the port provided by `PORT`.
- State is kept in memory.
- Use timezone-database semantics (not a fixed UTC offset).
- Return JSON for every response.

### Schedule model

`POST /schedules` body:

```json
{
  "id": "optional string",
  "tz": "America/New_York",
  "hour": 9,
  "minute": 30,
  "frequency": "daily"
}
```

Returns `201` with the stored schedule (defaults: skip nonexistent local times;
choose the **earlier** instant on ambiguous fall-back times).

### Endpoints

`GET /healthz` — readiness → `{ "ok": true }`.

`GET /schedules/:id/occurrences?from=<ISO>&to=<ISO>` — expand occurrences inclusive.

- Returns `{ "schedule_id", "occurrences": [ UTC ISO-8601 instants ... ] }`.
- Range boundaries are inclusive instants.
- **Gap rule (spring forward)**: if the local time does not exist on a calendar day,
  **skip** that day (no crash, no phantom instant).
- **Overlap rule (fall back)**: if the local time is ambiguous, emit **one** occurrence
  using the **earlier** UTC instant.
- Day iteration uses **local calendar dates** in `tz`, not UTC midnight stepping.

## Notes

- Do not hard-code offset tables for one timezone only.
- Do not expose stack traces.

## Summary

Expand daily recurrences in IANA zones with DST gap and overlap rules.

## Constraints

- The service must listen on the port provided by PORT.
- frequency daily only for v1.
- Return JSON for every response.

## Allowed assumptions

- The process starts from the task root.
- Intl time zone APIs are available for IANA zones.

## Disallowed shortcuts

- Do not hard-code behavior based on test values.
- Do not read files under tests/hidden.
- Do not modify test files or runner files.
- Do not use a fixed UTC offset for named zones.
