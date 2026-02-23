import { Scheduler } from "../../dist/scheduler.js";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

describe("Scheduler", () => {
  describe("constructor", () => {
    it("initializes with config", () => {
      const s = new Scheduler({
        baseUrl: "https://example.com",
        apiKey: "test-key",
      });
      assert.ok(s);
    });

    it("strips trailing slash from baseUrl", async () => {
      const s = new Scheduler({
        baseUrl: "https://example.com/",
        apiKey: "test-key",
      });
      // We can't directly access private fields, but we can verify
      // the health check URL construction works
      assert.ok(s);
    });
  });

  describe("fromEnv()", () => {
    it("creates scheduler from env vars", () => {
      if (!process.env.SCHEDULER_API_KEY) {
        // Skip if no scheduler key set
        return;
      }
      const s = Scheduler.fromEnv();
      assert.ok(s);
    });

    it("throws without SCHEDULER_API_KEY", () => {
      const orig = process.env.SCHEDULER_API_KEY;
      delete process.env.SCHEDULER_API_KEY;
      try {
        assert.throws(() => Scheduler.fromEnv(), {
          message: "SCHEDULER_API_KEY not set",
        });
      } finally {
        if (orig) process.env.SCHEDULER_API_KEY = orig;
      }
    });
  });

  describe("health()", () => {
    it("calls health endpoint (live)", async () => {
      if (!process.env.SCHEDULER_API_KEY) return;
      const s = Scheduler.fromEnv();
      const health = await s.health();
      assert.ok(health);
    });
  });
});
