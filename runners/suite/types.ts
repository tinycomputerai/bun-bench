export interface SuiteSummary {
  agent_id: string;
  average_score: number;
  completed_at: string;
  failed: number;
  passed: number;
  started_at: string;
  total_tasks: number;
  total_wall_time_ms: number;
}

export interface LeaderboardEntry {
  duration_ms: number;
  run_id: string;
  score: number;
  status: string;
  task_id: string;
}

export interface SuiteLeaderboard {
  agent_id: string;
  entries: LeaderboardEntry[];
}

export interface SuiteResult {
  leaderboard: SuiteLeaderboard;
  outputDir: string;
  summary: SuiteSummary;
}
