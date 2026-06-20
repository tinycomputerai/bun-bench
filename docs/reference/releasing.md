# Releasing

Maintainer runbook for publishing benchmark artifacts and datasets. Releases are
triggered from GitHub Actions only — there is no auto-release on push. The
workflow creates the `vX.Y.Z` git tag from a bare `X.Y.Z` version input; it never
bumps package versions and never publishes to npm.

The repository contains source, tasks, schemas, docs, and release tooling only.
Large generated JSONL exports are **not** committed. Datasets are staged locally
under `release-assets/` (gitignored), uploaded to Hugging Face staging before the
tag, and fetched by the workflow at publish time.

## Surfaces

A release publishes three surfaces:

| Surface         | What gets published                                              |
| --------------- | ---------------------------------------------------------------- |
| GitHub Releases | Changelog, benchmark tarball, SFT JSONL, patches JSONL, manifest |
| Harbor Hub      | All packages under `harbor/`, tagged with the release tag        |
| Hugging Face    | Dataset repo `tinycomputer/bun-server-bench-trajectories`        |

## Flow

```text
Generate trajectories → Export datasets → Stage assets → Upload staging
  → Run workflow_dispatch → Create tag → Publish GitHub Release
  → Publish Harbor → Publish Hugging Face
```

### 1. Generate trajectories

```sh
bun run run:suite --agent claude-code --tasks 'tasks/**'
```

`runs/` and `results/` stay local and gitignored — never committed or published.

### 2. Export datasets

```sh
bun run export:sft     --runs 'runs/**' --out datasets/sft/bun-server-bench.jsonl
bun run export:patches --runs 'runs/**' --out datasets/patches/bun-server-bench.jsonl
```

These paths are gitignored. Confirm split hygiene — see
[../splits-and-leakage.md](../splits-and-leakage.md) and
[dataset-export.md](dataset-export.md).

### 3. Stage release assets

```sh
bun run release:stage
# -> release-assets/bun-server-bench-sft.jsonl
#    release-assets/bun-server-bench-patches.jsonl

bun run release:verify -- --tag 0.1.0 --datasets-only
```

### 4. Upload staging

```sh
export HF_TOKEN=...   # write token for tinycomputer/bun-server-bench-trajectories
bun run release:upload-staging -- --tag 0.1.0
```

Stores files under `staging/<tag>/…` in the dataset repo, separate from the final
`releases/<tag>/…` paths.

### 5. Run the release workflow

Open **Actions → Release → Run workflow**. Use SemVer without a `v` prefix (e.g.
`0.1.0`); the workflow creates and pushes `v0.1.0` after validation and builds
succeed.

**Dry run first** (`dry_run: true`): checks out source, fetches staged assets,
runs `bun run validate` + `bun run test`, verifies assets and safety rules,
builds artifacts into `dist/release/`, confirms the tarball excludes `runs/` /
`results/` / `release-assets/`, previews the GitHub Release via
`release-it --dry-run`, and prints (without running) the Harbor / Hugging Face
publish commands. Fix all failures before a real release.

**Real release** (`dry_run: false`): pushes the `vX.Y.Z` tag, creates/updates the
GitHub Release via `release-it`, publishes Harbor packages when
`publish_harbor=true`, and uploads Hugging Face release files when
`publish_huggingface=true`.

## Prerequisites

| Secret / variable                     | Type         | Purpose                                            |
| ------------------------------------- | ------------ | -------------------------------------------------- |
| `TINYCOMPUTER_GITHUB_APP_CLIENT_ID`   | org variable | Client ID for the TinyComputer GitHub App          |
| `TINYCOMPUTER_GITHUB_APP_PRIVATE_KEY` | secret       | Private key for the GitHub App                     |
| `HARBOR_TOKEN`                        | secret       | Base64-encoded Harbor CLI credentials              |
| `HF_TOKEN`                            | secret       | Hugging Face write token (staging + final publish) |

GitHub Releases are created by the **TinyComputer GitHub App**, not the default
`GITHUB_TOKEN`: the workflow mints an installation token with `contents: write`
and passes it to `release-it`. The app must be installed on the `tinycomputerai`
org with release permission.

- **Harbor credentials:** run `uvx harbor auth login` once, then
  `base64 < ~/.harbor/credentials.json | tr -d '\n'` into `HARBOR_TOKEN`.
- **Hugging Face token:** write access to
  `tinycomputer/bun-server-bench-trajectories`, stored as `HF_TOKEN`.

## What gets published

**GitHub Releases** (from `dist/release/`): `bun-server-bench-<tag>.tar.gz`
(source bundle — `harbor/`, `tasks/`, schemas, runners, docs),
`bun-server-bench-sft-<tag>.jsonl`, `bun-server-bench-patches-<tag>.jsonl`,
`bun-server-bench-manifest-<tag>.json`. The tarball excludes `runs/`, `results/`,
`jobs/`, `datasets/`, `release-assets/`, `node_modules/`, and `dist/`.

**Harbor Hub:** `uvx harbor publish harbor/ -t <tag> --public`.

**Hugging Face** (`tinycomputer/bun-server-bench-trajectories`):
`staging/<tag>/…` (pre-release), `releases/<tag>/…` (versioned exports),
`data/sft/bun-server-bench.jsonl` and `data/patches/bun-server-bench.jsonl`
(latest pointers).

## Local commands

```sh
bun run release:stage                                    # stage exports
bun run release:upload-staging -- --tag 0.1.0            # upload staging (pre-tag)
bun run release:verify -- --tag 0.1.0 --datasets-only    # verify staged assets
bun run release:fetch-staging -- --tag 0.1.0             # fetch staging (CI parity)
bun run release:build -- --tag 0.1.0                     # build dist/release
bun run release:verify -- --tag 0.1.0                    # verify assets + tarball
bun run release:github:dry-run -- 0.1.0
bun run release:harbor -- --tag 0.1.0 --dry-run
bun run release:huggingface -- --tag 0.1.0 --dry-run
```

## Rollback and retry

- **Bad staging:** fix exports, re-run `release:stage`, re-run
  `release:upload-staging` (overwrites staging paths), proceed.
- **GitHub Release failed after build:** fix and re-run the workflow with the same
  tag and `dry_run=false`; `release-it` updates the existing release without a new
  tag.
- **Harbor / Hugging Face publish failed:** re-run with `dry_run=false`, disabling
  the steps that already succeeded.
- **Bad release published:** delete the GitHub Release (tag remains), revert
  Harbor/HF publication, then re-stage and release under a new tag (e.g.
  `v0.1.1`).

## Safety checks

Staged assets must pass before artifacts build: both SFT and patches JSONL exist
and are non-empty; **no** `public_eval` or `private_eval` examples; **no** hidden
test paths or reference-solution paths in patch content. Built artifacts must
pass before publishing: the tarball contains no `runs/`, `results/`, or
`release-assets/`. See [../splits-and-leakage.md](../splits-and-leakage.md) for
export rules and split policy.
