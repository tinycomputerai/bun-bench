# bun-server-bench documentation

This documentation is organized around four reasons you might be here: to decide whether the benchmark is real, to use it, to trust it, or to build on it.

## Start here

| Question                                          | Read                               |
| ------------------------------------------------- | ---------------------------------- |
| What is this and why should I care?               | [thesis.md](thesis.md)             |
| Does it actually measure something hard?          | [task-anatomy.md](task-anatomy.md) |
| What happens when you run a frontier agent on it? | [results.md](results.md)           |
| Could an agent just cheat it?                     | [integrity.md](integrity.md)       |
| How do I run it?                                  | [quickstart.md](quickstart.md)     |

## Guides

| Goal                                     | Guide                                                              |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Benchmark your agent                     | [guides/evaluate-your-agent.md](guides/evaluate-your-agent.md)     |
| Train a model on the trajectories        | [guides/train-on-trajectories.md](guides/train-on-trajectories.md) |
| Contribute a task                        | [guides/contribute-a-task.md](guides/contribute-a-task.md)         |
| Understand train/eval splits and leakage | [splits-and-leakage.md](splits-and-leakage.md)                     |

## Reference

Normative specs and execution details live in [reference/](reference/):

| Document                                                   | Purpose                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| [reference/task-spec.md](reference/task-spec.md)           | Canonical task schema and evaluation contract               |
| [reference/scoring.md](reference/scoring.md)               | The live gate model and the forward-looking weighted schema |
| [reference/harbor.md](reference/harbor.md)                 | Harbor packaging, the canonical execution engine            |
| [reference/local-runners.md](reference/local-runners.md)   | Local task/agent/suite runners (development smoke tests)    |
| [reference/validation.md](reference/validation.md)         | What the validator enforces                                 |
| [reference/dataset-export.md](reference/dataset-export.md) | SFT and patch export formats                                |
| [reference/releasing.md](reference/releasing.md)           | Release and publication runbook                             |

## Reading paths

**Evaluator:** [thesis](thesis.md) → [task-anatomy](task-anatomy.md) → [integrity](integrity.md) → [results](results.md) → [evaluate-your-agent](guides/evaluate-your-agent.md)

**Model builder:** [thesis](thesis.md) → [evaluate-your-agent](guides/evaluate-your-agent.md) → [results](results.md) → [train-on-trajectories](guides/train-on-trajectories.md) → [splits-and-leakage](splits-and-leakage.md)

**Contributor:** [task-anatomy](task-anatomy.md) → [contribute-a-task](guides/contribute-a-task.md) → [reference/task-spec](reference/task-spec.md)
