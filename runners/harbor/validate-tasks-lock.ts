import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { sanitizeName } from "./export";
import {
  buildTasksLock,
  discoverHarborTaskDirs,
  hashDirectory,
  readTasksLock,
  tasksLockPath,
  type TasksLock,
} from "./tasks-lock";

export type TaskLockIssue =
  | {
      kind: "missing_export";
      slug: string;
      taskPath: string;
    }
  | {
      kind: "checksum_mismatch";
      slug: string;
      taskPath: string;
      expected: string;
      actual: string;
    }
  | {
      kind: "stale_export";
      slug: string;
    }
  | {
      kind: "source_changed";
      slug: string;
      taskPath: string;
    }
  | {
      kind: "aggregate_checksum_mismatch";
      expected: string;
      actual: string;
    };

export type TasksLockValidationResult = {
  harborRoot: string;
  lockPath: string;
  lock: TasksLock | null;
  actual: TasksLock;
  issues: TaskLockIssue[];
  tasksToExport: string[];
  staleSlugs: string[];
  isValid: boolean;
};

export function slugForTaskPath(taskPath: string): string {
  return sanitizeName(basename(taskPath));
}

export function findChangedTaskPaths(taskPaths: string[], sinceRef?: string): string[] {
  if (!sinceRef) {
    return [];
  }

  if (/^0+$/.test(sinceRef)) {
    return [...taskPaths].sort();
  }

  const proc = Bun.spawnSync(["git", "diff", "--name-only", sinceRef, "HEAD", "--", "tasks/"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    const message = proc.stderr.toString().trim() || proc.stdout.toString().trim();
    throw new Error(`failed to diff tasks since ${sinceRef}: ${message}`);
  }

  const changedSlugs = new Set<string>();
  for (const line of proc.stdout.toString().split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("tasks/")) {
      continue;
    }

    const segments = trimmed.split("/");
    if (segments.length < 2) {
      continue;
    }

    changedSlugs.add(segments[1]);
  }

  return taskPaths.filter((taskPath) => changedSlugs.has(basename(taskPath))).sort();
}

export function validateTasksLock(
  harborRoot: string,
  taskPaths: string[],
  options: { changedTaskPaths?: string[] } = {},
): TasksLockValidationResult {
  const absoluteHarborRoot = resolve(harborRoot);
  const lock = readTasksLock(absoluteHarborRoot);
  const actual = buildTasksLock(absoluteHarborRoot);
  const issues: TaskLockIssue[] = [];
  const tasksToExport = new Set<string>();
  const activeSlugs = new Set(taskPaths.map(slugForTaskPath));

  for (const taskPath of options.changedTaskPaths ?? []) {
    tasksToExport.add(taskPath);
    issues.push({
      kind: "source_changed",
      slug: slugForTaskPath(taskPath),
      taskPath,
    });
  }

  for (const taskPath of taskPaths) {
    const slug = slugForTaskPath(taskPath);
    const harborDir = join(absoluteHarborRoot, slug);
    const actualChecksum = existsSync(harborDir) ? hashDirectory(harborDir) : undefined;
    const expectedChecksum = lock?.tasks[slug];

    if (!actualChecksum) {
      issues.push({ kind: "missing_export", slug, taskPath });
      tasksToExport.add(taskPath);
      continue;
    }

    if (!expectedChecksum) {
      issues.push({
        kind: "checksum_mismatch",
        slug,
        taskPath,
        expected: "missing-in-lock",
        actual: actualChecksum,
      });
      tasksToExport.add(taskPath);
      continue;
    }

    if (expectedChecksum !== actualChecksum) {
      issues.push({
        kind: "checksum_mismatch",
        slug,
        taskPath,
        expected: expectedChecksum,
        actual: actualChecksum,
      });
      tasksToExport.add(taskPath);
    }
  }

  for (const slug of discoverHarborTaskDirs(absoluteHarborRoot)) {
    if (!activeSlugs.has(slug)) {
      issues.push({ kind: "stale_export", slug });
    }
  }

  if (lock && lock.checksum !== actual.checksum) {
    issues.push({
      kind: "aggregate_checksum_mismatch",
      expected: lock.checksum,
      actual: actual.checksum,
    });
  }

  const staleSlugs = discoverHarborTaskDirs(absoluteHarborRoot).filter((slug) => !activeSlugs.has(slug));
  const isValid =
    issues.length === 0 &&
    lock !== null &&
    Object.keys(lock.tasks).sort().join("\0") === Object.keys(actual.tasks).sort().join("\0");

  return {
    harborRoot: absoluteHarborRoot,
    lockPath: tasksLockPath(absoluteHarborRoot),
    lock,
    actual,
    issues,
    tasksToExport: [...tasksToExport].sort(),
    staleSlugs,
    isValid,
  };
}
