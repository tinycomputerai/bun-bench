export type DatasetSplit = "train" | "dev" | "public_eval" | "private_eval";

export interface TaskDatasetMetadata {
  leakage_group: string;
  split: DatasetSplit;
  trainable: boolean;
}

export interface ExportRunResult {
  agent_id?: string;
  completed_at: string;
  durations?: {
    total_ms?: number;
    agent_ms?: number;
  };
  max_score: number;
  metrics?: {
    wall_time_ms?: number;
    input_tokens?: number;
    output_tokens?: number;
    tool_calls?: number;
  };
  mode?: string;
  run_id: string;
  score: number;
  spec_version: string;
  started_at: string;
  status: string;
  task_id: string;
  task_version: string;
}

export interface SolutionPatch {
  files_changed: string[];
  patch: string;
}

export interface ExportOptions {
  allowPrivateEval: boolean;
  allowPublicEval: boolean;
  minScore: number;
  outPath: string;
  runsPattern: string;
  tasksRoot?: string;
}

export type ExportSkipReason =
  | "missing_result"
  | "invalid_result"
  | "not_agent_run"
  | "below_min_score"
  | "not_completed"
  | "public_eval_excluded"
  | "private_eval_excluded"
  | "not_trainable"
  | "missing_task"
  | "missing_prompt"
  | "missing_solution"
  | "reference_solution"
  | "hidden_tests_in_patch";

export interface ExportSummary {
  discovered: number;
  exported: number;
  out_path: string;
  skipped: Record<ExportSkipReason, number>;
}

export interface SftRecord {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  metadata: {
    task_id: string;
    run_id: string;
    score: number;
    agent_id: string;
    duration_ms: number;
    token_input: number;
    token_output: number;
    dataset: {
      split: DatasetSplit;
      leakage_group: string;
    };
  };
}

export interface PatchRecord {
  agent_id: string;
  dataset: {
    split: DatasetSplit;
    leakage_group: string;
  };
  files_changed: string[];
  patch: string;
  prompt: string;
  run_id: string;
  score: number;
  task_id: string;
}
