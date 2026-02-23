/**
 * Rate-limit-aware wrapper for X API calls.
 *
 * The XDK throws raw HTTP 429 errors with no retry logic.
 * This wrapper catches 429s, waits, and retries transparently.
 */

export interface RateLimitState {
  endpoint: string;
  remaining: number;
  resetAt: number; // unix ms
  lastHit: number; // unix ms
}

export interface RateLimiterOpts {
  /** Max retries on 429 before giving up. Default: 3 */
  maxRetries?: number;
  /** Base delay in ms when no reset header is available. Default: 15000 (15s) */
  baseDelay?: number;
  /** Log function. Default: console.log */
  log?: (msg: string) => void;
}

export class RateLimiter {
  private limits = new Map<string, RateLimitState>();
  private maxRetries: number;
  private baseDelay: number;
  private log: (msg: string) => void;

  constructor(opts: RateLimiterOpts = {}) {
    this.maxRetries = opts.maxRetries ?? 3;
    this.baseDelay = opts.baseDelay ?? 15_000;
    this.log = opts.log ?? (() => {});
  }

  /**
   * Execute an API call with automatic 429 retry.
   *
   * @param endpoint - Label for tracking (e.g. "search", "post.create")
   * @param fn - The async function to call
   */
  async call<T>(endpoint: string, fn: () => Promise<T>): Promise<T> {
    // Pre-check: if we know this endpoint is exhausted, wait first
    const state = this.limits.get(endpoint);
    if (state && state.remaining === 0 && state.resetAt > Date.now()) {
      const waitMs = state.resetAt - Date.now() + 500; // 500ms buffer
      this.log(`[rate] ${endpoint}: pre-waiting ${Math.ceil(waitMs / 1000)}s until reset`);
      await sleep(waitMs);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await fn();
        // Success — clear any exhausted state
        this.limits.set(endpoint, {
          endpoint,
          remaining: 1,
          resetAt: 0,
          lastHit: Date.now(),
        });
        return result;
      } catch (err: unknown) {
        lastError = err;

        if (!is429(err)) throw err;

        const waitMs = this.getWaitMs(err, attempt);
        this.limits.set(endpoint, {
          endpoint,
          remaining: 0,
          resetAt: Date.now() + waitMs,
          lastHit: Date.now(),
        });

        if (attempt < this.maxRetries) {
          this.log(
            `[rate] ${endpoint}: 429 hit, retry ${attempt + 1}/${this.maxRetries} in ${Math.ceil(waitMs / 1000)}s`
          );
          await sleep(waitMs);
        }
      }
    }

    throw lastError;
  }

  /**
   * Calculate wait time from error or use exponential backoff.
   */
  private getWaitMs(err: unknown, attempt: number): number {
    // Try to extract reset time from error headers/body
    const resetAfter = extractResetSeconds(err);
    if (resetAfter && resetAfter > 0) {
      return resetAfter * 1000 + 1000; // +1s buffer
    }
    // Exponential backoff: 15s, 30s, 60s
    return this.baseDelay * Math.pow(2, attempt);
  }

  /** Get current state for an endpoint */
  getState(endpoint: string): RateLimitState | undefined {
    return this.limits.get(endpoint);
  }

  /** Check if an endpoint is currently rate-limited */
  isLimited(endpoint: string): boolean {
    const state = this.limits.get(endpoint);
    return Boolean(state && state.remaining === 0 && state.resetAt > Date.now());
  }
}

// --- Helpers ---

function is429(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes("429") || err.message.includes("Too Many Requests");
  }
  return false;
}

function extractResetSeconds(err: unknown): number | null {
  // The XDK error message format: "HTTP 429: Too Many Requests"
  // It doesn't expose headers, so we can't get x-rate-limit-reset.
  // Fall back to default backoff.
  if (err && typeof err === "object" && "headers" in err) {
    const headers = (err as Record<string, unknown>).headers;
    if (headers && typeof headers === "object") {
      const reset = (headers as Record<string, string>)["x-rate-limit-reset"];
      if (reset) {
        const resetTime = parseInt(reset, 10) * 1000;
        return Math.max(0, (resetTime - Date.now()) / 1000);
      }
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Default singleton */
export const rateLimiter = new RateLimiter({
  log: (msg) => console.error(msg),
});
