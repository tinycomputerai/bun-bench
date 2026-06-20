# Quickstart

From a fresh checkout to validating tasks, running a reference solution, benchmarking an agent, and exporting trajectories.

## Prerequisites

- Bun 1.3 or newer
- Git
- Optional: Docker and the Harbor CLI for Harbor execution
- Optional: agent CLIs such as Claude Code or Codex

## Install and validate

```sh
bun install
bun run validate     # all 50 tasks structurally valid
bun run test         # repository unit tests
```

## Run one task

Run a task's starter code. Many starters intentionally fail — the agent is expected to implement the service:

```sh
bun run run:task tasks/http-apis.todo-health.v1
```

Run the reference solution end-to-end (start the service, run public + hidden tests, score it):

```sh
bun run run:reference tasks/http-apis.todo-health.v1
```

Outputs land under:

```text
runs/<timestamp>-<task-id>/
  result.json
  workspace/
  logs/
```

## Run an agent

```sh
bun run run:agent --task tasks/authentication.jwt-verify.v1 --agent claude-code
```

Adapters and their status are in **[guides/evaluate-your-agent.md](guides/evaluate-your-agent.md)**.

## Run the full suite

```sh
bun run run:suite --agent claude-code --tasks 'tasks/**' --concurrency 3
```

Suite summaries are written under `results/<agent-id>/` (`summary.json`, `leaderboard.json`).

## Run with Harbor

Harbor is the canonical execution engine for published packages:

```sh
harbor run -p harbor/databases-optimistic-version-v1 --agent oracle -e docker -y
```

See **[reference/harbor.md](reference/harbor.md)**.

## Export trajectories

After successful agent runs, export training data:

```sh
bun run export:sft --runs 'runs/**' --out datasets/sft/bun-server-bench.jsonl
bun run export:patches --runs 'runs/**' --out datasets/patches/bun-server-bench.jsonl
```

Split hygiene is enforced by default. See **[guides/train-on-trajectories.md](guides/train-on-trajectories.md)** and **[splits-and-leakage.md](splits-and-leakage.md)**.

## Where to go next

- Why the benchmark measures something real → **[thesis.md](thesis.md)**
- What the traps look like → **[task-anatomy.md](task-anatomy.md)**
- What a frontier agent scores → **[results.md](results.md)**
