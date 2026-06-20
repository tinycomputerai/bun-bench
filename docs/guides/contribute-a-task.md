# Contribute a task

The benchmark is only as good as its hardest tasks. The most valuable contribution is a new task that a plausible-but-wrong implementation passes on the public tests and fails on the hidden ones — a task that *discriminates*. Tasks that any competent agent clears on the first try add no signal.

High-value contributions, roughly in order:

- new Bun server tasks with realistic production failure modes
- hidden tests that catch shortcut implementations on existing tasks
- additional agent adapters
- reproducible suite-run result reports and dataset/leakage analysis
- Harbor packaging improvements

## What makes a good task

A good task is self-contained, fast to run, and precise about HTTP and state semantics — and it has a trap. The starter must fail, a competent agent must be able to solve it, and the obvious shortcut must not survive the hidden tests. Before authoring, read [Anatomy of a Task](../task-anatomy.md) to see how existing tasks engineer that gap; your task should fit the same mold.

Avoid tasks that need external services, network access, vague product judgment, or large framework scaffolding. Native `Bun.serve`, `bun:sqlite`, and `node:crypto` with zero runtime dependencies is the target shape — it forces the agent to implement the capability rather than import it.

## The acceptance bar

Every task must satisfy three invariants. They are not guidelines — a task that misses any one of them is not discriminative and will not be accepted:

1. **The starter fails the public tests.** The task is non-trivial out of the box.
2. **The reference solution passes every public *and* hidden test.** The task is solvable and the contract is internally consistent.
3. **A plausible shortcut passes public but fails hidden.** This is the whole point. If you can't name a believable wrong implementation that the public tests admit, the hidden tests aren't doing their job.

Write the shortcut you're trapping into `known_failure_modes` in `task.yaml` — it documents intent and guides reviewers.

## Directory layout

One directory per task under `tasks/`. The directory name must equal `task.yaml`'s `id`.

```text
tasks/{task_id}/
  task.yaml             # metadata, scoring contract, test declarations, provenance
  prompt.md             # the instruction shown to the agent
  package.json
  bun.lock              # bun.lock or bun.lockb both accepted
  src/                  # starter implementation (intentionally incomplete)
    README.md
  tests/
    public/             # visible, intentionally incomplete
    hidden/             # scored edge cases
    metamorphic/
    helpers/
  fixtures/
  runner/
  validators/
  solutions/
    reference/          # private reference implementation, scores 100
```

## Metadata essentials

The full schema is normative in [task-spec](../reference/task-spec.md). The fields that govern how a task is categorized, scored, and exported:

- `category` and `difficulty.level` — taxonomy and the 1–5 difficulty ladder.
- `dataset.split` — one of `train`, `dev`, `public_eval`, `private_eval`.
- `dataset.leakage_group` — the task family, used for split hygiene; required.
- `dataset.trainable` — must be `false` for `private_eval`; never pair `private_eval` with `trainable: true`.
- `tests.*.weight` must sum to `1.0`; `scoring.weights` must sum to `1.0`.
- `curriculum.skill_atoms` name concrete reusable capabilities; `small_model_suitability` is `low`/`medium`/`high`.

Keep all referenced paths relative and inside the task directory. Keep subjective style expectations out of `success_criteria`.

See [splits and leakage](../splits-and-leakage.md) for how `split`, `leakage_group`, and `trainable` flow into dataset exports.

## Authoring loop

```sh
bun run validate:task tasks/<task-id>      # structural checks against the schema
bun run run:reference tasks/<task-id>      # confirm the reference scores 100
bun run harbor:export --task tasks/<task-id>
bun run harbor:tasks-lock
bun run validate:tasks-lock --tasks 'tasks/**'
```

## Before opening a PR

```sh
bun run validate
bun run test
bun run harbor:export-suite --tasks 'tasks/**'
bun run harbor:tasks-lock
bun run validate:tasks-lock --tasks 'tasks/**'
```

If task exports changed, regenerate the Harbor packages and the lock so the committed packages stay in sync with the authored tasks.
