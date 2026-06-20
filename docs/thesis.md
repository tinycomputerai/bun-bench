# Why bun-server-bench measures something real

## The problem

Coding benchmarks are saturating. Frontier models score near-perfect on HumanEval, post strong numbers on SWE-bench, and clear LiveCodeBench's contest problems. Those are real achievements and useful signals. But once a suite is saturated, its average stops moving — and a score that no longer moves no longer tells you where an agent fails.

That matters most for the capability people actually ship agents to do: build and maintain backend services. Writing a function that passes a unit test is not the same skill as building an endpoint that stays correct when two requests race, when a token is replayed, when a migration runs twice, when a cursor straddles a page boundary. General benchmarks rarely isolate that skill, and the ones that touch it bundle it with repository navigation, issue triage, and language breadth — so a low score doesn't tell you _which_ thing the agent got wrong.

## The bet

`bun-server-bench` makes two bets.

**First, narrow the domain.** Restrict the benchmark to production-shaped Bun server tasks — HTTP contracts, persistence and transactions, auth and authz, concurrency, rate limiting, queues, observability, WebSockets, uploads. The surface is small enough to specify precisely and small enough to train a specialist against, but rich enough that real engineering judgment is required.

**Second, engineer discrimination into every task.** A task is only worth scoring if a plausible, confident, _wrong_ implementation can fail it. So every task is built around a trap: the visible tests describe the contract and pass for the obvious solution, and the hidden tests probe the state transition, race, protocol detail, or security boundary that the obvious solution gets wrong.

## The mechanism

This is the defining contract of the benchmark, and it is enforced for all 50 tasks:

1. **The shipped starter fails the public tests.** The task is non-trivial; there is real work to do.
2. **The private reference solution passes every public _and_ hidden test.** The task is achievable and well-specified, not a riddle.
3. **A plausible shortcut passes the public tests and fails the hidden ones.** This is what makes the score discriminate. If a naive solution passed the hidden tests too, the task would carry no signal.

Public tests _orient_; hidden tests _discriminate_. The agent sees the prompt, the starter source, the package files, the public tests, and the helpers those tests need — and nothing else. It never sees the hidden tests, the reference solution, or the known failure modes. The contract is understandable without being trivial to satisfy.

The concrete shape of these traps — the specific mistake each task is designed to catch — is catalogued in **[task-anatomy.md](task-anatomy.md)**.

## Why Bun

The domain has to be narrow enough to specify exactly and to train against. Bun is a good fit because it compresses a modern server stack into a small set of primitives:

- `Bun.serve` provides HTTP and WebSocket handling without framework ceremony, so tasks test the agent's understanding of the protocol rather than a framework's API.
- `bun:sqlite` enables realistic persistence, transactions, and migrations with no external service to mock or stand up.
- Native TypeScript keeps the implement-run-test loop tight.
- The runtime is young, so benchmark memorization pressure is lower than in mature Python or JavaScript ecosystems.

And critically: this is **not** a throughput benchmark. A server that handles 100k req/s but returns `409` where the contract says `412` scores zero. Correctness under contract is the only signal. Every task runs with **zero runtime dependencies** and **network disabled**, so the agent must implement the capability itself instead of importing a library that already solved it — see **[integrity.md](integrity.md)**.

## How it differs from existing benchmarks

| Dimension          | SWE-bench-style             | HumanEval / LiveCodeBench     | bun-server-bench                                    |
| ------------------ | --------------------------- | ----------------------------- | --------------------------------------------------- |
| Task shape         | Fix an issue in a real repo | Complete an isolated function | Implement a service from a spec + starter           |
| Signal             | Repo issue resolution       | Algorithmic correctness       | Backend contract correctness                        |
| What discriminates | The repo's existing tests   | Held-out test cases           | Hidden tests engineered against plausible shortcuts |
| Training artifact  | Run-dependent               | Usually none                  | First-class SFT and patch exporters                 |
| Primary use        | Broad agent evaluation      | Algorithmic completion        | Narrow-domain evaluation and specialization         |

Those benchmarks measure broad, valuable capabilities. None of them isolate whether an agent can build a correct, production-shaped backend service with exact HTTP semantics, stateful behavior, transaction boundaries, and no library escape hatch. That is the one question this benchmark is built to answer.

## What it can and cannot tell you

It **can** tell you whether an agent reliably implements bounded, production-shaped Bun backend services — and, because every task is trap-engineered, _where_ it stops being reliable.

It **cannot**, on its own, prove that an agent can maintain a large production system, design open-ended architecture, or optimize high-throughput services. It is a focused instrument for a narrow but important engineering domain, and it is deliberately honest about that scope.

Next: see the traps up close in **[task-anatomy.md](task-anatomy.md)**, or what a frontier agent actually scores in **[results.md](results.md)**.
