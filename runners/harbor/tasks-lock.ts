import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const TASKS_LOCK_FILE = "tasks-lock.json";

export type TasksLock = {
  checksum: string;
  tasks: Record<string, string>;
};

export function tasksLockPath(harborRoot: string): string {
  return join(harborRoot, TASKS_LOCK_FILE);
}

export function readTasksLock(harborRoot: string): TasksLock | null {
  const lockPath = tasksLockPath(harborRoot);
  if (!existsSync(lockPath)) {
    return null;
  }

  const lock = JSON.parse(readFileSync(lockPath, "utf8")) as TasksLock;
  if (typeof lock.checksum !== "string" || typeof lock.tasks !== "object" || lock.tasks === null) {
    throw new Error(`${lockPath} must contain checksum and tasks fields`);
  }

  return lock;
}

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFilesRecursive(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function hashFiles(root: string, files: string[]): string {
  const hash = createHash("sha256");
  for (const file of files) {
    const rel = relative(root, file).split("\\").join("/");
    hash.update(rel);
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function hashDirectory(dir: string): string {
  return hashFiles(dir, listFilesRecursive(dir).sort());
}

function hashHarborRoot(harborRoot: string): string {
  const files = listFilesRecursive(harborRoot)
    .filter((file) => relative(harborRoot, file).split("\\").join("/") !== TASKS_LOCK_FILE)
    .sort();
  return hashFiles(harborRoot, files);
}

export function discoverHarborTaskDirs(harborRoot: string): string[] {
  if (!existsSync(harborRoot)) {
    return [];
  }

  return readdirSync(harborRoot)
    .filter((entry) => {
      const full = join(harborRoot, entry);
      return statSync(full).isDirectory() && existsSync(join(full, "task.toml"));
    })
    .sort();
}

export function buildTasksLock(harborRoot: string): TasksLock {
  const tasks: Record<string, string> = {};
  for (const name of discoverHarborTaskDirs(harborRoot)) {
    tasks[name] = hashDirectory(join(harborRoot, name));
  }

  return {
    checksum: hashHarborRoot(harborRoot),
    tasks,
  };
}

export function renderTasksLock(harborRoot: string): string {
  return `${JSON.stringify(buildTasksLock(harborRoot), null, 2)}\n`;
}

export function writeTasksLock(harborRoot: string): string {
  const lockPath = tasksLockPath(harborRoot);
  writeFileSync(lockPath, renderTasksLock(harborRoot), "utf8");
  return lockPath;
}

async function main(): Promise<void> {
  const harborRoot = process.argv[2] ?? "harbor";
  if (!existsSync(harborRoot)) {
    throw new Error(`harbor export directory not found: ${harborRoot}`);
  }

  const lockPath = writeTasksLock(harborRoot);
  const taskCount = discoverHarborTaskDirs(harborRoot).length;
  console.log(`[harbor] wrote tasks lock for ${taskCount} task(s) to ${lockPath}`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
