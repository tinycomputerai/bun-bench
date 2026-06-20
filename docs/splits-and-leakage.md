# Splits and leakage

A benchmark that doubles as a training dataset has to defend a hard line between the data you learn from and the data you're judged on. bun-server-bench draws that line with three task-level fields — `split`, `leakage_group`, and `trainable` — and an exporter that enforces them by default. This page is the contract.

## The four splits

Every task declares `dataset.split` in `task.yaml`.

| Split | Intended use | Default export behavior |
| --- | --- | --- |
| `train` | Training trajectories — intentionally part of the training distribution | Included |
| `dev` | Development, debugging, ablations, non-final iteration | Included |
| `public_eval` | Public comparison; prompts/tests may be visible, trajectories should not train | Excluded unless `--allow-public-eval` |
| `private_eval` | Held-out evaluation | Excluded unless `--allow-private-eval`; normally `trainable: false` |

Current distribution:

| Split | Tasks |
| --- | ---: |
| `train` | 4 |
| `dev` | 44 |
| `public_eval` | 0 |
| `private_eval` | 2 |

`train` and `dev` are both trainable today, but treat them differently: `train` is the deliberate training distribution; `dev` is for iteration, agent debugging, and ablations, not final held-out scoring. `public_eval` exists for visible head-to-head comparison without feeding trajectories back into training. `private_eval` is the held-out set — excluded from routine export and marked non-trainable so it cannot leak. The two current private-eval tasks (e.g. `http.conditional-cache-semantics.v1`, `websockets.backpressure-ordering.v1`) are the held-out signal.

## Leakage groups

`dataset.leakage_group` names the task family a task belongs to, and the exporter stamps it onto every record. It matters because contamination doesn't respect task IDs:

- two tasks with different IDs can share an endpoint pattern or core mechanism
- near-duplicate patterns across the train/eval boundary silently inflate results
- a training pipeline needs a stable grouping key to deduplicate and split cleanly

**Split and deduplicate by leakage group, not just by task ID.** That is the single most important hygiene rule for anyone training on this data.

## The trainable flag

`dataset.trainable` is an explicit guardrail layered on top of splits:

- `trainable: true` — successful runs may be exported when split rules allow.
- `trainable: false` — the task is excluded from normal training exports *even if* a flag would otherwise include its split.

48 of 50 tasks are trainable; the 2 private-eval tasks are not. Never pair `private_eval` with `trainable: true`.

## How the exporter enforces it

The dataset exporters apply these gates by default — you opt in to risk, never out of safety:

- minimum score threshold, default `100` (full credit only)
- `public_eval` and `private_eval` excluded unless explicitly allowed
- `trainable: false` always excluded
- agent runs only — no reference, oracle, or non-agent runs
- no hidden test files and no reference solutions in exported patches
- `split` and `leakage_group` recorded in every row

To use these splits in practice, see [Train on Trajectories](guides/train-on-trajectories.md). For the export CLI, flags, and skip-reason semantics, see [dataset-export reference](reference/dataset-export.md).
