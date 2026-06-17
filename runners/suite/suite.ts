import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateTaskDirectory } from "../../validators/validate-task";
import { runAgent } from "../agent/runner";
import { discoverTasks } from "./discover-tasks";
import {
  loadLeaderboard,
  mergeLeaderboardEntries,
  selectFailedTaskIds,
  taskPathFromTaskId,
} from "./load-leaderboard";
import type { LeaderboardEntry, SuiteLeaderboard, SuiteResult, SuiteSummary } from "./types";

const repoRoot = resolve(import.meta.dir, "../..");

export type RunSuiteOptions =
  | { tasksPattern: string; failedFrom?: undefined }
  | { failedFrom: string; tasksPattern?: undefined };

export async function runSuite(agentId: string, options: RunSuiteOptions): Promise<SuiteResult> {
  if (options.failedFrom) {
    return runSuiteRetry(agentId, options.failedFrom);
  }

  const taskPaths = await discoverTasks(options.tasksPattern);
  if (taskPaths.length === 0) {
    throw new Error(`no valid tasks discovered for pattern: ${options.tasksPattern}`);
  }

  const startedAt = new Date().toISOString();
  const suiteStartedMs = Date.now();
  const entries = await runTaskPaths(agentId, taskPaths);
  const completedAt = new Date().toISOString();

  return writeSuiteResult({
    agentId,
    entries,
    startedAt,
    completedAt,
    wallTimeMs: Date.now() - suiteStartedMs,
  });
}

async function runSuiteRetry(agentId: string, failedFrom: string): Promise<SuiteResult> {
  const previous = loadLeaderboard(failedFrom);
  if (previous.agent_id !== agentId) {
    throw new Error(
      `leaderboard agent_id "${previous.agent_id}" does not match --agent "${agentId}"`,
    );
  }

  const failedTaskIds = selectFailedTaskIds(previous);
  if (failedTaskIds.length === 0) {
    console.log(`[suite] no tasks with score < 100 in ${failedFrom}`);
    const now = new Date().toISOString();
    return writeSuiteResult({
      agentId,
      entries: previous.entries,
      startedAt: now,
      completedAt: now,
      wallTimeMs: 0,
    });
  }

  const taskPaths = failedTaskIds.map(taskPathFromTaskId);
  for (const taskPath of taskPaths) {
    const validation = await validateTaskDirectory(taskPath);
    if (validation.errors.length > 0) {
      throw new Error(`invalid task ${taskPath}: ${validation.errors.join(", ")}`);
    }
  }

  console.log(`[suite] retrying ${failedTaskIds.length} failed task(s) from ${failedFrom}`);

  const startedAt = new Date().toISOString();
  const suiteStartedMs = Date.now();
  const retriedEntries = await runTaskPaths(agentId, taskPaths);
  const completedAt = new Date().toISOString();
  const entries = mergeLeaderboardEntries(previous.entries, retriedEntries);

  return writeSuiteResult({
    agentId,
    entries,
    startedAt,
    completedAt,
    wallTimeMs: Date.now() - suiteStartedMs,
  });
}

async function runTaskPaths(agentId: string, taskPaths: string[]): Promise<LeaderboardEntry[]> {
  const entries: LeaderboardEntry[] = [];

  for (const taskPath of taskPaths) {
    console.log(`\n[suite] running ${taskPath} with ${agentId}`);
    const result = await runAgent(taskPath, agentId);

    entries.push({
      task_id: result.task_id,
      score: result.score,
      duration_ms: result.durations.total_ms,
      status: result.status,
      run_id: result.run_id,
    });

    console.log(
      `[suite] ${result.task_id}: ${result.status} (${result.score}/${result.max_score}, ${result.durations.total_ms}ms)`,
    );
  }

  return entries;
}

function writeSuiteResult(input: {
  agentId: string;
  entries: LeaderboardEntry[];
  startedAt: string;
  completedAt: string;
  wallTimeMs: number;
}): SuiteResult {
  const summary = buildSummary(
    input.agentId,
    input.entries,
    input.wallTimeMs,
    input.startedAt,
    input.completedAt,
  );

  const leaderboard: SuiteLeaderboard = {
    agent_id: input.agentId,
    entries: [...input.entries].sort(
      (left, right) => right.score - left.score || left.task_id.localeCompare(right.task_id),
    ),
  };

  const outputDir = join(repoRoot, "results", input.agentId);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(join(outputDir, "leaderboard.json"), `${JSON.stringify(leaderboard, null, 2)}\n`);

  return { summary, leaderboard, outputDir };
}

function buildSummary(
  agentId: string,
  entries: LeaderboardEntry[],
  wallTimeMs: number,
  startedAt: string,
  completedAt: string,
): SuiteSummary {
  const passed = entries.filter((entry) => entry.status === "completed").length;
  const failed = entries.length - passed;
  const averageScore = entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length;

  return {
    agent_id: agentId,
    total_tasks: entries.length,
    passed,
    failed,
    average_score: roundScore(averageScore),
    total_wall_time_ms: wallTimeMs,
    started_at: startedAt,
    completed_at: completedAt,
  };
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}
