import type { TaskConfig } from "../runners/local/types";

export interface AgentContext {
  agentId: string;
  deadlineMs: number;
  logsDir: string;
  prompt: string;
  runDir: string;
  task: TaskConfig;
  taskDir: string;
  workspaceDir: string;
}

export interface AgentMetrics {
  input_tokens?: number;
  output_tokens?: number;
  tool_calls?: number;
  wall_time_ms: number;
}

export interface AgentRunOutcome {
  durationMs: number;
  exitCode: number;
  metrics: AgentMetrics;
  timedOut: boolean;
}

export interface Agent {
  /** Release resources after the run (always called, even on failure). */
  cleanup(context: AgentContext): Promise<void>;
  readonly id: string;

  /** Verify the agent binary is available and prepare run artifacts. */
  prepare(context: AgentContext): Promise<void>;

  /** Execute the agent against the materialized workspace. */
  run(context: AgentContext): Promise<AgentRunOutcome>;
}
