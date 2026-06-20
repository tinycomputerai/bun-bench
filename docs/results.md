# Results

The point of engineering discrimination into every task is that the score should move when an agent gets something subtly wrong. This page shows that it does.

## How to read a score

Scoring is a gate — there is no partial credit for almost-correct.

| Outcome | Score | Meaning |
| --- | ---: | --- |
| Public **and** hidden tests pass | 100 | Full behavioral correctness for the task contract |
| Public pass, hidden fail | 25 | The agent found the visible path but missed hidden behavior |
| Public fail, install/start/timeout failure | 0 | No runnable service satisfying the visible contract |

A score of 25 is the interesting one: it means the agent produced something that *looks* finished and fails only where the trap is. Full scoring details, including the Harbor `reward.txt` mapping, are in **[reference/scoring.md](reference/scoring.md)**.

## A frontier agent on the hardened suite

A full suite run of Claude Code (`claude` CLI 2.1.178, Bun 1.3.13) over the then-current task set:

| Metric | Before hardening (10 tasks) | After hardening (30 tasks) |
| --- | --- | --- |
| Pass rate | 10/10 (100%) | **29/30 (96.7%)** |
| Average score | 100.0 | **97.5** |
| Tasks losing points | 0 | **1** |

The headline isn't the 96.7%. It's that the average *moved off 100*. Before hardening, the suite was saturated — a perfect score that no longer distinguished capability levels. After hardening, the suite surfaced a real, specific failure mode in a frontier agent. That is the benchmark doing its job.

19 of the 20 harder tasks were still solved at full credit, which confirms the tasks are well-specified and achievable — the reference solutions and the strong-model runs agree — rather than impossible or ambiguous.

## The failure, in detail

One task lost points: **`authentication.jwt-verify.v1`**, scored **25** (`failed_hidden_tests`). Claude passed every public test and 9 of 10 hidden tests, failing one assertion:

```
alg:"none" token (empty signature) is rejected as invalid_alg, not accepted
  Expected: "invalid_alg"
  Received: "malformed"
```

This is worth dwelling on, because it is exactly the kind of failure the benchmark is built to catch. Claude **got the security property right**: it rejected the `alg:"none"` token instead of accepting an unsigned one — the dangerous outcome. What it got wrong was the *contract precision*. The spec requires algorithm pinning to run *before* signature/format handling, so a token declaring `alg:"none"` must be rejected as `invalid_alg`. Claude's implementation noticed the empty signature segment first and returned `malformed`.

Secure, but not contract-exact. A general benchmark would score this as a pass — the attack was defended. `bun-server-bench` scores it 25, because it can distinguish "defended the attack" from "implemented the contract." That distinction is the entire value proposition.

## Effort is a signal too

Among the full-credit solves, agent wall-time tracked difficulty:

- Quickest solve overall: `validation.required-name.v1` (~29s).
- Most effortful full-credit task: `idempotency.payment-capture.v1` (~6 min) — the concurrency-safe single-flight requirement made the agent work hardest, but it implemented the per-key lock correctly and passed.
- The harder difficulty-4 tasks averaged ~110s of agent time versus ~35s for the easier set, with several (`etag-concurrency`, `optimistic-version`, `multipart-checksum`) requiring multiple iterations.

## Reproduce or submit a run

Per-run artifacts — prompts, agent stdout, test logs, scores — are written under `runs/<timestamp>-<task-id>/`. To run your own agent against the suite and produce comparable numbers, see **[guides/evaluate-your-agent.md](guides/evaluate-your-agent.md)**. To understand why a failure like the one above is a fair signal rather than a flaky test, see **[integrity.md](integrity.md)**.
