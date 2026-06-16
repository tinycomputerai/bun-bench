# W3C Trace Context Propagation

Build a Bun HTTP service that accepts inbound W3C `traceparent` headers, makes
nested async downstream calls, and records a correct parent/child span tree with
consistent sampling.

## Requirements

- Listen on the port provided by `PORT`.
- State is kept in memory.
- Return JSON for every response.

### Endpoints

`GET /healthz` → `200` `{ "ok": true }`.

`POST /ingress` — start or continue a trace.

- Optional header `traceparent` (`00-<32 hex trace>-<16 hex parent>-<flags>`).
- Optional header `tracestate` (preserve vendor list; truncate oldest entries if over **512** chars).
- Malformed `traceparent` → generate a fresh trace (do not crash).
- Executes nested async calls: `downstream-a` → `downstream-a-nested`, then `downstream-b`.
- Returns `200` `{ "trace_id", "root_span_id", "sampled", "tracestate" }`.

`GET /trace/:trace_id` — fetch recorded spans.

- Returns `{ "trace_id", "spans": [{ "span_id", "trace_id", "parent_span_id", "name", "sampled" }] }`.
- Each child span's `parent_span_id` is its **immediate** parent (not always the root).

### Sampling

- When continuing an inbound trace, honor the inbound sampled flag for all spans.
- Do not re-sample downstream spans differently from the root decision.

## Notes

- Use async-local (or equivalent) context so concurrent requests do not cross-contaminate.
- Do not expose stack traces.

## Summary

Propagate W3C trace context across nested async calls with a correct span tree.

## Constraints

- The service must listen on the port provided by PORT.
- Return JSON for every HTTP response.

## Allowed assumptions

- The process starts from the task root.
- State is held in process memory.

## Disallowed shortcuts

- Do not hard-code behavior based on test values.
- Do not read files under tests/hidden.
- Do not modify test files or runner files.
