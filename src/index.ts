// Core
export { CosmoX, envFromProcess, createOAuth1Client, createBearerClient } from "./client.js";
export type { CosmoEnv } from "./client.js";

// Rate limiter
export { RateLimiter, rateLimiter } from "./rate-limiter.js";
export type { RateLimitState, RateLimiterOpts } from "./rate-limiter.js";

// Operations
export { searchRecent, searchIterator } from "./operations/search.js";
export type { SearchOpts, SearchResult, SearchResponse } from "./operations/search.js";

export { createPost, reply, deletePost, postThread } from "./operations/post.js";
export type { PostOpts, PostResult } from "./operations/post.js";

export {
  getTweet,
  getTweets,
  getUser,
  getUserByUsername,
  getMe,
  getListTimeline,
  getUserTimeline,
} from "./operations/lookup.js";
export type { TweetData, UserData } from "./operations/lookup.js";

export { like, unlike, repost, unrepost, follow, unfollow } from "./operations/engage.js";

export { measureArticle, measureArticles, pulseCheck } from "./operations/measure.js";
export type { ArticleMetrics, PulseCheckResult } from "./operations/measure.js";

// Scheduler
export { Scheduler } from "./scheduler.js";
export type {
  SchedulerConfig,
  SchedulePostOpts,
  ScheduleBatchOpts,
  ScheduleThreadOpts,
  ScheduledPost,
  CancelOpts,
} from "./scheduler.js";
