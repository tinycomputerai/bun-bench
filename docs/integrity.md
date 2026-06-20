# Benchmark integrity

A benchmark is only worth its score if the score is hard to fake. The first question a careful evaluator asks is: _could an agent pass without actually solving the task?_ This page is the answer. Every guarantee below is enforced mechanically, not by convention.

## Hidden tests are physically separated

The hidden suite is the discriminating signal, so it never enters the agent's reach.

**Locally.** Public tests run from the materialized agent workspace. Hidden tests run from the original task package, _outside_ that workspace, with `BUN_SERVER_BENCH_APP_DIR` pointing the test helpers at the submitted service. The agent can read, edit, and delete everything in its workspace and still never touch a hidden test, because the hidden tests aren't there.

**In Harbor.** `environment/app/` is baked into the Docker image as the agent workspace. `tests/hidden/` is injected only at verification time, after the agent is done. `tests/test.sh` runs the public and hidden suites and writes `reward.txt`. See **[reference/harbor.md](reference/harbor.md)**.

The agent sees the prompt, the starter `src/`, the package files, the public tests, and the helpers those tests import. It never sees the hidden tests, the reference solution, or the `known_failure_modes` recorded in `task.yaml`.

## No escape hatches

The traps test whether the agent can _implement_ a capability — so the environment removes every way to avoid implementing it.

- **Zero runtime dependencies.** Every task ships with an empty dependency allowlist. The agent builds on native `Bun.serve`, `bun:sqlite`, and `node:crypto` — it cannot `npm install` a library that already solved the problem.
- **Network denied during install and tests.** `bun install --no-save` runs with networking off. This removes install flakiness and forecloses fetching a solution at runtime.
- **Filesystem boundaries.** `tests/` and `runner/` are read-only; reading under `tests/hidden` and spawning unrestricted processes are forbidden patterns. A task that reads hidden tests or opens an outbound socket fails its security gate and scores zero regardless of test results.

## Results are reproducible

- **Tasks are versioned.** Each `task.yaml` carries a `spec_version` and `task_version`; behavior changes are visible in the metadata.
- **Harbor packages are committed and checksummed.** The generated `harbor/` packages live in the repo, and `harbor/tasks-lock.json` records a checksum per task. `bun run validate:tasks-lock` fails if a committed package drifts from its source task.
- **Run artifacts are complete.** Every run records the exact prompt shown to the agent, the starter-to-solution patch, the test logs, the score, and timing/token metadata under `runs/<timestamp>-<task-id>/`. A result can be inspected, not just trusted.

## Training data stays clean

The benchmark is also a trajectory dataset, which creates a leakage risk: training on an eval task contaminates the eval. The exporters enforce hygiene by default.

- **Splits gate export.** `train` and `dev` are exportable; `public_eval` and `private_eval` are excluded from default exports and must be opted in explicitly. Tasks marked `trainable: false` are never exported for training.
- **Leakage groups travel with the data.** Tasks that share a `leakage_group` are split as a unit, and the group is recorded in every exported record so downstream pipelines can de-contaminate without re-parsing task directories.
- **Hidden tests and reference solutions are never exported.** Exported trajectories contain the prompt, the patch, and metadata — not the scoring assets.

The full split policy is in **[splits-and-leakage.md](splits-and-leakage.md)**.

## What integrity does not claim

These guarantees make the _score_ trustworthy. They do not make the benchmark immune to a determined task author shipping a weak hidden suite — that is what the three-invariant acceptance bar in **[task-anatomy.md](task-anatomy.md)** defends, and what task review enforces. Integrity here means: a passing score reflects a service that satisfies the contract under tests the agent could not see, build around, or fetch its way past.
