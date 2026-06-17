import { describe, expect, test } from "bun:test";
import {
  mergeLeaderboardEntries,
  selectFailedTaskIds,
  taskPathFromTaskId,
} from "./load-leaderboard";
import type { LeaderboardEntry, SuiteLeaderboard } from "./types";

function entry(taskId: string, score: number): LeaderboardEntry {
  return {
    task_id: taskId,
    score,
    duration_ms: 1000,
    status: score === 100 ? "completed" : "failed_hidden_tests",
    run_id: `run-${taskId}`,
  };
}

describe("suite retry helpers", () => {
  test("maps task ids to task paths", () => {
    expect(taskPathFromTaskId("authentication.jwt-verify.v1")).toBe(
      "tasks/authentication.jwt-verify.v1",
    );
  });

  test("selects only tasks with score below 100", () => {
    const leaderboard: SuiteLeaderboard = {
      agent_id: "claude-code",
      entries: [
        entry("alpha.v1", 100),
        entry("beta.v1", 25),
        entry("gamma.v1", 0),
        entry("delta.v1", 100),
      ],
    };

    expect(selectFailedTaskIds(leaderboard)).toEqual(["beta.v1", "gamma.v1"]);
  });

  test("merges retried results while keeping passing tasks", () => {
    const previous = [
      entry("alpha.v1", 100),
      entry("beta.v1", 25),
      entry("gamma.v1", 0),
    ];
    const retried = [entry("beta.v1", 100), entry("gamma.v1", 25)];

    expect(mergeLeaderboardEntries(previous, retried)).toEqual([
      entry("alpha.v1", 100),
      entry("beta.v1", 100),
      entry("gamma.v1", 25),
    ]);
  });
});
