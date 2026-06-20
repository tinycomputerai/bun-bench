# Scoring

bun-server-bench ships **two scoring models**. One is live and computes every
score you will ever see. The other is a richer schema declared in each
`task.yaml` that no scorer enforces yet. This page states plainly which is which,
so a number on a leaderboard is never ambiguous.

## The live model: gate-based 100 / 25 / 0

Every score today comes from a three-level gate. A run earns exactly one of
three values:

| Outcome | Score | Harbor `reward.txt` |
| --- | ---: | ---: |
| Public **and** hidden tests pass | 100 | `1.0` |
| Public tests pass, hidden tests fail | 25 | `0.25` |
| Public tests fail, or install / start / readiness / timeout fails | 0 | `0.0` |

There is no partial credit within a gate. A task is either fully correct,
visibly-but-not-deeply correct, or not runnable.

### Where it is implemented

The Harbor verifier `tests/test.sh` (emitted by the export adapter) is the
authoritative computation:

```bash
bun test public > /logs/verifier/public.log 2>&1
PUBLIC_EXIT=$?
bun test hidden > /logs/verifier/hidden.log 2>&1
HIDDEN_EXIT=$?

if   [ "$PUBLIC_EXIT" -eq 0 ] && [ "$HIDDEN_EXIT" -eq 0 ]; then REWARD=1.0
elif [ "$PUBLIC_EXIT" -eq 0 ];                             then REWARD=0.25
else                                                            REWARD=0.0
fi
echo "$REWARD" > /logs/verifier/reward.txt
```

The export adapter records the reward → score mapping in each package's
`bun-server-bench.meta.json`:

```json
"reward_model": {
  "values": { "public_and_hidden_pass": 1.0, "public_pass_hidden_fail": 0.25, "public_fail": 0.0 },
  "maps_to_bun_server_bench_score": { "1.0": 100, "0.25": 25, "0.0": 0 }
}
```

The local runners (see [local-runners.md](local-runners.md)) apply the same gate
to their `result.json` `score` field. Harbor is the canonical engine; the local
gate exists so a maintainer can reproduce a score without Docker.

## The spec model: weighted components (not enforced)

Each `task.yaml` declares a far richer scoring block — correctness, edge-case,
performance, security, and maintainability weights, a `performance` budget, and a
`dependency_budget`:

```yaml
scoring:
  max_score: 100
  weights:
    correctness: 0.70
    edge_cases: 0.15
    performance: 0.05
    security: 0.07
    maintainability: 0.03
  performance:
    metric: p95_latency_ms
    budget: 100
    floor: 20
  dependency_budget:
    max_runtime_dependencies: 8
    penalty_per_extra_dependency: 1
```

[task-spec.md §6.16](task-spec.md) defines the intended formula
(`gate_multiplier * clamp(0,100, 100 * Σ weightᵢ·ratioᵢ − dependency_penalty)`).

**None of this runs today.** No scorer reads `weights`, measures
`p95_latency_ms` for credit, or applies a dependency penalty. These fields are a
forward-looking contract: they document where graded, component-level scoring is
headed, and they are preserved verbatim in `bun-server-bench.meta.json` so a
future scorer (or a downstream consumer) can act on them without re-deriving
intent. Until that scorer exists, treat the weighted block as design intent, not
behavior.

## What this means for a result

- A leaderboard `score` is always one of `0`, `25`, `100`.
- A reward of `0.25` means "found the visible contract, missed the hidden edge
  cases" — the discriminative signal this benchmark is built around (see
  [../task-anatomy.md](../task-anatomy.md)).
- The performance and dependency metrics a task collects are recorded for
  analysis but do not move the score.

See [../results.md](../results.md) for how to read and reproduce scored runs, and
[harbor.md](harbor.md) for the verifier and reward mechanics in full.
