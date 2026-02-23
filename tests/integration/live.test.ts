import { CosmoX } from "../../dist/client.js";
import { RateLimiter } from "../../dist/rate-limiter.js";
import { searchRecent } from "../../dist/operations/search.js";
import { getTweet, getTweets, getUser, getUserByUsername, getMe, getListTimeline, getUserTimeline } from "../../dist/operations/lookup.js";
import { measureArticle, pulseCheck } from "../../dist/operations/measure.js";
import { Scheduler } from "../../dist/scheduler.js";
import { strict as assert } from "node:assert";
import { describe, it, before } from "node:test";

/**
 * Integration tests — hit the real X API.
 *
 * Requirements:
 *   - Valid X API credentials in environment
 *   - Rate limits: these tests are designed to stay within Basic tier limits
 *     by using minimal requests and the OAuth1 client (separate rate pool from Bearer)
 *
 * Run with: npm run test:integration
 */

const MY_ID = "1713084012346900480";
const MY_USERNAME = "cosmo_kappa";
const OPENCLAW_ARTICLE_ID = "2020621967070503358";
const SNIPER_LIST_ID = "2019765405288407081";

let cosmo: CosmoX;
let rl: RateLimiter;

before(() => {
  cosmo = new CosmoX();
  rl = new RateLimiter({
    maxRetries: 2,
    baseDelay: 16_000, // respect Basic tier: 1 req / 15s
    log: (msg) => console.error(msg),
  });
});

describe("Integration: Auth", () => {
  it("authenticates via OAuth1 (getMe)", async () => {
    const me = await getMe(cosmo.client, rl);
    assert.ok(me, "getMe should return data");
    assert.equal(me.id, MY_ID);
    assert.equal(me.username, MY_USERNAME);
    assert.ok(me.metrics, "should include public metrics");
    assert.ok(typeof me.metrics.followers === "number");
    assert.ok(typeof me.metrics.tweets === "number");
  });

  it("authenticates via Bearer (user lookup)", async () => {
    const user = await getUserByUsername(cosmo.reader, rl, MY_USERNAME);
    assert.ok(user, "user lookup should return data");
    assert.equal(user.username, MY_USERNAME);
  });
});

describe("Integration: Lookup", () => {
  it("looks up a tweet with full metrics", async () => {
    const tweet = await getTweet(cosmo.client, rl, OPENCLAW_ARTICLE_ID);
    assert.ok(tweet, "tweet should exist");
    assert.equal(tweet.id, OPENCLAW_ARTICLE_ID);
    assert.ok(tweet.metrics, "should have metrics");
    assert.ok(typeof tweet.metrics.likes === "number");
    assert.ok(typeof tweet.metrics.bookmarks === "number");
    assert.ok(typeof tweet.metrics.impressions === "number");
    assert.ok(tweet.metrics.bookmarks > 0, "OpenClaw article should have bookmarks");
  });

  it("looks up a user by ID", async () => {
    const user = await getUser(cosmo.client, rl, MY_ID);
    assert.ok(user, "user should exist");
    assert.equal(user.username, MY_USERNAME);
    assert.ok(user.description, "should have description");
    assert.ok(user.metrics, "should have metrics");
  });

  it("looks up a user by username", async () => {
    const user = await getUserByUsername(cosmo.client, rl, MY_USERNAME);
    assert.ok(user, "user should exist");
    assert.equal(user.id, MY_ID);
  });

  it("gets user timeline", async () => {
    const posts = await getUserTimeline(cosmo.client, rl, MY_ID, 5);
    assert.ok(Array.isArray(posts));
    assert.ok(posts.length > 0, "should have at least 1 post");
    assert.ok(posts.length <= 5, "should respect maxResults");

    const first = posts[0];
    assert.ok(first.id, "post should have id");
    assert.ok(first.text, "post should have text");
    assert.ok(first.metrics, "post should have metrics");
  });

  it("gets list timeline", async () => {
    const posts = await getListTimeline(cosmo.client, rl, SNIPER_LIST_ID, 3);
    assert.ok(Array.isArray(posts));
    // List may be empty if no recent posts, but it should not error
    if (posts.length > 0) {
      const first = posts[0];
      assert.ok(first.id, "post should have id");
      assert.ok(first.text, "post should have text");
    }
  });
});

describe("Integration: Search", () => {
  it("searches recent tweets", async () => {
    const res = await searchRecent(cosmo.client, rl, {
      query: "AI agents -is:retweet lang:en",
      maxResults: 10,
      maxPages: 1,
    });
    assert.ok(res.results.length > 0, "should find tweets");
    assert.ok(res.results.length <= 10);
    assert.equal(res.totalPages, 1);

    const first = res.results[0];
    assert.ok(first.id, "result should have id");
    assert.ok(first.text, "result should have text");
    assert.ok(first.authorId, "result should have authorId");
  });

  it("returns pagination token for more results", async () => {
    const res = await searchRecent(cosmo.client, rl, {
      query: "AI agents -is:retweet lang:en",
      maxResults: 10,
      maxPages: 1,
    });
    // nextToken should be present if there are more results
    // (almost always true for a broad query)
    assert.ok(res.nextToken, "should have nextToken for pagination");
  });
});

describe("Integration: Measure", () => {
  it("measures article bookmark rate", async () => {
    const m = await measureArticle(cosmo.client, rl, OPENCLAW_ARTICLE_ID);
    assert.ok(m, "should return metrics");
    assert.equal(m.id, OPENCLAW_ARTICLE_ID);
    assert.ok(m.impressions > 0, "should have impressions");
    assert.ok(m.bookmarks > 0, "should have bookmarks");
    assert.ok(m.bookmarkRate > 0, "should have positive bookmark rate");
    assert.ok(
      ["exceptional", "good", "ok", "failed"].includes(m.rating),
      `rating should be valid, got: ${m.rating}`
    );
  });

  it("runs pulse check", async () => {
    const pulse = await pulseCheck(cosmo.client, rl, 5);
    assert.ok(pulse, "should return pulse data");
    assert.equal(pulse.user.username, MY_USERNAME);
    assert.ok(pulse.recentPosts.length > 0, "should have recent posts");
    assert.ok(typeof pulse.totalImpressions === "number");
    assert.ok(typeof pulse.avgBookmarkRate === "number");
  });
});

describe("Integration: Scheduler", () => {
  it("connects to scheduler health endpoint", async () => {
    if (!process.env.SCHEDULER_API_KEY) {
      console.log("  ⊘ skipped (SCHEDULER_API_KEY not set)");
      return;
    }
    const scheduler = Scheduler.fromEnv();
    const health = await scheduler.health();
    assert.ok(health, "health check should respond");
  });

  it("lists scheduled posts", async () => {
    if (!process.env.SCHEDULER_API_KEY) {
      console.log("  ⊘ skipped (SCHEDULER_API_KEY not set)");
      return;
    }
    const scheduler = Scheduler.fromEnv();
    const posts = await scheduler.listPosts();
    assert.ok(Array.isArray(posts), "should return array");
  });
});

// Note: We deliberately DO NOT test write operations (post, like, follow)
// in the integration suite to avoid side effects on the real account.
// Those methods are verified to exist via the CLI 'test' command and
// through the unit tests of the rate limiter wrapper.
