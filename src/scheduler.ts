/**
 * Typed client for the xscheduler Railway API.
 * Keeps the existing scheduler running — just adds type safety.
 */

export interface SchedulerConfig {
  baseUrl: string;
  apiKey: string;
}

export interface SchedulePostOpts {
  text: string;
  scheduled_time: string; // ISO 8601
  reply_to_tweet_id?: string;
}

export interface ScheduleBatchOpts {
  posts: SchedulePostOpts[];
}

export interface ScheduleThreadOpts {
  thread_id?: string;
  posts: Array<{
    text: string;
    scheduled_time: string;
  }>;
  delay_seconds?: number;
}

export interface ScheduledPost {
  id: string;
  text: string;
  scheduled_time: string;
  status: "pending" | "posted" | "failed" | "cancelled";
  tweet_id?: string;
  reply_to_tweet_id?: string;
  thread_id?: string;
  created_at: string;
}

export interface CancelOpts {
  post_id?: string;
  thread_id?: string;
}

export class Scheduler {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: SchedulerConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }

  /**
   * Create from environment variables.
   */
  static fromEnv(): Scheduler {
    const baseUrl =
      process.env.SCHEDULER_URL ??
      process.env.SCHEDULER_API_URL ??
      "https://api-production-bb3f.up.railway.app";
    const apiKey = process.env.SCHEDULER_API_KEY;
    if (!apiKey) throw new Error("SCHEDULER_API_KEY not set");
    return new Scheduler({ baseUrl, apiKey });
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Scheduler ${method} ${path}: ${res.status} ${text}`);
    }

    return res.json() as Promise<T>;
  }

  /** Health check (no auth required) */
  async health(): Promise<{ status: string }> {
    const res = await fetch(`${this.baseUrl}/health`);
    return res.json() as Promise<{ status: string }>;
  }

  /** Schedule a single post */
  async schedule(opts: SchedulePostOpts): Promise<ScheduledPost> {
    return this.request("POST", "/schedule", opts);
  }

  /** Schedule multiple posts at once */
  async scheduleBatch(opts: ScheduleBatchOpts): Promise<ScheduledPost[]> {
    return this.request("POST", "/schedule-batch", opts);
  }

  /** Schedule a thread (auto-chaining replies) */
  async scheduleThread(opts: ScheduleThreadOpts): Promise<ScheduledPost[]> {
    return this.request("POST", "/schedule-thread", opts);
  }

  /** List scheduled posts, optionally filtered by status */
  async listPosts(
    status?: "pending" | "posted" | "failed" | "cancelled"
  ): Promise<ScheduledPost[]> {
    const path = status ? `/posts?status=${status}` : "/posts";
    return this.request("GET", path);
  }

  /** Cancel a pending post or entire thread */
  async cancel(opts: CancelOpts): Promise<{ cancelled: boolean }> {
    return this.request("POST", "/cancel", opts);
  }
}
