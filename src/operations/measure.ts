import type { Client } from "@xdevplatform/xdk";
import type { RateLimiter } from "../rate-limiter.js";
import { getTweet, getMe, getUserTimeline } from "./lookup.js";
import type { TweetData, UserData } from "./lookup.js";

export interface ArticleMetrics {
  id: string;
  text: string;
  impressions: number;
  bookmarks: number;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarkRate: number; // bookmarks / impressions * 100
  rating: "exceptional" | "good" | "ok" | "failed";
}

/**
 * Get full metrics for a tweet and compute bookmark rate.
 *
 * Benchmark:
 *   8%+ bookmark rate = exceptional
 *   5%+ = good
 *   2-5% = ok
 *   <2% = failed
 */
export async function measureArticle(
  client: Client,
  rl: RateLimiter,
  tweetId: string
): Promise<ArticleMetrics | null> {
  const tweet = await getTweet(client, rl, tweetId);
  if (!tweet?.metrics) return null;

  const m = tweet.metrics;
  const bookmarkRate = m.impressions > 0 ? (m.bookmarks / m.impressions) * 100 : 0;

  let rating: ArticleMetrics["rating"];
  if (bookmarkRate >= 8) rating = "exceptional";
  else if (bookmarkRate >= 5) rating = "good";
  else if (bookmarkRate >= 2) rating = "ok";
  else rating = "failed";

  return {
    id: tweet.id,
    text: tweet.text.substring(0, 120),
    impressions: m.impressions,
    bookmarks: m.bookmarks,
    likes: m.likes,
    retweets: m.retweets,
    replies: m.replies,
    quotes: m.quotes,
    bookmarkRate: Math.round(bookmarkRate * 100) / 100,
    rating,
  };
}

/**
 * Measure multiple articles at once.
 */
export async function measureArticles(
  client: Client,
  rl: RateLimiter,
  tweetIds: string[]
): Promise<ArticleMetrics[]> {
  const results: ArticleMetrics[] = [];
  for (const id of tweetIds) {
    const m = await measureArticle(client, rl, id);
    if (m) results.push(m);
  }
  return results;
}

export interface PulseCheckResult {
  user: UserData;
  recentPosts: TweetData[];
  totalImpressions: number;
  totalBookmarks: number;
  totalLikes: number;
  avgBookmarkRate: number;
}

/**
 * Pulse check — get current account state + recent post performance.
 */
export async function pulseCheck(
  client: Client,
  rl: RateLimiter,
  postCount = 10
): Promise<PulseCheckResult | null> {
  const user = await getMe(client, rl);
  if (!user) return null;

  const recentPosts = await getUserTimeline(client, rl, user.id, postCount);

  let totalImpressions = 0;
  let totalBookmarks = 0;
  let totalLikes = 0;

  for (const post of recentPosts) {
    if (post.metrics) {
      totalImpressions += post.metrics.impressions;
      totalBookmarks += post.metrics.bookmarks;
      totalLikes += post.metrics.likes;
    }
  }

  const avgBookmarkRate =
    totalImpressions > 0 ? (totalBookmarks / totalImpressions) * 100 : 0;

  return {
    user,
    recentPosts,
    totalImpressions,
    totalBookmarks,
    totalLikes,
    avgBookmarkRate: Math.round(avgBookmarkRate * 100) / 100,
  };
}
