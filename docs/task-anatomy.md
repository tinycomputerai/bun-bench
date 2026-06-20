# Anatomy of a task

Every task in `bun-server-bench` is built to the same shape and around the same idea: catch the gap between code that looks correct and code that is correct. This page shows what's inside a task, the contract every task satisfies, and a catalogue of the actual traps.

## What an agent sees, and what scores it

A task directory is the authored source of truth:

```text
tasks/<task-id>/
  task.yaml            metadata: category, difficulty, split, scoring, timeouts
  prompt.md            the agent-visible instruction
  src/                 starter implementation (intentionally incomplete)
  tests/public/        visible orientation tests
  tests/hidden/        hidden scoring tests        ← never shown to the agent
  tests/helpers/       shared test harness
  solutions/reference/ maintainer solution         ← never shown to the agent
```

The agent receives the prompt, `src/`, the package files, `tests/public/`, and the helpers those tests import. It does **not** receive `tests/hidden/`, `solutions/reference/`, or the `known_failure_modes` recorded in `task.yaml`. The mechanics of how that separation is enforced at runtime — locally and in Harbor — are in **[integrity.md](integrity.md)**.

## The three invariants

A task is accepted into the benchmark only if all three hold. Together they guarantee the score discriminates:

1. **The starter fails the public tests.** There is real work to do.
2. **The reference solution passes every public and hidden test.** The task is achievable and the spec is exact.
3. **A plausible shortcut passes the public tests and fails the hidden ones.** Without this, the task carries no signal.

The acceptance gate is mechanical and re-runnable:

```sh
bun run validate:task <task-id>                                          # structure valid
BUN_SERVER_BENCH_APP_DIR=solutions/reference bun test tests/public tests/hidden   # reference: all green
bun test tests/public                                                    # starter: fails
```

## What makes a task hard

Difficulty 1–2 tasks test a clean contract (validate a field, serve a health check). Difficulty 4–5 — the bulk of the suite — concentrate on the four places confident implementations go wrong:

- **Concurrency.** A check and a mutation separated by an `await` is a race. Idempotency keys, ledgers, ETags, and queues all hinge on serializing per-key work.
- **State machines.** Circuit breakers, retry/dead-letter queues, refresh-token families, and migrations have terminal and intermediate states that a stale timer or a re-run must not corrupt.
- **Protocol exactness.** The difference between `409` and `412`, `400` before `422`, `invalid_alg` versus `malformed` — contracts that a happy-path solution rounds off.
- **Security boundaries.** Algorithm pinning, scope challenges, path-traversal sanitization, label-cardinality bounds — properties that are invisible until an adversarial input arrives.

## The trap catalogue

Each task was accepted only with an explicit answer to three questions: how might a _strong_ model fail it, how might a _small_ model fail it, and which single capability does it isolate? The strong-model trap is the subtle contract or concurrency detail; the small-model trap is the structural capability gap.

### Pagination

- **`pagination.keyset-feed.v1`** — _Strong trap:_ the `next_cursor` terminator — the contract requires a non-null cursor whenever a page fills to `limit`, even when it exhausts the feed; a "null when no more items" shortcut breaks the exact-boundary case. _Small trap:_ reaches for offset/limit, which skips items when new high-id events arrive, and leaks raw ids instead of opaque cursors. _Capability:_ keyset pagination stable under concurrent inserts.
- **`pagination.bidirectional-cursor.v1`** — _Strong trap:_ `before` semantics — the slice must be taken from the high end of items below the cursor but returned ascending; naive `filter(id<before).slice(0,limit)` returns the wrong rows. _Small trap:_ computes `has_next`/`has_prev` from page fullness instead of peeking one row beyond each edge. _Capability:_ bidirectional cursors with correct page-info.

### Idempotency

- **`idempotency.payment-capture.v1`** — _Strong trap:_ the concurrency race — checking the key map then creating across an `await` lets a burst create multiple payments; requires a per-key in-flight single-flight promise. _Small trap:_ conflates replay with key-reuse, or omits the replay header. _Capability:_ idempotency keys with fingerprinting + concurrency-safe single execution.
- **`idempotency.dedup-conflict.v1`** — _Strong trap:_ check ordering — if business uniqueness is checked before the idempotency key, a legitimate replay wrongly returns `duplicate_reference` instead of replaying. _Small trap:_ collapses both conflicts into one generic 409. _Capability:_ idempotent create vs business-level dedup with correct precedence.

### Databases & persistence

- **`databases.sqlite-ledger.v1`** — _Strong trap:_ balance-check/debit/credit as separate steps lets two concurrent transfers both read the pre-debit balance and overdraw; requires re-reading inside the same `db.transaction()`. _Small trap:_ in-memory balances (fails restart) or debit-then-credit without rollback. _Capability:_ transactional money movement preserving invariants + durability.
- **`databases.sqlite-migrations.v1`** — _Strong trap:_ `ALTER TABLE ADD COLUMN` is non-idempotent — re-running on the second boot throws "duplicate column" and the process never reaches readiness; requires gating each migration on a recorded `schema_migrations` row. _Small trap:_ no migration-tracking table; re-runs every boot or hard-codes the version. _Capability:_ idempotent ordered migrations with a durable version table.
- **`databases.optimistic-version.v1`** _(gold exemplar)_ — _Strong trap:_ read-modify-write without a transaction lets two writers both bump the version (lost update); confusing 409/412/428; treating a missing If-Match as unconditional. _Small trap:_ in-memory storage; blind overwrite; mishandled If-Match parsing. _Capability:_ version + If-Match optimistic concurrency with durable, transactional compare-and-set.
- **`crud-systems.etag-concurrency.v1`** — _Strong trap:_ an `await` between the ETag check and the mutation lets both writers commit; returning 409 instead of RFC 7232's 412; forgetting the `*` wildcard. _Small trap:_ substitutes a version counter or timestamp for a real content hash. _Capability:_ content-addressed strong-ETag conditional updates.

### Authentication & authorization

- **`authentication.jwt-verify.v1`** — _Strong trap:_ alg-confusion — accepting `alg:"none"` or any HMAC family because the digest is computed from `header.alg`; requires pinning to exactly `HS256` _before_ any signature handling. _Small trap:_ cannot manually base64url-decode and recompute HMAC-SHA256 over the raw `header.payload`. _Capability:_ manual JWT verification with algorithm pinning.
- **`authentication.jwt-refresh-rotation.v1`** — _Strong trap:_ reuse detection requires _remembering consumed tokens_ — a model that simply deletes the old refresh treats a replay as merely "unknown" and never revokes the family. _Small trap:_ a flat valid-token set that can't express family revocation. _Capability:_ refresh-token rotation with reuse detection + family revocation.
- **`authorization.rbac-roles.v1`** — _Strong trap:_ collapsing two orthogonal axes — role permission and resource ownership; forgetting the per-document owner check, or adding ownership but forgetting the admin override. _Small trap:_ cannot keep the 401-vs-403 distinction exact or order authn → role → ownership. _Capability:_ RBAC with ownership + admin override.
- **`authorization.scoped-tokens.v1`** — _Strong trap:_ the `WWW-Authenticate` challenge — omitting it, using a generic `realm`, or naming the wrong scope per endpoint (RFC 6750). _Small trap:_ authorizes on blanket token validity rather than the specific scope. _Capability:_ scope-based authz with the `insufficient_scope` challenge.

### Rate limiting

- **`rate-limiting.sliding-window.v1`** — _Strong trap:_ a fixed/calendar window (`Math.floor(now/1000)` bucketing) passes "5 then 429" but wrongly admits a request mid-burst after 500ms; only a true rolling window that ages out individual timestamps survives. _Small trap:_ cannot track and age out a per-client timestamp list relative to a moving `now`. _Capability:_ sliding-window limiting with a correct rolling boundary.
- **`rate-limiting.token-bucket.v1`** — _Strong trap:_ omitting the `min(capacity, …)` cap (a long idle accrues a >5 burst), or refilling in discrete steps instead of continuously by elapsed time. _Small trap:_ models a per-window counter instead of an accruing bucket. _Capability:_ token-bucket limiting with continuous refill + capacity cap.

### Background jobs, websockets, uploads, observability, error handling

- **`background-jobs.retry-queue.v1`** — _Strong trap:_ a stale retry timer re-fires after a job has dead-lettered, or flips a terminal job back to running; processing inside the POST handler makes the create response already `succeeded`. _Small trap:_ incorrect per-job attempt accounting; processes synchronously or retries forever. _Capability:_ async queue with bounded retries, backoff, dead-lettering.
- **`websockets.presence-room.v1`** — _Strong trap:_ chat fan-out must exclude the sender and be room-scoped; the joining socket gets the roster while peers get a separate broadcast. _Small trap:_ leaks disconnected users; never wires up `close` cleanup. _Capability:_ stateful WS room presence with disconnect cleanup + isolation.
- **`websockets.seqnum-resume.v1`** — _Strong trap:_ one global sequence counter instead of per-channel, and replaying by array index rather than `seq > last_seq` (gaps/dupes on resume); replay must complete synchronously in `open`. _Small trap:_ live fan-out with no per-channel buffer. _Capability:_ message sequencing with gap/dupe-free resumable delivery.
- **`file-uploads.multipart-checksum.v1`** — _Strong trap:_ Bun appends `;charset=utf-8` to text part types, so a naive `ALLOWED.has(file.type)` 415s valid uploads — must compare the MIME essence; basename sanitization must split on both `/` and `\` and drop `.`/`..`. _Small trap:_ cannot compose `formData()` extraction + lowercase-hex sha256 + size/type ordering. _Capability:_ secure multipart upload (size/type/path-traversal + integrity).
- **`observability.request-metrics.v1`** — _Strong trap:_ high cardinality — keying the counter by the raw path (`/items/123`) instead of the route template; forgetting to exclude `GET /metrics` from counters and duration aggregates. _Small trap:_ cannot emit a strictly parseable Prometheus line. _Capability:_ metrics with bounded label cardinality + request-id propagation.
- **`error-handling.circuit-breaker.v1`** — _Strong trap:_ the counting model — a failed GET makes 3 dependency invocations but must count as one consecutive failure; per-attempt incrementing opens the breaker after ~2 GETs instead of 5. _Small trap:_ retries the non-idempotent POST, or invokes the dependency while open instead of failing fast. _Capability:_ method-aware retry semantics + circuit-breaker state machine.

## Categories and difficulty

The 50 tasks span backend domains including authentication, authorization, background jobs, caching, CRUD/ETags, databases and migrations, error handling, file uploads, HTTP APIs and pagination, idempotency, middleware, observability, rate limiting, security, validation, and WebSockets. Difficulty is concentrated where discrimination lives: **38 of 50 tasks are difficulty 4 or 5**.

Each `task.yaml` records the difficulty `level`, a `rationale`, the `expected_concepts`, and the `known_failure_modes` that the hidden tests target — the same three-question discipline applied above, captured as metadata. To author a task that meets this bar, see **[guides/contribute-a-task.md](guides/contribute-a-task.md)**; for the full schema, **[reference/task-spec.md](reference/task-spec.md)**.
