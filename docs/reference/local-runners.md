# Local runners

> **These runners are development smoke tests, not the evaluation engine.**
> [Harbor](harbor.md) is the canonical, primary execution path for published
> packages — containerized, with an authoritative verifier. The local task,
> agent, and suite runners let a maintainer reproduce a score, debug a task, or
> sanity-check an agent without Docker. They are not where new execution features
> (rollout capture, RL, sandbox enforcement) are built.

All three runners share one lifecycle: materialize an agent-visible workspace,
install, start the service, wait for HTTP readiness, run public tests from the
workspace, run hidden tests from outside it, enforce timeouts, and write
`result.json`. They differ only in what fills the workspace and how many tasks
they orchestrate. Hidden tests always run from the original task directory with
`BUN_SERVER_BENCH_APP_DIR` pointing at the workspace, so hidden files never enter
the agent-visible tree.

All three apply the gate scoring model (100 / 25 / 0). Component weights from
`task.yaml` are **not** applied locally — see [scoring.md](scoring.md).

## Task runner — `run:task`

Runs one task package end-to-end, in starter mode or against the reference
solution. Used to validate a task and confirm the reference scores 100.

```sh
# Starter mode (expected to fail until implemented)
bun run run:task tasks/http-apis.todo-health.v1

# Reference solution
bun run run:reference tasks/http-apis.todo-health.v1
```

Starter mode materializes `task.yaml`, `prompt.md`, `package.json`, the lockfile,
`src/`, `fixtures/public/`, `tests/public/`, and `tests/helpers/`. Reference mode
swaps the submitted `src/` for `solutions/reference/`.

**Status values:** `completed`, `failed_install`, `failed_start`,
`failed_readiness`, `failed_public_tests`, `failed_hidden_tests`, `timed_out`,
`invalid_task`.

Implementation: `runners/local/`.

## Agent runner — `run:agent`

Runs a coding agent against a single task and writes a scored `result.json`.

```sh
bun run run:agent --task tasks/http-apis.todo-health.v1 --agent claude-code
```

The runner builds the prompt from `instruction.prompt_file` (`prompt.md`) plus
optional `task.yaml` metadata (`instruction.summary`, `constraints`,
`allowed_assumptions`, `disallowed_shortcuts`). Hidden tests, reference
solutions, scoring weights, and runner internals are never included.

### Supported agents

| Agent ID      | Status      | Description                                                      |
| ------------- | ----------- | ---------------------------------------------------------------- |
| `claude-code` | implemented | Anthropic Claude Code CLI (`claude -p`)                          |
| `codex-cli`   | implemented | OpenAI Codex CLI (`codex exec`)                                  |
| `gpt-5`       | implemented | GPT-5 through the Codex CLI harness (`codex exec --model gpt-5`) |
| `aider`       | planned     | Aider                                                            |
| `opencode`    | planned     | OpenCode                                                         |

All implemented agents share workspace materialization, prompt construction,
the validation lifecycle, scoring, and the `result.json` schema. They differ only
in how the agent phase executes.

### Agent interface

```typescript
interface Agent {
  readonly id: string;
  prepare(context: AgentContext): Promise<void>; // verify binary, write prompt artifact
  run(context: AgentContext): Promise<AgentRunOutcome>; // execute in workspace, return status + metrics
  cleanup(context: AgentContext): Promise<void>; // always called, even on failure
}
```

Register new agents in `agents/registry.ts`. To add one: create
`agents/<agent-id>.ts` implementing `Agent`, register it, document setup here,
and run a task to confirm `result.json` is produced.

### Agent setup

- **claude-code** — `claude --version`, `claude auth`. The runner invokes
  `claude -p --dangerously-skip-permissions --output-format json` with the prompt
  on stdin. Token usage and `tool_calls` (`num_turns`) are parsed from the final
  JSON object on stdout.
- **codex-cli** — `codex --version`, `codex login` (or `OPENAI_API_KEY`). The
  runner invokes
  `codex exec --json --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox "<prompt>"`.
  Token usage is parsed best-effort from usage / `token_count` events.
- **gpt-5** — the same Codex harness with `--model gpt-5` pinned; shares all
  Codex setup. Requires that the authenticated account has `gpt-5` access,
  otherwise the agent phase exits non-zero (`failed_agent`). Add another
  `CodexCliAgent` to the registry to pin a different model.

Agent runs add `agent_id`, `mode: "agent"`, `outcome.agent`,
`durations.agent_ms`, and `metrics` to `result.json`, plus the `failed_agent`
status.

Implementation: `agents/` and `runners/agent/`.

## Suite runner — `run:suite`

Runs an agent across many tasks and writes aggregate results.

```sh
# All tasks
bun run run:suite --agent claude-code --tasks 'tasks/**'

# Bounded concurrency
bun run run:suite --agent claude-code --tasks 'tasks/**' --concurrency 4

# Resume: rerun only failed + pending tasks from a prior leaderboard
bun run run:suite --agent claude-code --tasks 'tasks/**' \
  --failed-from results/claude-code/leaderboard.json --concurrency 3
```

`--failed-from` alone reruns tasks scoring `< 100`. Combined with `--tasks`, it
also runs tasks missing from the leaderboard (never finished). Passing entries
are kept; retries replace failures and fill in pending tasks.

Each parallel task gets its own run directory, workspace copy, dynamically
allocated `PORT`, logs, and `result.json` — tasks never share ports or
directories. `--concurrency` must be an integer ≥ 1 (default 1); with
`claude-code` and concurrency > 3 the runner warns about rate limits. Individual
task failures do not stop the suite.

### Output

```text
results/<agent-id>/
  summary.json     # agent_id, total_tasks, passed, failed, average_score, timing
  leaderboard.json # entries: task_id, score, duration_ms, status, run_id
```

Entries are sorted by score descending, then task id ascending. A task **passes**
only on status `completed` (public and hidden both pass); any other status is a
failure.

Implementation: `runners/suite/` (reuses `runAgent()` from
`runners/agent/runner.ts`).

## Known limitations (all local runners)

- Only HTTP readiness checks are supported.
- Metamorphic tests are not executed.
- Component-weighted scoring from `task.yaml` is not applied (gate model only).
- Sandbox / network isolation from the task spec is not enforced locally — only
  Harbor enforces it.
- Full artifact capture (`junit.xml`, `metrics.json`, rollout files) is partial.
- Task discovery supports simple globs only (`tasks/**`, `tasks/*`, or one path).
