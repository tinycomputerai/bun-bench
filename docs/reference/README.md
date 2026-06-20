# Reference

Normative, implementation-level documentation: schemas, contracts, runner
mechanics, and adapter details. Start here once you already understand the
benchmark and need exact behavior. New readers should begin with
[../README.md](../README.md), [../thesis.md](../thesis.md), and the guides under
[../guides/](../guides/).

> **What is canonical.** [Harbor](harbor.md) is the primary execution engine for
> published packages. The [local runners](local-runners.md) (`run:task`,
> `run:agent`, `run:suite`) are development smoke tests — useful for reproducing a
> score or debugging a task without Docker, but not the evaluation path of record.

## Index

| Document | Use when |
| --- | --- |
| [task-spec.md](task-spec.md) | You need the normative task schema, versioning rules, and benchmark contract |
| [scoring.md](scoring.md) | You need to know which scoring model is live (gate) vs. declared (weighted) |
| [validation.md](validation.md) | You need exact `validate` CLI behavior and the structural checks enforced |
| [harbor.md](harbor.md) | You need the Harbor package shape, verifier, reward mapping, and `task.yaml` → Harbor field mapping |
| [local-runners.md](local-runners.md) | You need local task/agent/suite runner lifecycle, adapters, or output details |
| [dataset-export.md](dataset-export.md) | You need export flags, skip reasons, and the SFT / patch JSONL schemas |
| [releasing.md](releasing.md) | You are publishing a release to GitHub, Harbor, or Hugging Face |
| [reports/](reports/) | Dated, point-in-time dataset and corpus snapshots |
