# bun-server-bench

**Can a coding agent build a correct backend service — not just code that looks right, but code that holds up under the edge cases production throws at it?**

`bun-server-bench` is a benchmark and trajectory dataset that answers that question for one narrow, high-signal domain: real Bun server engineering. HTTP semantics, authentication, SQLite transactions, idempotency, concurrency, rate limiting, queues, observability, WebSockets, uploads. Fifty versioned tasks, each one engineered so that a plausible-but-wrong implementation passes the visible tests and fails the hidden ones.

It is not a framework. It is not a throughput benchmark. A fast server that returns the wrong status code scores zero.

## The 30-second proof

Take `idempotency.payment-capture.v1`. The agent must build a payment endpoint that never double-charges on retries. The public tests check the obvious path: same key + same body replays the original response; same key + different body conflicts.

A reasonable implementation passes all of that. Then the hidden suite fires five identical requests at the same key **simultaneously**:

```ts
const responses = await Promise.all(
  Array.from({ length: 5 }, () =>
    capture(key, { amount: 777, currency: "USD" })
  )
);
const uniqueIds = new Set(
  (await Promise.all(responses.map((r) => r.json()))).map((b) => b.id)
);
expect(uniqueIds.size).toBe(1); // exactly one payment, not five
```

Any solution that checks the key map and then creates the payment across an `await` boundary creates five payments and fails. Passing requires a per-key single-flight lock. That gap — between code that looks correct and code that _is_ correct — is what every task in this benchmark is built to measure.

> Why this measures something real → **[docs/thesis.md](docs/thesis.md)**
> How the traps are engineered → **[docs/task-anatomy.md](docs/task-anatomy.md)**

## Why it exists

Frontier models now saturate general coding suites. Near-perfect scores stop telling you where agents still fail. `bun-server-bench` narrows the domain to production-shaped Bun services — where small contract mistakes (validation order, a missing transaction, an off-by-one cursor) are the whole game — and engineers discrimination into every task so the score keeps carrying signal.

It was built during TinyComputer's research into whether small specialized models can match frontier behavior on a narrow engineering domain. The benchmark stands on its own: the tasks, scoring, integrity guarantees, Harbor packages, and trajectory exports are useful to anyone evaluating or training coding agents.

## At a glance

|                                       |         |
| ------------------------------------- | ------: |
| Authored tasks                        |      50 |
| Exported Harbor packages              |      50 |
| Public / hidden test suites           | 50 / 50 |
| Reference solutions                   |      50 |
| Runtime dependencies allowed per task |       0 |

Difficulty (1 easiest → 5 hardest): **1**→7 · **2**→3 · **3**→2 · **4**→20 · **5**→18.
Splits: `train` 4 · `dev` 44 · `public_eval` 0 · `private_eval` 2. See **[docs/splits-and-leakage.md](docs/splits-and-leakage.md)**.

## Where to go next

| If you are…                              | Read                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| Deciding whether this is worth your time | [docs/thesis.md](docs/thesis.md) → [docs/results.md](docs/results.md)        |
| Evaluating an agent                      | [docs/guides/evaluate-your-agent.md](docs/guides/evaluate-your-agent.md)     |
| Training a model on the trajectories     | [docs/guides/train-on-trajectories.md](docs/guides/train-on-trajectories.md) |
| Contributing a task                      | [docs/guides/contribute-a-task.md](docs/guides/contribute-a-task.md)         |
| Wondering whether agents can cheat it    | [docs/integrity.md](docs/integrity.md)                                       |
| Looking for the normative spec           | [docs/reference/](docs/reference/)                                           |

Full documentation map: **[docs/README.md](docs/README.md)**.

## Install and run one task

```sh
bun install
bun run validate          # all 50 tasks structurally valid
```

Run a task's reference solution end-to-end (start the service, run public + hidden tests, score it):

```sh
bun run run:reference tasks/http-apis.todo-health.v1
```

Run an agent against a task:

```sh
bun run run:agent --task tasks/authentication.jwt-verify.v1 --agent claude-code
```

Run a published package through Harbor, the canonical execution engine:

```sh
harbor run -p harbor/databases-optimistic-version-v1 --agent oracle -e docker -y
```

Each run writes artifacts (prompt, patch, logs, score) under `runs/<timestamp>-<task-id>/`. The full quickstart — suites, concurrency, resume, exports — is in **[docs/quickstart.md](docs/quickstart.md)**.

## How scoring works

Scoring is a gate. There is no partial credit for almost-correct.

| Outcome                                             | Score |
| --------------------------------------------------- | ----: |
| Public **and** hidden tests pass                    |   100 |
| Public pass, hidden fail                            |    25 |
| Public fail, or install / startup / timeout failure |     0 |

Harbor packages emit the same contract via `reward.txt` (`1.0` / `0.25` / `0.0`). Details, including the forward-looking weighted-scoring schema that the runner does not yet enforce, are in **[docs/reference/scoring.md](docs/reference/scoring.md)**.

## Why Bun

Bun compresses a modern server stack into a small surface area: `Bun.serve` gives HTTP and WebSocket primitives without framework ceremony, `bun:sqlite` enables real persistence and transactions with no external service, and native TypeScript keeps the task loop tight. The runtime is young enough that memorization pressure is low, and the domain is narrow enough to train a specialist yet rich enough to demand real engineering judgment. Every task ships with **zero runtime dependencies** and **network disabled** — the agent must implement the capability, not import it. See **[docs/integrity.md](docs/integrity.md)**.

## License

Tasks declare `Apache-2.0`. Preserve license metadata when redistributing tasks, Harbor packages, or dataset exports.
