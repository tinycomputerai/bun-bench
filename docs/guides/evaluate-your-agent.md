# Evaluate your agent

Point your coding agent at bun-server-bench, get a score per task, and see exactly which behavioral edge cases it missed. An agent run materializes a clean workspace from a task, hands the agent the prompt plus starter code and public tests, then scores the result by running both the public and the hidden suites against whatever the agent produced. A task is `100` only if both suites pass; `25` if public passes but hidden fails; `0` otherwise — see [scoring](../reference/scoring.md).

## Pick a runner

| Runner             | Use it for                                    | Command             |
| ------------------ | --------------------------------------------- | ------------------- |
| Local agent runner | Fast iteration, adapter development           | `bun run run:agent` |
| Local suite runner | Batch evaluation across all tasks             | `bun run run:suite` |
| Harbor             | Containerized, reproducible, publishable runs | `harbor run`        |

The local runners are the quick path. [Harbor](../reference/harbor.md) is the canonical execution environment — it runs each task in a sealed container with the network disabled and the hidden verifier injected only at scoring time, so a Harbor score is the one you publish.

## Run one task

```sh
bun run run:agent \
  --task tasks/authentication.jwt-verify.v1 \
  --agent claude-code
```

The runner writes a fresh workspace, invokes the agent, starts the submitted service, probes readiness, runs public then hidden tests, and writes the score. Swap `--agent` for any supported adapter:

| Agent ID      | Status      | Notes                               |
| ------------- | ----------- | ----------------------------------- |
| `claude-code` | Implemented | Claude Code CLI (`claude -p`)       |
| `codex-cli`   | Implemented | `codex exec`                        |
| `gpt-5`       | Implemented | Codex CLI harness pinned to `gpt-5` |
| `aider`       | Planned     | —                                   |
| `opencode`    | Planned     | —                                   |

All implemented adapters share the same materialization, prompt construction, scoring lifecycle, and result schema, so scores are comparable across them. Authenticate the underlying CLI first (`claude auth`, `codex login`).

## Run the full suite

```sh
bun run run:suite \
  --agent claude-code \
  --tasks 'tasks/**' \
  --concurrency 3
```

High concurrency can trip account or tool rate limits on the agent side. Start at `1` or `3` and raise it only once you know the agent sustains it.

Resume an interrupted or partially failing run — passing tasks from the existing leaderboard are kept, failed and pending tasks are retried:

```sh
bun run run:suite \
  --agent claude-code \
  --tasks 'tasks/**' \
  --failed-from results/claude-code/leaderboard.json
```

## Run it through Harbor

Use Harbor for containerized execution and Harbor-native job artifacts. The oracle agent (which replays the reference solution) is a quick way to confirm a package scores `100` end to end:

```sh
harbor run \
  -p harbor/databases-optimistic-version-v1 \
  --agent oracle \
  -e docker \
  -y
```

For a real coding agent, point Harbor's agent configuration at it. The container's `reward.txt` (`1.0` / `0.25` / `0.0`) maps directly onto the benchmark score. See [Harbor reference](../reference/harbor.md).

## Where results land

```text
runs/<timestamp>-<task-id>/      # one per task run
  result.json                    # score, status, timings, token metadata
  workspace/                     # the exact tree the agent produced
  logs/                          # prompt, stdout, stderr

results/<agent-id>/              # suite-level aggregates
  summary.json
  leaderboard.json
```

## Next

- [Interpret the scores and read the failure case studies](../results.md)
- [Understand why a score is trustworthy](../integrity.md)
