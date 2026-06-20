# Train on trajectories

A score tells you *whether* an agent solved a task. A trajectory tells you *how*. bun-server-bench turns every full-credit agent run into a training example: the exact prompt the agent saw, the starter-to-solution diff it produced, and the metadata needed to keep training and evaluation cleanly separated. The result is a supervised dataset for specializing a small model on Bun backend engineering — the same data we use to study whether a narrow model can match a frontier agent on this domain.

Exports are read-only. They scan existing run directories under `runs/` and write JSONL; they never re-run an agent.

## What a trajectory captures

Only completed agent runs that clear the score gate are eligible. Each exported record links:

- the task prompt shown to the agent
- the unified diff from the starter tree to the agent's workspace
- the score, task ID, run ID, and agent ID
- the split and leakage group (so downstream pipelines can filter without re-parsing tasks)
- timing and token metadata when the run captured it

Reference solutions, oracle runs, hidden tests, fixtures, and lockfiles are never included — see [integrity](../integrity.md) for why that separation is load-bearing.

## Two formats

**SFT** records are chat examples ready for instruction tuning:

```json
{
  "messages": [
    { "role": "system", "content": "You are a Bun backend specialist..." },
    { "role": "user", "content": "<task prompt>" },
    { "role": "assistant", "content": "<unified diff patch>" }
  ],
  "metadata": {
    "task_id": "authentication.bearer-profile.v1",
    "run_id": "...",
    "score": 100,
    "agent_id": "claude-code",
    "dataset": { "split": "dev", "leakage_group": "authentication.bearer-profile" }
  }
}
```

**Patch** records keep prompt and diff in separate fields for patch-modeling and analysis:

```json
{
  "task_id": "authentication.bearer-profile.v1",
  "prompt": "<task prompt>",
  "patch": "<unified diff patch>",
  "files_changed": ["src/server.ts"],
  "score": 100,
  "agent_id": "claude-code",
  "dataset": { "split": "dev", "leakage_group": "authentication.bearer-profile" }
}
```

Full field reference and skip-reason semantics live in [dataset-export reference](../reference/dataset-export.md).

## Export

```sh
bun run export:sft \
  --runs 'runs/**' \
  --out datasets/sft/bun-server-bench.jsonl

bun run export:patches \
  --runs 'runs/**' \
  --out datasets/patches/bun-server-bench.jsonl
```

Both commands share the same hygiene flags:

| Flag | Default | Effect |
| --- | --- | --- |
| `--min-score` | `100` | Only export runs at or above this score |
| `--allow-public-eval` | off | Include `public_eval` tasks (excluded by default) |
| `--allow-private-eval` | off | Include `private_eval` tasks (excluded by default) |
| `--tasks-root` | `tasks` | Task package root for prompts and metadata |

By default the exporter takes only agent runs that completed at full credit, includes `train` and `dev`, and excludes `public_eval`, `private_eval`, and any task marked `trainable: false`. The defaults are the safe path — you have to opt in, explicitly, to anything that risks evaluation leakage.

## Split and leakage discipline

The metadata is there so you can enforce hygiene downstream, not just trust the defaults. Filter and deduplicate by `leakage_group`, not only by `task_id`: two tasks with different IDs can share an endpoint pattern and quietly contaminate a held-out set. Keep `public_eval` and `private_eval` trajectories out of training unless you have a deliberate reason. The full split contract — what each label means and how the gate is enforced — is in [splits and leakage](../splits-and-leakage.md).

## The corpus report

A dataset release ships with a point-in-time analysis of what's in it: example counts, token totals, task coverage, and duplicate rate. The current snapshot is at [reports/2026-06-18-sft-report.md](../reference/reports/2026-06-18-sft-report.md) — 120 SFT examples across 48 of 50 tasks, ~214K tokens, with private-eval examples held out. Treat it as a snapshot, not a guarantee: regenerate it whenever you cut a new dataset release.
