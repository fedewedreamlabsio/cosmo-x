import { RateLimiter } from "../../dist/rate-limiter.js";
import { strict as assert } from "node:assert";
import { describe, it, beforeEach } from "node:test";

describe("RateLimiter", () => {
  let rl: RateLimiter;
  const logs: string[] = [];

  beforeEach(() => {
    logs.length = 0;
    rl = new RateLimiter({
      maxRetries: 2,
      baseDelay: 100, // fast for tests
      log: (msg) => logs.push(msg),
    });
  });

  describe("call()", () => {
    it("passes through successful calls", async () => {
      const result = await rl.call("test", async () => "hello");
      assert.equal(result, "hello");
    });

    it("returns the correct type", async () => {
      const result = await rl.call("test", async () => ({ id: "123", count: 5 }));
      assert.deepEqual(result, { id: "123", count: 5 });
    });

    it("throws non-429 errors immediately", async () => {
      await assert.rejects(
        () => rl.call("test", async () => { throw new Error("HTTP 403: Forbidden"); }),
        { message: "HTTP 403: Forbidden" }
      );
      assert.equal(logs.length, 0); // no rate limit logging
    });

    it("retries on 429 and succeeds", async () => {
      let attempts = 0;
      const result = await rl.call("test", async () => {
        attempts++;
        if (attempts === 1) throw new Error("HTTP 429: Too Many Requests");
        return "recovered";
      });
      assert.equal(result, "recovered");
      assert.equal(attempts, 2);
      assert.equal(logs.length, 1);
      assert.ok(logs[0].includes("429 hit"));
      assert.ok(logs[0].includes("retry 1/2"));
    });

    it("retries multiple times on repeated 429s", async () => {
      let attempts = 0;
      const result = await rl.call("test", async () => {
        attempts++;
        if (attempts <= 2) throw new Error("HTTP 429: Too Many Requests");
        return "finally";
      });
      assert.equal(result, "finally");
      assert.equal(attempts, 3);
      assert.equal(logs.length, 2);
    });

    it("gives up after maxRetries", async () => {
      let attempts = 0;
      await assert.rejects(
        () => rl.call("test", async () => {
          attempts++;
          throw new Error("HTTP 429: Too Many Requests");
        }),
        { message: "HTTP 429: Too Many Requests" }
      );
      assert.equal(attempts, 3); // initial + 2 retries
    });

    it("detects 429 from 'Too Many Requests' message", async () => {
      let attempts = 0;
      await rl.call("test", async () => {
        attempts++;
        if (attempts === 1) throw new Error("Too Many Requests");
        return "ok";
      });
      assert.equal(attempts, 2); // retried
    });
  });

  describe("isLimited()", () => {
    it("returns false for unknown endpoints", () => {
      assert.equal(rl.isLimited("unknown"), false);
    });

    it("returns true after a 429", async () => {
      let attempts = 0;
      await rl.call("search", async () => {
        attempts++;
        if (attempts === 1) throw new Error("HTTP 429: Too Many Requests");
        return "ok";
      });
      // After recovery, should not be limited
      assert.equal(rl.isLimited("search"), false);
    });

    it("returns true when exhausted and reset is in future", async () => {
      // Force a 429 that exhausts all retries
      try {
        await rl.call("search", async () => {
          throw new Error("HTTP 429: Too Many Requests");
        });
      } catch {
        // expected
      }
      assert.equal(rl.isLimited("search"), true);
    });
  });

  describe("getState()", () => {
    it("returns undefined for unknown endpoints", () => {
      assert.equal(rl.getState("unknown"), undefined);
    });

    it("tracks state after successful call", async () => {
      await rl.call("test", async () => "ok");
      const state = rl.getState("test");
      assert.ok(state);
      assert.equal(state.endpoint, "test");
      assert.equal(state.remaining, 1);
      assert.equal(state.resetAt, 0);
      assert.ok(state.lastHit > 0);
    });

    it("tracks state after 429", async () => {
      try {
        await rl.call("test", async () => {
          throw new Error("HTTP 429: Too Many Requests");
        });
      } catch {
        // expected
      }
      const state = rl.getState("test");
      assert.ok(state);
      assert.equal(state.remaining, 0);
      assert.ok(state.resetAt > Date.now()); // future reset
    });
  });

  describe("pre-check behavior", () => {
    it("waits before calling an exhausted endpoint", async () => {
      // Exhaust the endpoint
      try {
        await rl.call("slow", async () => {
          throw new Error("HTTP 429: Too Many Requests");
        });
      } catch {
        // expected
      }

      // Now call again — it should pre-wait
      const start = Date.now();
      let called = false;
      try {
        await rl.call("slow", async () => {
          called = true;
          return "ok";
        });
      } catch {
        // may still 429, that's fine
      }
      // Should have waited some time before calling
      const elapsed = Date.now() - start;
      assert.ok(elapsed >= 50, `Expected pre-wait but elapsed was ${elapsed}ms`);
    });
  });

  describe("independent endpoint tracking", () => {
    it("tracks different endpoints separately", async () => {
      await rl.call("endpoint-a", async () => "a");
      await rl.call("endpoint-b", async () => "b");

      const stateA = rl.getState("endpoint-a");
      const stateB = rl.getState("endpoint-b");

      assert.ok(stateA);
      assert.ok(stateB);
      assert.equal(stateA.endpoint, "endpoint-a");
      assert.equal(stateB.endpoint, "endpoint-b");
    });

    it("does not cross-contaminate rate limits", async () => {
      // Exhaust endpoint-a
      try {
        await rl.call("endpoint-a", async () => {
          throw new Error("HTTP 429: Too Many Requests");
        });
      } catch {
        // expected
      }

      assert.equal(rl.isLimited("endpoint-a"), true);
      assert.equal(rl.isLimited("endpoint-b"), false);
    });
  });
});
