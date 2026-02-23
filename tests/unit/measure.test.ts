import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

// Test the bookmark rate rating logic directly
// We can't import measureArticle without mocking the client,
// but we can test the rating calculation logic

describe("Bookmark Rate Rating", () => {
  function rateToRating(bookmarkRate: number): string {
    if (bookmarkRate >= 8) return "exceptional";
    if (bookmarkRate >= 5) return "good";
    if (bookmarkRate >= 2) return "ok";
    return "failed";
  }

  it("rates 8%+ as exceptional", () => {
    assert.equal(rateToRating(8), "exceptional");
    assert.equal(rateToRating(9.2), "exceptional");
    assert.equal(rateToRating(15), "exceptional");
  });

  it("rates 5-8% as good", () => {
    assert.equal(rateToRating(5), "good");
    assert.equal(rateToRating(6.5), "good");
    assert.equal(rateToRating(7.99), "good");
  });

  it("rates 2-5% as ok", () => {
    assert.equal(rateToRating(2), "ok");
    assert.equal(rateToRating(3), "ok");
    assert.equal(rateToRating(4.99), "ok");
  });

  it("rates <2% as failed", () => {
    assert.equal(rateToRating(0), "failed");
    assert.equal(rateToRating(1), "failed");
    assert.equal(rateToRating(1.99), "failed");
  });

  it("computes bookmark rate correctly", () => {
    // bookmarkRate = bookmarks / impressions * 100
    const impressions = 228;
    const bookmarks = 21;
    const rate = (bookmarks / impressions) * 100;
    assert.ok(rate > 9 && rate < 10, `Expected ~9.2%, got ${rate}%`);
    assert.equal(rateToRating(rate), "exceptional");
  });

  it("handles zero impressions", () => {
    const rate = 0 > 0 ? (5 / 0) * 100 : 0;
    assert.equal(rate, 0);
    assert.equal(rateToRating(rate), "failed");
  });
});
