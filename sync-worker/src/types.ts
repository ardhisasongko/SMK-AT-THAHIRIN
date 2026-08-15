export type JobName = 'daily' | 'weekly';

export interface Env {
  DB: D1Database;
  APPS_SCRIPT_URL: string;
  SYNC_TOKEN: string;
  SYNC_ENABLED?: string;
  SYNC_DRY_RUN?: string;
  SYNC_BATCH_SIZE?: string;
  SYNC_TIMEOUT_MS?: string;
  SYNC_MAX_RETRIES?: string;
}

export interface SyncConfig {
  enabled: boolean;
  dryRun: boolean;
  batchSize: number;
  timeoutMs: number;
  maxRetries: number;
}

export interface JobResult extends Record<string, unknown> {
  ok: boolean;
  executed: boolean;
  job: JobName;
  status: 'disabled' | 'locked' | 'running' | 'dry-run' | 'completed' | 'partial' | 'failed';
  dryRun: boolean;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}
