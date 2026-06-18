#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { discoverTasks } from "../suite/discover-tasks";
import { findChangedTaskPaths, validateTasksLock } from "./validate-tasks-lock";

const DEFAULT_OUT_ROOT = "harbor";

function parseArgs(argv: string[]): {
  tasksPattern: string;
  outRoot: string;
  changedSince?: string;
} {
  const args = argv.filter((arg) => arg !== "--");
  let tasksPattern: string | undefined;
  let outRoot = DEFAULT_OUT_ROOT;
  let changedSince: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--tasks") {
      tasksPattern = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--out") {
      outRoot = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--changed-since") {
      changedSince = args[index + 1];
      index += 1;
      continue;
    }
    throw new Error(usage());
  }

  if (!tasksPattern) {
    throw new Error(usage());
  }

  return { tasksPattern, outRoot, changedSince };
}

function usage(): string {
  return "usage: bun run validate:tasks-lock --tasks '<pattern>' [--changed-since <git-ref>]";
}

async function main(): Promise<void> {
  const { tasksPattern, outRoot, changedSince } = parseArgs(process.argv.slice(2));
  const harborRoot = resolve(process.cwd(), outRoot);
  if (!existsSync(harborRoot)) {
    console.error(`harbor export directory not found: ${harborRoot}`);
    process.exit(1);
  }

  const taskPaths = await discoverTasks(tasksPattern);
  const changedTaskPaths = findChangedTaskPaths(taskPaths, changedSince);
  const result = validateTasksLock(harborRoot, taskPaths, { changedTaskPaths });

  if (result.isValid) {
    console.log(`valid tasks lock: ${result.lockPath}`);
    return;
  }

  for (const issue of result.issues) {
    switch (issue.kind) {
      case "missing_export":
        console.error(`invalid tasks lock: missing export for ${issue.taskPath} (${issue.slug})`);
        break;
      case "checksum_mismatch":
        console.error(
          `invalid tasks lock: checksum mismatch for ${issue.taskPath} (${issue.slug}): expected ${issue.expected}, actual ${issue.actual}`,
        );
        break;
      case "source_changed":
        console.error(`invalid tasks lock: source changed for ${issue.taskPath} (${issue.slug})`);
        break;
      case "stale_export":
        console.error(`invalid tasks lock: stale export ${issue.slug}`);
        break;
      case "aggregate_checksum_mismatch":
        console.error(
          `invalid tasks lock: aggregate checksum mismatch: expected ${issue.expected}, actual ${issue.actual}`,
        );
        break;
    }
  }

  process.exit(1);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
